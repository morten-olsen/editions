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

/* ── Provider component ──────────────────────────────── */

const AiProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const queryClient = useQueryClient();
  const routerNavigate = useNavigate();

  // Config state
  const [config, setConfigState] = useState<AiConfig | null>(loadConfig);
  const isEnabled = config !== null;

  // Chat UI state
  const [isOpen, setIsOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<AiDisplayMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cursor state
  const [cursorTargetId, setCursorTargetId] = useState<string | null>(null);
  const [cursorVisible, setCursorVisible] = useState(false);

  // Activity status (shown in the floating pill)
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  // Conversation history (full LLM context)
  const messagesRef = useRef<AiChatMessage[]>([]);
  const abortRef = useRef<boolean>(false);

  const setConfig = useCallback((newConfig: AiConfig): void => {
    saveConfig(newConfig);
    setConfigState(newConfig);
  }, []);

  const removeConfig = useCallback((): void => {
    clearConfig();
    setConfigState(null);
    setDisplayMessages([]);
    messagesRef.current = [];
  }, []);

  const toggleOpen = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  const stopProcessing = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    setCursorVisible(false);
    setCursorTargetId(null);
  }, []);

  // Stop agent on any user interaction (click or keypress)
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

  const clearConversation = useCallback((): void => {
    abortRef.current = true;
    setIsProcessing(false);
    setLastActivity(null);
    setDisplayMessages([]);
    messagesRef.current = [];
    setCursorVisible(false);
    setCursorTargetId(null);
  }, []);

  // Cursor movement with a short animation delay
  const moveCursor = useCallback(
    (targetId: string): Promise<void> =>
      new Promise<void>((resolve) => {
        setCursorVisible(true);
        setCursorTargetId(targetId);
        // Wait for cursor animation to complete
        setTimeout(resolve, 300);
      }),
    [],
  );

  // Build tool context
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

  // Agent loop: send to LLM, execute tools, repeat
  const runAgentLoop = useCallback(
    async (currentConfig: AiConfig): Promise<void> => {
      const maxIterations = 20;
      let iterations = 0;

      while (iterations < maxIterations) {
        if (abortRef.current) {
          break;
        }
        iterations++;
        setTurnCount(iterations);

        let result;
        try {
          result = await chatCompletion(currentConfig, messagesRef.current, toolDefinitions);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setDisplayMessages((prev) => [...prev, { type: 'assistant', content: `Something went wrong: ${errorMsg}` }]);
          break;
        }

        // Add assistant message to history
        const assistantMsg: AiChatMessage = {
          role: 'assistant',
          content: result.content ?? '',
          toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
        };
        messagesRef.current = [...messagesRef.current, assistantMsg];

        // Show text content in chat
        if (result.content) {
          setDisplayMessages((prev) => [...prev, { type: 'assistant', content: result.content! }]);
        }

        // If no tool calls, we're done
        if (result.toolCalls.length === 0) {
          break;
        }

        // Execute tools
        const ctx = getToolContext();
        let toolError = false;
        for (const toolCall of result.toolCalls) {
          if (abortRef.current) {
            break;
          }
          const toolName = toolCall.name;
          const isVisualAction = toolName === 'click' || toolName === 'fillInput' || toolName === 'navigate';

          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.arguments) as Record<string, unknown>;
          } catch {
            const errResult = JSON.stringify({ error: `Invalid tool arguments: ${toolCall.arguments}` });
            messagesRef.current = [
              ...messagesRef.current,
              { role: 'tool', content: errResult, toolCallId: toolCall.id },
            ];
            continue;
          }

          // Update activity status for the floating pill
          const description = describeAction(toolName, toolArgs);
          setLastActivity(description);

          // Show action in chat for visual actions
          if (isVisualAction) {
            setDisplayMessages((prev) => [...prev, { type: 'action', description, status: 'running' }]);
          }

          let toolResult: string;
          try {
            toolResult = await executeTool(toolName, toolArgs, ctx);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            toolResult = JSON.stringify({ error: `Tool "${toolName}" failed: ${errorMsg}` });
            toolError = true;
          }

          // Update action status
          if (isVisualAction) {
            setDisplayMessages((prev) => {
              const updated = [...prev];
              let lastAction = -1;
              for (let i = updated.length - 1; i >= 0; i--) {
                if (
                  updated[i]!.type === 'action' &&
                  (updated[i] as AiDisplayMessage & { type: 'action' }).status === 'running'
                ) {
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
          }

          // Surface tool errors in the chat
          if (toolError) {
            setDisplayMessages((prev) => [
              ...prev,
              { type: 'assistant', content: `Something went wrong: ${toolResult}` },
            ]);
          }

          // Add tool result to conversation
          const toolMsg: AiChatMessage = {
            role: 'tool',
            content: toolResult,
            toolCallId: toolCall.id,
          };
          messagesRef.current = [...messagesRef.current, toolMsg];
        }

        // Keep showing the last tool description while waiting for the next LLM response
      }
    },
    [getToolContext],
  );

  const sendMessage = useCallback(
    (content: string): void => {
      if (!config || isProcessing) {
        return;
      }

      // Reset abort flag
      abortRef.current = false;

      // Add user message to display and history
      setDisplayMessages((prev) => [...prev, { type: 'user', content }]);

      // Build system message if first message
      if (messagesRef.current.length === 0) {
        messagesRef.current = [{ role: 'system', content: buildSystemPrompt() }];
      }

      // Inject current page context with user message
      const pageContext = queryPage(1);
      const enrichedContent = `${content}\n\n[Current page: ${pageContext.route}]\n${JSON.stringify(pageContext, null, 2)}`;

      messagesRef.current = [...messagesRef.current, { role: 'user', content: enrichedContent }];

      setIsProcessing(true);
      setLastActivity('Thinking...');
      setTurnCount(0);

      void runAgentLoop(config).finally(() => {
        setIsProcessing(false);
        setLastActivity(null);
        setTurnCount(0);
        setCursorVisible(false);
        setCursorTargetId(null);
      });
    },
    [config, isProcessing, runAgentLoop],
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
