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

const authed = async (): Promise<{ id: string; token: string; headers: { authorization: string } }> => {
  return t.register();
};

const createSource = async (
  headers: { authorization: string },
  name = 'Test Feed',
  url = 'https://example.com/feed.xml',
): Promise<Record<string, unknown>> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/sources',
    headers,
    payload: { name, url },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body) as Record<string, unknown>;
};

const createFocus = async (
  headers: { authorization: string },
  name = 'Test Focus',
  sourceIds: string[] = [],
): Promise<Record<string, unknown>> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/focuses',
    headers,
    payload: {
      name,
      description: 'A test focus',
      sources: sourceIds.map((id) => ({ sourceId: id, weight: 1, minConfidence: null })),
    },
  });
  expect(res.statusCode).toBe(201);
  return JSON.parse(res.body) as Record<string, unknown>;
};

const exportData = async (headers: { authorization: string }): Promise<Record<string, unknown>> => {
  const res = await t.inject({
    method: 'GET',
    url: '/api/data/export',
    headers,
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as Record<string, unknown>;
};

const emptyPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  sources: [],
  articles: [],
  focuses: [],
  editionConfigs: [],
  editions: [],
  scoringWeights: null,
  ...overrides,
});

// --- Tests ---

describe('GET /api/data/export', () => {
  it('rejects unauthenticated request', async () => {
    const res = await t.inject({ method: 'GET', url: '/api/data/export' });
    expect(res.statusCode).toBe(401);
  });

  it('exports empty data for new user', async () => {
    const { headers } = await authed();
    const data = await exportData(headers);

    expect(data.version).toBe(1);
    expect(data.exportedAt).toBeDefined();
    expect(data.sources).toEqual([]);
    expect(data.articles).toEqual([]);
    expect(data.focuses).toEqual([]);
    expect(data.editionConfigs).toEqual([]);
    expect(data.editions).toEqual([]);
    expect(data.scoringWeights).toBeNull();
  });

  it('exports sources without bookmarks source', async () => {
    const { headers } = await authed();
    await createSource(headers, 'My Feed', 'https://example.com/rss');

    const data = await exportData(headers);
    const sources = data.sources as Array<Record<string, unknown>>;

    expect(sources).toHaveLength(1);
    expect(sources[0]!.name).toBe('My Feed');
    expect(sources[0]!.url).toBe('https://example.com/rss');
    expect(sources[0]!.type).toBe('rss');
    // Should not contain any IDs
    expect(sources[0]!).not.toHaveProperty('id');
    expect(sources[0]!).not.toHaveProperty('userId');
  });

  it('exports focuses with source URLs instead of IDs', async () => {
    const { headers } = await authed();
    const source = await createSource(headers, 'Feed', 'https://example.com/feed');
    await createFocus(headers, 'Tech', [source.id as string]);

    const data = await exportData(headers);
    const focuses = data.focuses as Array<Record<string, unknown>>;

    expect(focuses).toHaveLength(1);
    expect(focuses[0]!.name).toBe('Tech');
    expect(focuses[0]!).not.toHaveProperty('id');
    expect(focuses[0]!).not.toHaveProperty('userId');

    const focusSources = focuses[0]!.sources as Array<Record<string, unknown>>;
    expect(focusSources).toHaveLength(1);
    expect(focusSources[0]!.url).toBe('https://example.com/feed');
    expect(focusSources[0]!).not.toHaveProperty('sourceId');
  });

  it('does not contain user-specific IDs in sources', async () => {
    const { headers } = await authed();
    await createSource(headers);

    const data = await exportData(headers);
    expect(data).not.toHaveProperty('userId');
    expect(data).not.toHaveProperty('id');

    const sources = data.sources as Array<Record<string, unknown>>;
    for (const src of sources) {
      expect(src).not.toHaveProperty('id');
      expect(src).not.toHaveProperty('userId');
      expect(src).not.toHaveProperty('user_id');
    }
  });
});

