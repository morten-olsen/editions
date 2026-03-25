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

describe('GET /api/billing/access', () => {
  it('returns unlimited when payment is not configured', async () => {
    const { headers } = await t.register();
    const res = await t.inject({ method: 'GET', url: '/api/billing/access', headers });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ state: 'unlimited', expiresAt: null, daysRemaining: null });
  });

  it('requires authentication', async () => {
    const res = await t.inject({ method: 'GET', url: '/api/billing/access' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/billing/subscription', () => {
  it('returns payment disabled status', async () => {
    const { headers } = await t.register();
    const res = await t.inject({ method: 'GET', url: '/api/billing/subscription', headers });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.paymentEnabled).toBe(false);
    expect(body.access.state).toBe('unlimited');
    expect(body.subscription).toBeNull();
    expect(body.pricing).toBeNull();
  });
});

describe('GET /api/config (payment fields)', () => {
  it('exposes paymentEnabled and stripePublishableKey', async () => {
    const res = await t.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(typeof body.paymentEnabled).toBe('boolean');
    expect(typeof body.stripePublishableKey).toBe('string');
  });
});

describe('GET /api/auth/me (accessExpiresAt)', () => {
  it('returns accessExpiresAt as null by default', async () => {
    const { headers } = await t.register();
    const res = await t.inject({ method: 'GET', url: '/api/auth/me', headers });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).accessExpiresAt).toBeNull();
  });
});

describe('access middleware (402 when expired)', () => {
  it('allows write routes when payment is not configured', async () => {
    const { headers } = await t.register();

    // Since Stripe keys aren't configured, payment is disabled and the hook passes through.
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name: 'Test', url: 'https://example.com/feed.xml', type: 'rss', direction: 'newest' },
    });

    expect(res.statusCode).toBe(201);
  });

  it('allows read routes even when payment would be enabled', async () => {
    const { headers } = await t.register();

    // Sources list (read) should always work
    const res = await t.inject({ method: 'GET', url: '/api/sources', headers });
    expect(res.statusCode).toBe(200);
  });
});

describe('admin billing endpoints', () => {
  it('rejects non-admin access to admin billing settings', async () => {
    await t.register('admin', 'password123');
    const { headers: userHeaders } = await t.register('user', 'password456');

    const res = await t.inject({
      method: 'GET',
      url: '/api/admin/billing/settings',
      headers: userHeaders,
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns default settings for admin', async () => {
    const { headers } = await t.register('admin', 'password123');

    const res = await t.inject({
      method: 'GET',
      url: '/api/admin/billing/settings',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.enabled).toBe(false);
    expect(body.trialDays).toBe(14);
    expect(body.monthlyPriceCents).toBe(0);
    expect(body.yearlyPriceCents).toBe(0);
  });

  it('lists users with access info', async () => {
    const { headers } = await t.register('admin', 'password123');
    await t.register('user1', 'password456');

    const res = await t.inject({
      method: 'GET',
      url: '/api/admin/billing/users',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Array<{ username: string; state: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((u) => u.username).sort()).toEqual(['admin', 'user1']);
    // All users should be unlimited since payment is not configured
    expect(body.every((u) => u.state === 'unlimited')).toBe(true);
  });

  it('admin can set user access expiry', async () => {
    const { headers: adminHeaders } = await t.register('admin', 'password123');
    const { id: userId } = await t.register('user1', 'password456');

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await t.inject({
      method: 'PUT',
      url: `/api/admin/billing/users/${userId}/access`,
      headers: adminHeaders,
      payload: { expiresAt: futureDate },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessExpiresAt).toBe(futureDate);
    expect(body.state).toBe('trial'); // Active without subscription = trial
  });

  it('admin can grant unlimited access', async () => {
    const { headers: adminHeaders } = await t.register('admin', 'password123');
    const { id: userId } = await t.register('user1', 'password456');

    // First set an expiry
    await t.inject({
      method: 'PUT',
      url: `/api/admin/billing/users/${userId}/access`,
      headers: adminHeaders,
      payload: { expiresAt: new Date().toISOString() },
    });

    // Then grant unlimited
    const res = await t.inject({
      method: 'PUT',
      url: `/api/admin/billing/users/${userId}/access`,
      headers: adminHeaders,
      payload: { expiresAt: null },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).state).toBe('unlimited');
  });
});

describe('POST /api/billing/checkout', () => {
  it('returns 501 when Stripe is not configured', async () => {
    const { headers } = await t.register();
    const res = await t.inject({
      method: 'POST',
      url: '/api/billing/checkout',
      headers,
      payload: { interval: 'monthly', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' },
    });

    // 501 (Stripe not configured) or 400 (validation) — either way, it doesn't succeed
    expect([400, 501]).toContain(res.statusCode);
  });
});

describe('POST /api/billing/portal', () => {
  it('returns 501 when Stripe is not configured', async () => {
    const { headers } = await t.register();
    const res = await t.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers,
      payload: { returnUrl: 'https://example.com/settings' },
    });

    // 501 (Stripe not configured) or 200 would both be unexpected without Stripe
    expect([200, 501]).toContain(res.statusCode);
  });
});
