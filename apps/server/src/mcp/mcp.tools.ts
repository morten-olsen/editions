import { z } from 'zod/v4';

import { satisfiesScope } from '../api-keys/api-keys.ts';
import type { ApiKeyScope } from '../api-keys/api-keys.ts';
import { BillingService } from '../billing/billing.ts';
import { ReadinessService } from '../readiness/readiness.ts';
import type { Readiness, ReadinessScope } from '../readiness/readiness.ts';
import type { Services } from '../services/services.ts';

// --- Errors ---

class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpToolError';
  }
}

class UnknownToolError extends McpToolError {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = 'UnknownToolError';
  }
}

class ToolScopeError extends McpToolError {
  constructor(name: string, required: ApiKeyScope, held: ApiKeyScope) {
    super(`Tool "${name}" requires an API key with "${required}" scope; this key has "${held}"`);
    this.name = 'ToolScopeError';
  }
}

// --- Types ---

type ToolContext = {
  services: Services;
  userId: string;
  scope: ApiKeyScope;
};

/**
 * A tool as this codebase defines it — independent of the MCP SDK.
 *
 * Keeping the definition ours means the tool surface is exercisable in tests by
 * calling `callTool` directly, with no HTTP and no SDK involved, and that a
 * change in the SDK's registration API touches one adapter rather than
 * fourteen tools.
 */
type McpTool = {
  name: string;
  title: string;
  description: string;
  /** Minimum API key scope required to see and call this tool. */
  scope: ApiKeyScope;
  /** True when the tool cannot modify anything — surfaced as an MCP annotation. */
  readOnly: boolean;
  /** Zod raw shape; handed to the SDK, which derives the JSON Schema. */
  inputSchema: z.ZodRawShape;
  /** Validates raw arguments, then runs. Never call the underlying handler directly. */
  run: (rawArgs: unknown, ctx: ToolContext) => Promise<unknown>;
};

type DefineToolParams<TShape extends z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  scope: ApiKeyScope;
  readOnly: boolean;
  inputSchema: TShape;
  handler: (args: z.infer<z.ZodObject<TShape>>, ctx: ToolContext) => Promise<unknown>;
};

/**
 * Defines a tool, erasing its argument type at the boundary while keeping full
 * inference inside the handler. Validation happens in `run`, so a tool's
 * handler can trust its arguments however it was reached.
 */
const defineTool = <TShape extends z.ZodRawShape>(params: DefineToolParams<TShape>): McpTool => {
  const schema = z.object(params.inputSchema);

  return {
    name: params.name,
    title: params.title,
    description: params.description,
    scope: params.scope,
    readOnly: params.readOnly,
    inputSchema: params.inputSchema,
    run: async (rawArgs, ctx) => params.handler(schema.parse(rawArgs ?? {}), ctx),
  };
};

// --- Shared building blocks for tool implementations ---

/**
 * The wait budget shared by every tool that kicks off analysis.
 *
 * Capped rather than unbounded because the transport answers with a single JSON
 * response — there is no channel to stream progress on, so a long wait is
 * indistinguishable from a hang to the client. Tools that run out of budget
 * report `state: "analysing"` and let the caller resume with `wait_until_ready`.
 */
const waitSecondsSchema = z
  .number()
  .int()
  .min(0)
  .max(120)
  .default(30)
  .describe('Seconds to wait for analysis to settle before returning. Returns early once ready.');

/** Resolves readiness for a scope — attached to every response carrying analysed data. */
const readinessFor = async (ctx: ToolContext, scope: ReadinessScope = {}): Promise<Readiness> =>
  ctx.services.get(ReadinessService).get({ userId: ctx.userId, scope });

const waitForReadiness = async (ctx: ToolContext, scope: ReadinessScope, waitSeconds: number): Promise<Readiness> => {
  const readiness = ctx.services.get(ReadinessService);
  if (waitSeconds <= 0) {
    return readiness.get({ userId: ctx.userId, scope });
  }
  return readiness.waitUntilReady({ userId: ctx.userId, scope, timeoutMs: waitSeconds * 1000 });
};

/**
 * One sentence telling the agent what to do about the readiness it just got.
 *
 * Shared rather than written per tool so all three states always get the same
 * advice — in particular, that waiting on `stalled` is pointless. An agent that
 * keeps calling `wait_until_ready` against a permanently stuck scope makes no
 * progress and burns its budget on it.
 */
const readinessAdvice = (readiness: Readiness, whenReady: string): string => {
  if (readiness.state === 'ready') {
    return whenReady;
  }
  if (readiness.state === 'analysing') {
    return 'Analysis is still running, so counts and previews are provisional. Call wait_until_ready before drawing conclusions.';
  }
  return (
    `${readiness.pending} article(s) could not be analysed and no job is running, so waiting will not help — ` +
    'usually extraction failing on dead or unreachable links. Everything else is analysed, so carry on; ' +
    'use refresh_sources to retry them.'
  );
};

// --- Registry ---

type ToolRegistry = {
  /** Tools callable with the given key scope. */
  listForScope: (scope: ApiKeyScope) => McpTool[];
  call: (params: { name: string; args: unknown; ctx: ToolContext }) => Promise<unknown>;
};

/**
 * Builds the registry over a fixed tool list.
 *
 * Scope and billing are enforced here rather than in each tool, so there is one
 * place to audit and no way for a new tool to forget. Tools below `write` are
 * exempt from the access check for the same reason reads are ungated over
 * REST — an expired subscription should not hide a user's own data from them.
 */
const createToolRegistry = (tools: McpTool[]): ToolRegistry => {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    listForScope: (scope) => tools.filter((tool) => satisfiesScope(scope, tool.scope)),

    call: async ({ name, args, ctx }) => {
      const tool = byName.get(name);
      if (!tool) {
        throw new UnknownToolError(name);
      }
      if (!satisfiesScope(ctx.scope, tool.scope)) {
        throw new ToolScopeError(name, tool.scope, ctx.scope);
      }
      if (!tool.readOnly) {
        await ctx.services.get(BillingService).assertAccess(ctx.userId);
      }
      return tool.run(args, ctx);
    },
  };
};

export type { McpTool, ToolContext, ToolRegistry };
export {
  defineTool,
  createToolRegistry,
  readinessFor,
  readinessAdvice,
  waitForReadiness,
  waitSecondsSchema,
  McpToolError,
  UnknownToolError,
  ToolScopeError,
};
