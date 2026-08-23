import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

let t: TestContext;

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(async () => {
  await t.stop();
});

const mintKey = async (scope: 'read' | 'write' | 'admin' = 'admin'): Promise<string> => {
  const { headers } = await t.register();
  const res = await t.inject({
    method: 'POST',
    url: '/api/api-keys',
    headers,
    payload: { name: `${scope} key`, scope },
  });
  return (JSON.parse(res.body) as { key: string }).key;
};

type JsonRpcResponse = {
  jsonrpc: string;
  id: number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

const rpc = async (
  key: string | null,
  payload: Record<string, unknown>,
  accept = 'application/json, text/event-stream',
): Promise<{ statusCode: number; body: JsonRpcResponse }> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/mcp',
    headers: {
      'content-type': 'application/json',
      accept,
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    payload,
  });

  let body: JsonRpcResponse;
  try {
    body = JSON.parse(res.body) as JsonRpcResponse;
  } catch {
    body = { jsonrpc: '2.0', id: null };
  }
  return { statusCode: res.statusCode, body };
};

const initialize = (key: string): Promise<{ statusCode: number; body: JsonRpcResponse }> =>
  rpc(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  });

describe('MCP transport', () => {
  it('completes the initialize handshake and returns server instructions', async () => {
    const key = await mintKey();
    const { statusCode, body } = await initialize(key);

    expect(statusCode).toBe(200);
    expect(body.result?.serverInfo).toMatchObject({ name: 'editions' });
    expect(String(body.result?.instructions)).toContain('Readiness');
  });

  it('lists tools with usable JSON Schema', async () => {
    const key = await mintKey();
    const { body } = await rpc(key, { jsonrpc: '2.0', id: 2, method: 'tools/list' });

    const tools = body.result?.tools as { name: string; description: string; inputSchema: object }[];
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('get_workspace');
    expect(names).toContain('preview_focus');
    expect(names).toContain('delete_entity');

    const previewFocus = tools.find((tool) => tool.name === 'preview_focus');
    expect(previewFocus?.inputSchema).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({ focusId: expect.anything() }),
      required: ['focusId'],
    });
  });

  it('hides out-of-scope tools from a read-only key', async () => {
    const key = await mintKey('read');
    const { body } = await rpc(key, { jsonrpc: '2.0', id: 2, method: 'tools/list' });

    const names = (body.result?.tools as { name: string }[]).map((tool) => tool.name);

    expect(names).toContain('get_workspace');
    expect(names).not.toContain('add_sources');
    expect(names).not.toContain('delete_entity');
  });

  it('calls a tool and returns both text and structured content', async () => {
    const key = await mintKey();
    const { body } = await rpc(key, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_workspace', arguments: {} },
    });

    const result = body.result as {
      isError?: boolean;
      content: { type: string; text: string }[];
      structuredContent: { readiness: { state: string }; sources: { total: number } };
    };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.readiness.state).toBe('ready');
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toMatchObject({ sources: { total: 0 } });
  });

  it('reports a scope violation as a readable tool error, not a crash', async () => {
    const key = await mintKey('read');
    const { body } = await rpc(key, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'delete_entity', arguments: { type: 'source', id: 'x', confirm: true } },
    });

    // The tool is not registered for this key at all, so the SDK rejects the call.
    expect(body.error ?? (body.result as { isError?: boolean })?.isError).toBeTruthy();
  });

  it('exposes the guide resources', async () => {
    const key = await mintKey();
    const list = await rpc(key, { jsonrpc: '2.0', id: 5, method: 'resources/list' });
    const uris = (list.body.result?.resources as { uri: string }[]).map((r) => r.uri);

    expect(uris).toEqual(
      expect.arrayContaining(['editions://guide/focuses', 'editions://guide/editions', 'editions://guide/readiness']),
    );

    const read = await rpc(key, {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/read',
      params: { uri: 'editions://guide/readiness' },
    });
    const contents = read.body.result?.contents as { text: string }[];
    expect(contents[0]?.text).toContain('pendingClassification');
  });

  // Past reply.hijack() Fastify's error handler no longer applies, so a throw
  // inside the transport would hang the client rather than fail it.
  it('answers rather than hangs when the transport throws', async () => {
    const key = await mintKey();
    const { statusCode, body } = await rpc(key, { jsonrpc: '2.0', id: 9, method: 'tools/call' });

    expect(statusCode).toBeGreaterThanOrEqual(200);
    expect(body.error ?? body.result).toBeDefined();
  });

  it('tolerates a client that only accepts application/json', async () => {
    const key = await mintKey();
    const { statusCode, body } = await rpc(
      key,
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'curl', version: '1' } },
      },
      'application/json',
    );

    expect(statusCode).toBe(200);
    expect(body.result?.serverInfo).toMatchObject({ name: 'editions' });
  });
});

describe('MCP auth', () => {
  it('rejects a missing key with a WWW-Authenticate challenge', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/mcp',
      headers: { 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toContain('Bearer');
  });

  it('rejects an invalid key', async () => {
    const { statusCode } = await rpc('ek_deadbeef_nope', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(statusCode).toBe(401);
  });

  it('rejects a JWT — MCP requires an API key', async () => {
    const { token } = await t.register();
    const { statusCode } = await rpc(token, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(statusCode).toBe(401);
  });

  it('answers GET and DELETE with 405', async () => {
    for (const method of ['GET', 'DELETE'] as const) {
      const res = await t.inject({ method, url: '/api/mcp' });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('POST');
    }
  });

  it('scopes tool results to the key’s owner', async () => {
    const alice = await t.register('alice', 'password123');
    const bob = await t.register('bob', 'password456');

    const keyRes = await t.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: alice.headers,
      payload: { name: 'alice key', scope: 'admin' },
    });
    const aliceKey = (JSON.parse(keyRes.body) as { key: string }).key;

    const db = await t.db();
    await db
      .insertInto('sources')
      .values({
        id: 'bob-source',
        user_id: bob.id,
        type: 'rss',
        name: 'Bob only',
        url: 'https://bob.example/feed.xml',
        config: '{}',
        direction: 'newest',
      })
      .execute();

    const { body } = await rpc(aliceKey, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'get_workspace', arguments: {} },
    });

    expect(JSON.stringify(body.result)).not.toContain('Bob only');
  });
});
