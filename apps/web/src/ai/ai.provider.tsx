/* ── AI Assistant provider ────────────────────────────────
 * React context that manages:
 * - Provider configuration (localStorage)
 * - Chat state and message history
 * - Agent loop (LLM → tool execution → LLM)
 * - Virtual cursor state
 * ──────────────────────────────────────────────────────── */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import type { AiConfig, AiChatMessage, AiDisplayMessage } from './ai.types.ts';
import { isAgentClick } from './ai.tools.ts';
import { buildSystemPrompt } from './ai.prompt.ts';
import { queryPage } from './ai.descriptor.ts';
import type { ToolContext } from './ai.tools.ts';
import { runAgentTurn } from './ai.agent.ts';

const CONFIG_KEY = 'editions_ai_config';

/* ── Config persistence ──────────────────────────────── */

const loadConfig = (): AiConfig | null => {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.endpoint === 'string' && typeof parsed.apiKey === 'string' && typeof parsed.model === 'string') {
      return parsed as unknown as AiConfig;
    }
    return null;
  } catch {
    return null;
  }
};

const saveConfig = (config: AiConfig): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

const clearConfig = (): void => {
  localStorage.removeItem(CONFIG_KEY);
};

/* ── Context type ────────────────────────────────────── */

type AiContextValue = {
  config: AiConfig | null;
  setConfig: (config: AiConfig) => void;
  removeConfig: () => void;
  isEnabled: boolean;
  isOpen: boolean;
  toggleOpen: () => void;
  displayMessages: AiDisplayMessage[];
  isProcessing: boolean;
  lastActivity: string | null;
  turnCount: number;
  sendMessage: (content: string) => void;
  stopProcessing: () => void;
  clearConversation: () => void;
  cursorTargetId: string | null;
  cursorVisible: boolean;
};

const AiContext = createContext<AiContextValue | null>(null);

/* ── Stop-on-interaction effect ──────────────────────── */

const useStopOnInteraction = (isProcessing: boolean, stopProcessing: () => void): void => {
  useEffect(() => {
    if (!isProcessing) {
      return;
    }
    const handleClick = (): void => {
      if (!isAgentClick()) {
        stopProcessing();
      }
    };
    const handleKeyDown = (): void => {
      stopProcessing();
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isProcessing, stopProcessing]);
};

/* ── Cursor hook ─────────────────────────────────────── */

type CursorState = {
  cursorTargetId: string | null;
  cursorVisible: boolean;
  moveCursor: (targetId: string) => Promise<void>;
  resetCursor: () => void;
};

const useCursorState = (): CursorState => {
  const [cursorTargetId, setCursorTargetId] = useState<string | null>(null);
  const [cursorVisible, setCursorVisible] = useState(false);

  const moveCursor = useCallback(
    (targetId: string): Promise<void> =>
      new Promise<void>((resolve) => {
        setCursorVisible(true);
        setCursorTargetId(targetId);
        setTimeout(resolve, 300);
      }),
    [],
  );

  const resetCursor = useCallback((): void => {
    setCursorVisible(false);
    setCursorTargetId(null);
  }, []);

  return { cursorTargetId, cursorVisible, moveCursor, resetCursor };
};

/* ── Config state hook ───────────────────────────────── */

type ConfigState = {
  config: AiConfig | null;
  isEnabled: boolean;
  setConfig: (c: AiConfig) => void;
  removeConfig: () => void;
};

const useConfigState = (
  setDisplayMessages: React.Dispatch<React.SetStateAction<AiDisplayMessage[]>>,
  messagesRef: React.MutableRefObject<AiChatMessage[]>,
): ConfigState => {
  const [config, setConfigState] = useState<AiConfig | null>(loadConfig);
  const isEnabled = config !== null;

  const setConfig = useCallback((c: AiConfig): void => {
    saveConfig(c);
    setConfigState(c);
  }, []);

  const removeConfig = useCallback((): void => {
    clearConfig();
    setConfigState(null);
    setDisplayMessages([]);
    messagesRef.current = [];
  }, [setDisplayMessages, messagesRef]);

  return { config, isEnabled, setConfig, removeConfig };
};

/* ── Agent loop hook ─────────────────────────────────── */

type AgentLoopControls = {
  isProcessing: boolean;
  lastActivity: string | null;
  turnCount: number;
  sendMessage: (content: string) => void;
  stopProcessing: () => void;
  clearConversation: () => void;
};

type AgentLoopRefs = {
  messagesRef: React.MutableRefObject<AiChatMessage[]>;
  abortRef: React.MutableRefObject<boolean>;
  setDisplayMessages: React.Dispatch<React.SetStateAction<AiDisplayMessage[]>>;
};

const useAgentLoop = (
  config: AiConfig | null,
  refs: AgentLoopRefs,
  resetCursor: () => void,
  getToolContext: () => ToolContext,
): AgentLoopControls => {
  const { messagesRef, abortRef, setDisplayMessages } = refs;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  const stopProcessing = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    resetCursor();
  }, [abortRef, resetCursor]);

  useStopOnInteraction(isProcessing, stopProcessing);

  const clearConversation = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    setDisplayMessages([]);
    messagesRef.current = [];
    resetCursor();
  }, [abortRef, setDisplayMessages, messagesRef, resetCursor]);

  const runAgentLoop = useCallback(
    async (currentConfig: AiConfig): Promise<void> => {
      for (let i = 0; i < 20; i++) {
        if (abortRef.current) {
          break;
        }
        setTurnCount(i + 1);
        const stop = await runAgentTurn(currentConfig, getToolContext(), {
          messagesRef,
          abortRef,
          setDisplayMessages,
          setLastActivity,
        });
        if (stop) {
          break;
        }
      }
    },
    [abortRef, messagesRef, setDisplayMessages, getToolContext],
  );

  const sendMessage = useSendMessage({
    config,
    isProcessing,
    refs,
    runAgentLoop,
    resetCursor,
    setIsProcessing,
    setLastActivity,
    setTurnCount,
  });

  return { isProcessing, lastActivity, turnCount, sendMessage, stopProcessing, clearConversation };
};

