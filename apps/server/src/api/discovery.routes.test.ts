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

// --- Helpers ---

const authed = async (): Promise<{ authorization: string }> => {
  const { headers } = await t.register();
  return headers;
};

// --- Browse tests ---

describe('GET /api/discovery/sources', () => {
  it('returns the source catalog', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { items: Record<string, unknown>[]; total: number; offset: number; limit: number };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.offset).toBe(0);

    const first = body.items[0]!;
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('url');
    expect(first).toHaveProperty('tags');
    expect(first).toHaveProperty('adopted');
    expect(first.adopted).toBe(false);
  });

  it('rejects unauthenticated request', async () => {
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/discovery/focuses', () => {
  it('returns the focus catalog', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/focuses',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { items: Record<string, unknown>[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);

    const first = body.items[0]!;
    expect(first).toHaveProperty('sources');
    expect(first.adopted).toBe(false);
  });
});

describe('GET /api/discovery/edition-configs', () => {
  it('returns the edition config catalog', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/edition-configs',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { items: Record<string, unknown>[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);

    const first = body.items[0]!;
    expect(first).toHaveProperty('focuses');
    expect(first.adopted).toBe(false);
  });
});

// --- Search, filter, pagination tests ---

describe('discovery query params', () => {
  it('filters sources by search term', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources?search=hacker',
      headers,
    });

    const body = JSON.parse(res.body) as { items: { name: string }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((s) => s.name.toLowerCase().includes('hacker'))).toBe(true);
  });

  it('filters sources by tag', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources?tag=indie',
      headers,
    });

    const body = JSON.parse(res.body) as { items: { tags: string[] }[]; total: number };
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((s) => s.tags.includes('indie'))).toBe(true);
  });

  it('paginates sources', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources?limit=3&offset=0',
      headers,
    });

    const body = JSON.parse(res.body) as { items: unknown[]; total: number; offset: number; limit: number };
    expect(body.items.length).toBe(3);
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(3);
    expect(body.total).toBeGreaterThan(3);

    // Second page
    const res2 = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources?limit=3&offset=3',
      headers,
    });
    const body2 = JSON.parse(res2.body) as { items: unknown[]; offset: number };
    expect(body2.items.length).toBe(3);
    expect(body2.offset).toBe(3);
  });

  it('combines search and tag filters', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources?search=technology&tag=indie',
      headers,
    });

    const body = JSON.parse(res.body) as { items: { tags: string[]; description: string; name: string }[]; total: number };
    for (const item of body.items) {
      expect(item.tags.includes('indie')).toBe(true);
      const text = `${item.name} ${item.description}`.toLowerCase();
      expect(text).toContain('technology');
    }
  });

  it('returns available tags', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/tags',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const tags = JSON.parse(res.body) as string[];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).toContain('indie');
    expect(tags).toContain('technology');
    // Should be sorted
    expect(tags).toEqual([...tags].sort());
  });
});

// --- Adopt source tests ---

describe('POST /api/discovery/sources/:id/adopt', () => {
  it('creates a source from the catalog', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/ars-technica/adopt',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.sourceId).toBeTruthy();
    expect(body.created).toBe(true);
  });

  it('returns existing source on duplicate adopt', async () => {
    const headers = await authed();

    const res1 = await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/ars-technica/adopt',
      headers,
    });
    const body1 = JSON.parse(res1.body) as Record<string, unknown>;

    const res2 = await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/ars-technica/adopt',
      headers,
    });
    const body2 = JSON.parse(res2.body) as Record<string, unknown>;

    expect(body2.created).toBe(false);
    expect(body2.sourceId).toBe(body1.sourceId);
  });

  it('marks source as adopted in listing', async () => {
    const headers = await authed();

    await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/ars-technica/adopt',
      headers,
    });

    const res = await t.inject({
      method: 'GET',
      url: '/api/discovery/sources',
      headers,
    });

    const page = JSON.parse(res.body) as { items: { id: string; adopted: boolean }[] };
    const ars = page.items.find((s) => s.id === 'ars-technica');
    expect(ars?.adopted).toBe(true);
  });

  it('returns 404 for unknown source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/nonexistent/adopt',
      headers,
    });
    expect(res.statusCode).toBe(404);
  });
});

// --- Adopt focus tests ---

