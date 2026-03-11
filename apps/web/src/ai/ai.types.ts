/* ── AI Assistant types ────────────────────────────────── */

type AiConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

/* ── Page descriptor ──────────────────────────────────── */

type AiNode = {
  id: string;
  role: string;
  label?: string;
  value?: string;
  state?: string;
  error?: string;
  items?: number;
  depth_available?: number;
  children?: AiNode[];
};

type AiPageDescriptor = {
  route: string;
  title?: string;
  errors: AiNode[];
  nodes: AiNode[];
};

/* ── Chat messages ────────────────────────────────────── */

type AiToolCall = {
  id: string;
  name: string;
  arguments: string;
};

type AiToolResult = {
  toolCallId: string;
  result: string;
};

type AiChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AiToolCall[] }
  | { role: "tool"; content: string; toolCallId: string };

/* ── Display messages (what shows in the chat UI) ─────── */

type AiDisplayMessage =
  | { type: "user"; content: string }
  | { type: "assistant"; content: string }
  | { type: "action"; description: string; status: "running" | "done" | "error" };

/* ── Tool definitions ─────────────────────────────────── */

type AiToolParameter = {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
};

type AiToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, AiToolParameter>;
    required?: string[];
  };
};

/* ── Chat state ───────────────────────────────────────── */

type AiChatState = {
  messages: AiChatMessage[];
  displayMessages: AiDisplayMessage[];
  isProcessing: boolean;
};

export type {
  AiConfig,
  AiNode,
  AiPageDescriptor,
  AiToolCall,
  AiToolResult,
  AiChatMessage,
  AiDisplayMessage,
  AiToolParameter,
  AiToolDefinition,
  AiChatState,
};
