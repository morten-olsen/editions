import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApiKeysService } from '../api-keys/api-keys.ts';
import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

let t: TestContext;

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(async () => {
  await t.stop();
});

const mint = async (
  headers: { authorization: string },
  body: Record<string, unknown> = {},
): Promise<{ id: string; key: string; scope: string; keyPrefix: string }> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/api-keys',
    headers,
    payload: { name: 'test key', ...body },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body);
};

describe('api key management', () => {
  it('mints a key and returns the secret exactly once', async () => {
    const { headers } = await t.register();

    const created = await mint(headers);
    expect(created.key).toMatch(/^ek_[\w-]+_[\w-]+$/);
    expect(created.scope).toBe('write');

    const list = await t.inject({ method: 'GET', url: '/api/api-keys', headers });
    const keys = JSON.parse(list.body) as Record<string, unknown>[];

    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toHaveProperty('key');
    expect(keys[0]?.keyPrefix).toBe(created.keyPrefix);
  });

  it('stores only a hash of the secret', async () => {
    const { headers } = await t.register();
    const created = await mint(headers);

    const db = await t.db();
    const row = await db.selectFrom('api_keys').select(['key_hash']).executeTakeFirstOrThrow();

    expect(row.key_hash).not.toContain(created.key);
    expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a valid key and rejects a tampered one', async () => {
    const { headers } = await t.register();
    const created = await mint(headers);
    const service = t.services.get(ApiKeysService);

    const verified = await service.verify(created.key);
    expect(verified.scope).toBe('write');

    await expect(service.verify(`${created.key}x`)).rejects.toThrow(/Invalid API key/);
    await expect(service.verify('not-a-key')).rejects.toThrow(/Invalid API key/);
  });

  // The secret is base64url, whose alphabet includes the `_` used as the field
  // separator — roughly half of all generated keys contain one. Minting a batch
  // catches a parser that splits on every separator instead of the first two.
  it('verifies keys whose secret contains the separator character', async () => {
    const { headers } = await t.register();
    const service = t.services.get(ApiKeysService);

    const created = await Promise.all(Array.from({ length: 25 }, () => mint(headers)));
    expect(created.some((c) => c.key.slice(c.key.indexOf('_', 3) + 1).includes('_'))).toBe(true);

    for (const key of created) {
      await expect(service.verify(key.key)).resolves.toMatchObject({ scope: 'write' });
    }
  });

  it('rejects a revoked key', async () => {
    const { headers } = await t.register();
    const created = await mint(headers);

    const res = await t.inject({ method: 'DELETE', url: `/api/api-keys/${created.id}`, headers });
    expect(res.statusCode).toBe(204);

    await expect(t.services.get(ApiKeysService).verify(created.key)).rejects.toThrow(/Invalid API key/);
  });

  it('rejects an expired key', async () => {
    const { headers } = await t.register();
    const created = await mint(headers, { expiresAt: new Date(Date.now() - 1000).toISOString() });

    await expect(t.services.get(ApiKeysService).verify(created.key)).rejects.toThrow(/Invalid API key/);
  });

  it('does not let one user revoke another user’s key', async () => {
    const owner = await t.register('owner', 'password123');
    const other = await t.register('other', 'password456');
    const created = await mint(owner.headers);

    const res = await t.inject({
      method: 'DELETE',
      url: `/api/api-keys/${created.id}`,
      headers: other.headers,
    });

    expect(res.statusCode).toBe(404);
    await expect(t.services.get(ApiKeysService).verify(created.key)).resolves.toMatchObject({
      userId: owner.id,
    });
  });

  it('requires a JWT — an API key cannot mint another API key', async () => {
    const { headers } = await t.register();
    const created = await mint(headers);

    const res = await t.inject({
      method: 'POST',
      url: '/api/api-keys',
      headers: { authorization: `Bearer ${created.key}` },
      payload: { name: 'escalation attempt', scope: 'admin' },
    });

    expect(res.statusCode).toBe(401);
  });
});