/* ── Send message hook ───────────────────────────────── */

type SendMessageDeps = {
  config: AiConfig | null;
  isProcessing: boolean;
  refs: AgentLoopRefs;
  runAgentLoop: (cfg: AiConfig) => Promise<void>;
  resetCursor: () => void;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setLastActivity: React.Dispatch<React.SetStateAction<string | null>>;
  setTurnCount: React.Dispatch<React.SetStateAction<number>>;
};

const useSendMessage = (deps: SendMessageDeps): ((content: string) => void) => {
  const { config, isProcessing, refs, runAgentLoop, resetCursor, setIsProcessing, setLastActivity, setTurnCount } =
    deps;
  const { messagesRef, abortRef, setDisplayMessages } = refs;

  return useCallback(
    (content: string): void => {
      if (!config || isProcessing) {
        return;
      }
      abortRef.current = false;
      setDisplayMessages((prev) => [...prev, { type: 'user', content }]);

      if (messagesRef.current.length === 0) {
        messagesRef.current = [{ role: 'system', content: buildSystemPrompt() }];
      }

      const pageContext = queryPage(1);
      const enriched = `${content}\n\n[Current page: ${pageContext.route}]\n${JSON.stringify(pageContext, null, 2)}`;
      messagesRef.current = [...messagesRef.current, { role: 'user', content: enriched }];

      setIsProcessing(true);
      setLastActivity('Thinking...');
      setTurnCount(0);

      void runAgentLoop(config).finally(() => {
        setIsProcessing(false);
        setLastActivity(null);
        setTurnCount(0);
        resetCursor();
      });
    },
    [
      config,
      isProcessing,
      abortRef,
      setDisplayMessages,
      messagesRef,
      runAgentLoop,
      resetCursor,
      setIsProcessing,
      setLastActivity,
      setTurnCount,
    ],
  );
};

/* ── Provider component ──────────────────────────────── */

const AiProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();

  const [displayMessages, setDisplayMessages] = useState<AiDisplayMessage[]>([]);
  const messagesRef = useRef<AiChatMessage[]>([]);
  const abortRef = useRef<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);

  const { config, isEnabled, setConfig, removeConfig } = useConfigState(setDisplayMessages, messagesRef);
  const { cursorTargetId, cursorVisible, moveCursor, resetCursor } = useCursorState();
  const toggleOpen = useCallback((): void => setIsOpen((prev) => !prev), []);

  const getToolContext = useCallback(
    (): ToolContext => ({
      queryClient,
      navigate: (path: string) => {
        void routerNavigate({ to: path });
      },
      moveCursor,
    }),
    [queryClient, routerNavigate, moveCursor],
  );

  const refs: AgentLoopRefs = { messagesRef, abortRef, setDisplayMessages };
  const { isProcessing, lastActivity, turnCount, sendMessage, stopProcessing, clearConversation } = useAgentLoop(
    config,
    refs,
    resetCursor,
    getToolContext,
  );

  const value = useMemo(
    (): AiContextValue => ({
      config,
      setConfig,
      removeConfig,
      isEnabled,
      isOpen,
      toggleOpen,
      displayMessages,
      isProcessing,
      lastActivity,
      turnCount,
      sendMessage,
      stopProcessing,
      clearConversation,
      cursorTargetId,
      cursorVisible,
    }),
    [
      config,
      setConfig,
      removeConfig,
      isEnabled,
      isOpen,
      toggleOpen,
      displayMessages,
      isProcessing,
      lastActivity,
      turnCount,
      sendMessage,
      stopProcessing,
      clearConversation,
      cursorTargetId,
      cursorVisible,
    ],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
};

/* ── Hook ─────────────────────────────────────────────── */

const useAi = (): AiContextValue => {
  const context = useContext(AiContext);
  if (!context) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return context;
};

export { AiProvider, useAi };
