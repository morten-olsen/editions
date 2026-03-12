/* ── Agent turn execution ────────────────────────────────
 * Pure async functions for running the LLM agent loop.
 * Extracted from ai.provider.tsx to keep file sizes manageable.
 * ──────────────────────────────────────────────────────── */

import type { AiConfig, AiChatMessage, AiDisplayMessage } from './ai.types.ts';
import { toolDefinitions, executeTool } from './ai.tools.ts';
import { chatCompletion } from './ai.client.ts';
import type { ToolContext } from './ai.tools.ts';

/* ── Types ────────────────────────────────────────────── */

type AgentState = {
  messagesRef: React.MutableRefObject<AiChatMessage[]>;
  abortRef: React.MutableRefObject<boolean>;
  setDisplayMessages: React.Dispatch<React.SetStateAction<AiDisplayMessage[]>>;
  setLastActivity: React.Dispatch<React.SetStateAction<string | null>>;
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

/* ── Tool call execution ──────────────────────────────── */

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

/* ── Agent turn ───────────────────────────────────────── */

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

export type { AgentState };
export { runAgentTurn, describeAction };