describe('POST /api/discovery/focuses/:id/adopt', () => {
  it('creates focus and its sources', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/focuses/technology/adopt',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.focusId).toBeTruthy();
    expect(body.created).toBe(true);
    expect((body.sourcesCreated as number)).toBeGreaterThan(0);

    // Verify the sources were actually created
    const sourcesRes = await t.inject({
      method: 'GET',
      url: '/api/sources',
      headers,
    });
    const sources = JSON.parse(sourcesRes.body) as unknown[];
    expect(sources.length).toBeGreaterThan(0);
  });

  it('deduplicates on second adopt', async () => {
    const headers = await authed();

    const res1 = await t.inject({
      method: 'POST',
      url: '/api/discovery/focuses/technology/adopt',
      headers,
    });
    const body1 = JSON.parse(res1.body) as Record<string, unknown>;

    const res2 = await t.inject({
      method: 'POST',
      url: '/api/discovery/focuses/technology/adopt',
      headers,
    });
    const body2 = JSON.parse(res2.body) as Record<string, unknown>;

    expect(body2.created).toBe(false);
    expect(body2.focusId).toBe(body1.focusId);
  });

  it('reuses existing sources by URL', async () => {
    const headers = await authed();

    // First adopt a source directly
    await t.inject({
      method: 'POST',
      url: '/api/discovery/sources/ars-technica/adopt',
      headers,
    });

    // Now adopt a focus that includes ars-technica
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/focuses/technology/adopt',
      headers,
    });
    const body = JSON.parse(res.body) as Record<string, unknown>;

    // Should have created fewer sources since ars-technica already existed
    // Technology focus has 5 sources, so sourcesCreated should be 4 (not 5)
    expect(body.created).toBe(true);
    expect((body.sourcesCreated as number)).toBe(4);
  });
});

// --- Adopt edition config tests ---

describe('POST /api/discovery/edition-configs/:id/adopt', () => {
  it('cascades creation of focuses and sources', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/edition-configs/morning-briefing/adopt',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body.editionConfigId).toBeTruthy();
    expect(body.created).toBe(true);
    expect((body.focusesCreated as number)).toBeGreaterThan(0);
    expect((body.sourcesCreated as number)).toBeGreaterThan(0);

    // Verify the edition config was created
    const configsRes = await t.inject({
      method: 'GET',
      url: '/api/editions/configs',
      headers,
    });
    const configs = JSON.parse(configsRes.body) as unknown[];
    expect(configs.length).toBe(1);
  });

  it('deduplicates on second adopt', async () => {
    const headers = await authed();

    const res1 = await t.inject({
      method: 'POST',
      url: '/api/discovery/edition-configs/morning-briefing/adopt',
      headers,
    });
    const body1 = JSON.parse(res1.body) as Record<string, unknown>;

    const res2 = await t.inject({
      method: 'POST',
      url: '/api/discovery/edition-configs/morning-briefing/adopt',
      headers,
    });
    const body2 = JSON.parse(res2.body) as Record<string, unknown>;

    expect(body2.created).toBe(false);
    expect(body2.editionConfigId).toBe(body1.editionConfigId);
  });

  it('reuses focuses across edition configs', async () => {
    const headers = await authed();

    // Adopt morning briefing (has technology, science, world-news)
    await t.inject({
      method: 'POST',
      url: '/api/discovery/edition-configs/morning-briefing/adopt',
      headers,
    });

    // Adopt tech weekly (has technology, programming)
    // technology should be reused
    const res = await t.inject({
      method: 'POST',
      url: '/api/discovery/edition-configs/tech-weekly/adopt',
      headers,
    });
    const body = JSON.parse(res.body) as Record<string, unknown>;

    expect(body.created).toBe(true);
    // Only programming is new — technology was already adopted
    expect(body.focusesCreated).toBe(1);

    // Verify we have exactly 2 edition configs
    const configsRes = await t.inject({
      method: 'GET',
      url: '/api/editions/configs',
      headers,
    });
    const configs = JSON.parse(configsRes.body) as unknown[];
    expect(configs.length).toBe(2);

    // Verify we have exactly 4 focuses (technology, science, world-news, programming)
    const focusesRes = await t.inject({
      method: 'GET',
      url: '/api/focuses',
      headers,
    });
    const focuses = JSON.parse(focusesRes.body) as unknown[];
    expect(focuses.length).toBe(4);
  });
});
