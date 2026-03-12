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
import { toolDefinitions, executeTool, isAgentClick } from './ai.tools.ts';
import { chatCompletion } from './ai.client.ts';
import { buildSystemPrompt } from './ai.prompt.ts';
import { queryPage } from './ai.descriptor.ts';
import type { ToolContext } from './ai.tools.ts';

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

/* ── Agent turn execution ────────────────────────────── */

/** Update the last running action message with a final status. */
const updateActionStatus = (
  setDisplayMessages: React.Dispatch<React.SetStateAction<AiDisplayMessage[]>>,
  toolResult: string,
): void => {
  setDisplayMessages((prev) => {
    const updated = [...prev];
    let lastAction = -1;
    for (let i = updated.length - 1; i >= 0; i--) {
      const item = updated[i];
      if (item?.type === 'action' && (item as AiDisplayMessage & { type: 'action' }).status === 'running') {
        lastAction = i;
        break;
      }
    }
    if (lastAction !== -1) {
      const msg = updated[lastAction] as AiDisplayMessage & { type: 'action' };
      const hasError = toolResult.includes('"error"');
      updated[lastAction] = { ...msg, status: hasError ? 'error' : 'done' };
    }
    return updated;
  });
};

type AgentState = {
  messagesRef: React.MutableRefObject<AiChatMessage[]>;
  abortRef: React.MutableRefObject<boolean>;
  setDisplayMessages: React.Dispatch<React.SetStateAction<AiDisplayMessage[]>>;
  setLastActivity: React.Dispatch<React.SetStateAction<string | null>>;
};

/** Execute a single tool call and record results in the message history. */
const executeToolCall = async (
  toolCall: { id: string; name: string; arguments: string },
  ctx: ToolContext,
  state: AgentState,
): Promise<void> => {
  const { messagesRef, setDisplayMessages, setLastActivity } = state;
  const toolName = toolCall.name;
  const isVisualAction = toolName === 'click' || toolName === 'fillInput' || toolName === 'navigate';

  let toolArgs: Record<string, unknown>;
  try {
    toolArgs = JSON.parse(toolCall.arguments) as Record<string, unknown>;
  } catch {
    const errResult = JSON.stringify({ error: `Invalid tool arguments: ${toolCall.arguments}` });
    messagesRef.current = [...messagesRef.current, { role: 'tool', content: errResult, toolCallId: toolCall.id }];
    return;
  }

  const description = describeAction(toolName, toolArgs);
  setLastActivity(description);

  if (isVisualAction) {
    setDisplayMessages((prev) => [...prev, { type: 'action', description, status: 'running' }]);
  }

  let toolResult: string;
  let toolError = false;
  try {
    toolResult = await executeTool(toolName, toolArgs, ctx);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    toolResult = JSON.stringify({ error: `Tool "${toolName}" failed: ${errorMsg}` });
    toolError = true;
  }

  if (isVisualAction) {
    updateActionStatus(setDisplayMessages, toolResult);
  }

  if (toolError) {
    setDisplayMessages((prev) => [...prev, { type: 'assistant', content: `Something went wrong: ${toolResult}` }]);
  }

  messagesRef.current = [...messagesRef.current, { role: 'tool', content: toolResult, toolCallId: toolCall.id }];
};

/**
 * Run a single LLM turn: call the model, process tool calls. Returns
 * true when the loop should stop (no more tool calls or error).
 */
const runAgentTurn = async (currentConfig: AiConfig, ctx: ToolContext, state: AgentState): Promise<boolean> => {
  const { messagesRef, abortRef, setDisplayMessages } = state;
  let result;
  try {
    result = await chatCompletion(currentConfig, messagesRef.current, toolDefinitions);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    setDisplayMessages((prev) => [...prev, { type: 'assistant', content: `Something went wrong: ${errorMsg}` }]);
    return true;
  }

  const assistantMsg: AiChatMessage = {
    role: 'assistant',
    content: result.content ?? '',
    toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
  };
  messagesRef.current = [...messagesRef.current, assistantMsg];

  if (result.content) {
    setDisplayMessages((prev) => [...prev, { type: 'assistant', content: result.content ?? '' }]);
  }

  if (result.toolCalls.length === 0) {
    return true;
  }

  for (const toolCall of result.toolCalls) {
    if (abortRef.current) {
      break;
    }
    await executeToolCall(toolCall, ctx, state);
  }

  return false;
};

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

/* ── Provider component ──────────────────────────────── */

const AiProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();

  const [config, setConfigState] = useState<AiConfig | null>(loadConfig);
  const isEnabled = config !== null;

  const [isOpen, setIsOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<AiDisplayMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  const messagesRef = useRef<AiChatMessage[]>([]);
  const abortRef = useRef<boolean>(false);
  const { cursorTargetId, cursorVisible, moveCursor, resetCursor } = useCursorState();

  const setConfig = useCallback((c: AiConfig): void => {
    saveConfig(c);
    setConfigState(c);
  }, []);

  const removeConfig = useCallback((): void => {
    clearConfig();
    setConfigState(null);
    setDisplayMessages([]);
    messagesRef.current = [];
  }, []);

  const toggleOpen = useCallback((): void => setIsOpen((prev) => !prev), []);

  const stopProcessing = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    resetCursor();
  }, [resetCursor]);

  useStopOnInteraction(isProcessing, stopProcessing);

  const clearConversation = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    setDisplayMessages([]);
    messagesRef.current = [];
    resetCursor();
  }, [resetCursor]);

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
    [getToolContext],
  );

  const sendMessage = useCallback(
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
    [config, isProcessing, runAgentLoop, resetCursor],
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

/* ── Helpers ──────────────────────────────────────────── */

const describeAction = (name: string, args: Record<string, unknown>): string => {
  switch (name) {
    case 'click':
      return `Clicking "${args.id}"`;
    case 'fillInput':
      return `Typing into "${args.id}"`;
    case 'navigate':
      return `Navigating to ${args.path}`;
    case 'queryPage':
      return 'Reading the page';
    case 'queryElement':
      return `Inspecting "${args.id}"`;
    case 'getElementHtml':
      return `Reading HTML of "${args.id}"`;
    case 'getTutorial':
      return `Loading tutorial: ${args.id}`;
    default:
      return name;
  }
};

export { AiProvider, useAi };
