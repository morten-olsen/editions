import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { createApiKeyHook } from '../api-keys/api-keys.middleware.ts';
import { buildMcpServer } from '../mcp/mcp.ts';
import type { Services } from '../services/services.ts';

// --- Constants ---

const MCP_PATH = '/mcp';

/**
 * The Streamable HTTP spec has clients advertise both media types on POST, and
 * the SDK enforces it. Plenty of clients — and anyone reaching for curl — send
 * only `application/json`, and the resulting 406 gives no hint as to why. Since
 * this server always answers with JSON, widening the header costs nothing and
 * removes a confusing failure.
 */
const REQUIRED_ACCEPT = 'application/json, text/event-stream';

const ensureAcceptHeader = (req: FastifyRequest): void => {
  const accept = req.headers.accept ?? '';
  if (!accept.includes('text/event-stream') || !accept.includes('application/json')) {
    req.raw.headers.accept = REQUIRED_ACCEPT;
  }
};

// --- Handler ---

/**
 * Serves one MCP request.
 *
 * Stateless: a transport and server are built per request and discarded. That
 * suits a tool-only server — there is no subscription or sampling state worth
 * keeping — and it means the authenticated user can be closed over at
 * construction rather than threaded through every call.
 *
 * `enableJsonResponse` turns off SSE, so the reply is a single JSON body. The
 * cost is that tools cannot report progress mid-call, which is why every
 * waiting tool takes a bounded `waitSeconds` and reports readiness instead.
 */
const handleMcpRequest = async (services: Services, req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  ensureAcceptHeader(req);

  const server = buildMcpServer({
    services,
    userId: req.apiKey.userId,
    scope: req.apiKey.scope,
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // Fastify must not also try to write a reply once the transport owns the socket.
  reply.hijack();

  reply.raw.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    // `req.body` is already parsed by Fastify; handing it over avoids the transport
    // trying to re-read a consumed stream.
    await transport.handleRequest(req.raw, reply.raw, req.body);
  } catch (err) {
    // Past `hijack()` Fastify's error handler is out of the picture, so an
    // unwritten reply here would leave the client hanging until it times out
    // rather than failing. Write the JSON-RPC error ourselves.
    req.log.error({ err }, 'MCP request failed');
    if (!reply.raw.headersSent) {
      reply.raw.writeHead(500, { 'content-type': 'application/json' });
      reply.raw.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        }),
      );
    } else {
      reply.raw.end();
    }
  }
};

// --- Routes ---

const createMcpRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    // Scope is checked per tool inside the registry, not here — a read-only key
    // is a legitimate MCP client, it just sees fewer tools.
    const authenticateApiKey = createApiKeyHook(services, { minScope: 'read' });

    fastify.route({
      method: 'POST',
      url: MCP_PATH,
      onRequest: authenticateApiKey,
      // Hidden from the OpenAPI document: the body is JSON-RPC, which the schema
      // generator cannot describe usefully, and the web client never calls it.
      schema: { hide: true },
      handler: async (req, reply) => {
        await handleMcpRequest(services, req, reply);
      },
    });

    // The spec's GET (server-initiated SSE) and DELETE (session teardown) only
    // apply to stateful sessions. Answer explicitly rather than letting these
    // fall through to the SPA catch-all as a confusing 200 of index.html.
    for (const method of ['GET', 'DELETE'] as const) {
      fastify.route({
        method,
        url: MCP_PATH,
        schema: { hide: true },
        handler: async (_req, reply) => {
          return reply
            .code(405)
            .header('Allow', 'POST')
            .send({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'This MCP server is stateless; only POST is supported.' },
              id: null,
            });
        },
      });
    }
  };

export { createMcpRoutes, MCP_PATH };
