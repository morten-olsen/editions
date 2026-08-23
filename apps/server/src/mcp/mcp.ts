import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiKeyScope } from '../api-keys/api-keys.ts';
import type { Services } from '../services/services.ts';

import { SERVER_INSTRUCTIONS } from './mcp.instructions.ts';
import { guideByUri, guides } from './mcp.resources.ts';
import { createToolRegistry } from './mcp.tools.ts';
import type { McpTool, ToolContext, ToolRegistry } from './mcp.tools.ts';
import { editionTools } from './mcp.tools.editions.ts';
import { focusTools } from './mcp.tools.focuses.ts';
import { ingestTools } from './mcp.tools.ingest.ts';
import { sourceTools } from './mcp.tools.sources.ts';
import { voteTools } from './mcp.tools.votes.ts';
import { workspaceTools } from './mcp.tools.workspace.ts';

// --- Constants ---

const SERVER_NAME = 'editions';
const SERVER_VERSION = '0.0.1';

/**
 * The complete tool surface, in the order an agent would naturally work through
 * it: orient, then sources, then focuses, then editions.
 */
const allTools: McpTool[] = [
  ...workspaceTools,
  ...sourceTools,
  ...ingestTools,
  ...focusTools,
  ...voteTools,
  ...editionTools,
];

const toolRegistry: ToolRegistry = createToolRegistry(allTools);

// --- SDK adapter ---

type BuildServerParams = {
  services: Services;
  userId: string;
  scope: ApiKeyScope;
};

/**
 * Serialises a tool result for the wire.
 *
 * Compact JSON, not pretty-printed: indentation is pure token cost to the model
 * reading it, and no human reads this directly. The same object also goes out as
 * `structuredContent` for clients that can use it.
 */
const toCallResult = (
  result: unknown,
): { content: [{ type: 'text'; text: string }]; structuredContent?: Record<string, unknown> } => {
  const text = JSON.stringify(result ?? null);
  const isPlainObject = typeof result === 'object' && result !== null && !Array.isArray(result);
  return {
    content: [{ type: 'text', text }],
    ...(isPlainObject ? { structuredContent: result as Record<string, unknown> } : {}),
  };
};

const errorResult = (err: unknown): { content: [{ type: 'text'; text: string }]; isError: true } => ({
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
  isError: true,
});

/**
 * Builds an MCP server bound to one authenticated user.
 *
 * A fresh instance per request, because the transport runs stateless and the
 * user identity has to be baked in — closing over `ctx` is what keeps every
 * tool scoped to its caller without any tool having to remember to filter by
 * user. Registration is object allocation, so the per-request cost is trivial.
 *
 * Only tools the key's scope permits are registered, so a read-only key does
 * not merely fail on write tools, it never advertises them.
 */
const buildMcpServer = ({ services, userId, scope }: BuildServerParams): McpServer => {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });

  const ctx: ToolContext = { services, userId, scope };

  for (const tool of toolRegistry.listForScope(scope)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.readOnly,
          destructiveHint: tool.name === 'delete_entity',
          idempotentHint: tool.readOnly,
          openWorldHint: tool.name === 'inspect_feed' || tool.name === 'add_sources',
        },
      },
      async (args: unknown) => {
        try {
          return toCallResult(await toolRegistry.call({ name: tool.name, args, ctx }));
        } catch (err) {
          // Surfaced as a tool-level error rather than a protocol error so the
          // agent can read the message and correct itself, instead of the call
          // failing opaquely.
          return errorResult(err);
        }
      },
    );
  }

  for (const guide of guides) {
    server.registerResource(
      guide.name,
      guide.uri,
      { title: guide.title, description: guide.description, mimeType: 'text/markdown' },
      async (uri) => {
        const found = guideByUri.get(uri.href);
        if (!found) {
          throw new Error(`Unknown guide: ${uri.href}`);
        }
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: found.text }] };
      },
    );
  }

  return server;
};

export type { BuildServerParams };
export { allTools, buildMcpServer, toolRegistry, SERVER_NAME, SERVER_VERSION };
