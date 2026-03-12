/* ── OpenAI-compatible chat completions client ────────────
 * Sends messages to the user's configured provider.
 * Supports tool calling via the standard OpenAI format.
 * ──────────────────────────────────────────────────────── */

import type { AiConfig, AiChatMessage, AiToolCall, AiToolDefinition } from './ai.types.ts';

type CompletionChoice = {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: {
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }[];
  };
  finish_reason: string;
};

type CompletionResponse = {
  choices: CompletionChoice[];
};

type ChatCompletionResult = {
  content: string | null;
  toolCalls: AiToolCall[];
  finishReason: string;
};

const formatMessages = (messages: AiChatMessage[]): unknown[] =>
  messages.map((msg) => {
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.toolCallId,
      };
    }
    return { role: msg.role, content: msg.content };
  });

const formatTools = (tools: AiToolDefinition[]): unknown[] =>
  tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

const chatCompletion = async (
  config: AiConfig,
  messages: AiChatMessage[],
  tools: AiToolDefinition[],
): Promise<ChatCompletionResult> => {
  const url = `${config.endpoint.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: formatMessages(messages),
      tools: formatTools(tools),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI provider error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as CompletionResponse;
  const choice = data.choices[0];
  if (!choice) {
    throw new Error('No response from AI provider');
  }

  const toolCalls: AiToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  return {
    content: choice.message.content,
    toolCalls,
    finishReason: choice.finish_reason,
  };
};

export type { ChatCompletionResult };
export { chatCompletion };