describe('POST /api/data/import', () => {
  it('rejects unauthenticated request', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      payload: emptyPayload(),
    });
    expect(res.statusCode).toBe(401);
  });

  it('imports sources', async () => {
    const { headers } = await authed();

    const res = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers,
      payload: emptyPayload({
        sources: [
          { type: 'rss', name: 'Imported Feed', url: 'https://imported.com/feed', config: {}, direction: 'newest' },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toBe(1);

    // Verify the source exists
    const listRes = await t.inject({ method: 'GET', url: '/api/sources', headers });
    const sources = JSON.parse(listRes.body) as Array<Record<string, unknown>>;
    const imported = sources.find((s) => s.name === 'Imported Feed');
    expect(imported).toBeDefined();
  });

  it('clears existing data before importing', async () => {
    const { headers } = await authed();
    await createSource(headers, 'Old Feed', 'https://old.com/feed');
    await createFocus(headers, 'Old Focus', []);

    await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers,
      payload: emptyPayload({
        sources: [
          { type: 'rss', name: 'New Feed', url: 'https://new.com/feed', config: {}, direction: 'newest' },
        ],
      }),
    });

    // Old data should be gone
    const sourcesRes = await t.inject({ method: 'GET', url: '/api/sources', headers });
    const sources = JSON.parse(sourcesRes.body) as Array<Record<string, unknown>>;
    const nonBookmarks = sources.filter((s) => s.type !== 'bookmarks');
    expect(nonBookmarks).toHaveLength(1);
    expect(nonBookmarks[0]!.name).toBe('New Feed');

    const focusesRes = await t.inject({ method: 'GET', url: '/api/focuses', headers });
    const focuses = JSON.parse(focusesRes.body) as Array<Record<string, unknown>>;
    expect(focuses).toHaveLength(0);
  });

  it('imports articles linked to sources', async () => {
    const { headers } = await authed();

    const res = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers,
      payload: emptyPayload({
        sources: [
          { type: 'rss', name: 'Feed', url: 'https://example.com/feed', config: {}, direction: 'newest' },
        ],
        articles: [
          {
            sourceUrl: 'https://example.com/feed',
            externalId: 'ext-1',
            url: 'https://example.com/article-1',
            title: 'Test Article',
            author: null,
            summary: 'A summary',
            content: 'Full content',
            consumptionTimeSeconds: 120,
            imageUrl: null,
            mediaUrl: null,
            mediaType: null,
            publishedAt: '2026-01-01T00:00:00Z',
            extractedAt: '2026-01-01T01:00:00Z',
            analysedAt: null,
            readAt: null,
            progress: 0,
            embedding: null,
            focuses: [],
          },
        ],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toBe(1);
    expect(body.articles).toBe(1);
  });

  it('imports focuses with source links resolved by URL', async () => {
    const { headers } = await authed();

    const res = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers,
      payload: emptyPayload({
        sources: [
          { type: 'rss', name: 'Feed', url: 'https://example.com/feed', config: {}, direction: 'newest' },
        ],
        focuses: [
          {
            name: 'Imported Focus',
            description: 'Desc',
            icon: null,
            minConfidence: 0.5,
            minConsumptionTimeSeconds: null,
            maxConsumptionTimeSeconds: null,
            sources: [{ url: 'https://example.com/feed', weight: 1, minConfidence: null }],
          },
        ],
      }),
    });

    const body = JSON.parse(res.body);
    expect(body.focuses).toBe(1);

    // Verify the focus was created with the source link
    const focusRes = await t.inject({ method: 'GET', url: '/api/focuses', headers });
    const focuses = JSON.parse(focusRes.body) as Array<Record<string, unknown>>;
    const imported = focuses.find((f) => f.name === 'Imported Focus');
    expect(imported).toBeDefined();
    expect((imported!.sources as unknown[]).length).toBe(1);
  });

  it('imports scoring weights', async () => {
    const { headers } = await authed();

    const weights = {
      global: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
      focus: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
      edition: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
    };

    const res = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers,
      payload: emptyPayload({ scoringWeights: weights }),
    });

    const body = JSON.parse(res.body);
    expect(body.scoringWeightsImported).toBe(true);
  });

  it('round-trips export → import into a different user', async () => {
    // User A creates data
    const userA = await t.register('alice', 'password1');
    await createSource(userA.headers, 'Alice Feed', 'https://alice.com/feed');
    await createFocus(userA.headers, 'Alice Focus', []);

    // Export from user A
    const exported = await exportData(userA.headers);

    // User B imports
    const userB = await t.register('bob', 'password2');
    const importRes = await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers: userB.headers,
      payload: exported,
    });

    expect(importRes.statusCode).toBe(200);
    const result = JSON.parse(importRes.body);
    expect(result.sources).toBe(1);
    expect(result.focuses).toBe(1);

    // Verify Bob has the data
    const sourcesRes = await t.inject({ method: 'GET', url: '/api/sources', headers: userB.headers });
    const sources = JSON.parse(sourcesRes.body) as Array<Record<string, unknown>>;
    expect(sources.some((s) => s.name === 'Alice Feed')).toBe(true);

    const focusesRes = await t.inject({ method: 'GET', url: '/api/focuses', headers: userB.headers });
    const focuses = JSON.parse(focusesRes.body) as Array<Record<string, unknown>>;
    expect(focuses.some((f) => f.name === 'Alice Focus')).toBe(true);
  });

  it('does not affect the exporting user when imported by another', async () => {
    const userA = await t.register('alice', 'password1');
    await createSource(userA.headers, 'Feed', 'https://example.com/feed');
    const exported = await exportData(userA.headers);

    const userB = await t.register('bob', 'password2');
    await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers: userB.headers,
      payload: exported,
    });

    // Verify user A's data is unchanged
    const sourcesA = await t.inject({ method: 'GET', url: '/api/sources', headers: userA.headers });
    const sourcesABody = JSON.parse(sourcesA.body) as Array<Record<string, unknown>>;
    expect(sourcesABody.filter((s) => s.type !== 'bookmarks')).toHaveLength(1);
  });

  it('round-trip produces identical state', async () => {
    const userA = await t.register('alice', 'password1');
    await createSource(userA.headers, 'Feed A', 'https://a.com/feed');
    await createSource(userA.headers, 'Feed B', 'https://b.com/feed');
    await createFocus(userA.headers, 'Focus A', []);

    const exportedA = await exportData(userA.headers);

    // Import into user B
    const userB = await t.register('bob', 'password2');
    await t.inject({
      method: 'POST',
      url: '/api/data/import',
      headers: userB.headers,
      payload: exportedA,
    });

    // Export from user B and compare (excluding exportedAt timestamp)
    const exportedB = await exportData(userB.headers);
    expect(exportedB.sources).toEqual(exportedA.sources);
    expect(exportedB.articles).toEqual(exportedA.articles);
    expect(exportedB.focuses).toEqual(exportedA.focuses);
    expect(exportedB.editionConfigs).toEqual(exportedA.editionConfigs);
    expect(exportedB.editions).toEqual(exportedA.editions);
    expect(exportedB.scoringWeights).toEqual(exportedA.scoringWeights);
  });
});
