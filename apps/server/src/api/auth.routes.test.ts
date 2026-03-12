import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

let t: TestContext;

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(async () => {
  await t.stop();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns a token', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.token).toBeDefined();
    expect(body.role).toBe('admin');
  });

  it('promotes first user to admin, second to user', async () => {
    const first = await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });
    const second = await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob', password: 'password456' },
    });

    expect(JSON.parse(first.body).role).toBe('admin');
    expect(JSON.parse(second.body).role).toBe('user');
  });

  it('rejects duplicate username', async () => {
    await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'password123' },
    });
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'different1' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'alice', password: 'short' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    await t.register('alice', 'password123');
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    await t.register('alice', 'password123');
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects unknown username', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user for valid token', async () => {
    const { headers } = await t.register('alice', 'password123');
    const res = await t.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.username).toBe('alice');
    expect(body.role).toBe('admin');
  });

  it('rejects missing token', async () => {
    const res = await t.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid token', async () => {
    const res = await t.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer garbage' },
    });

    expect(res.statusCode).toBe(401);
  });
});
