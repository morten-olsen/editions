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

// --- Tests ---

describe('POST /api/sources', () => {
  it('creates a source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name: 'My Feed', url: 'https://example.com/rss' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('My Feed');
    expect(body.url).toBe('https://example.com/rss');
    expect(body.type).toBe('rss');
  });

  it('rejects unauthenticated request', async () => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      payload: { name: 'Feed', url: 'https://example.com/rss' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid URL', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name: 'Feed', url: 'not-a-url' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/sources', () => {
  it('returns empty list initially', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/sources',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns created sources', async () => {
    const headers = await authed();
    await createSource(headers, 'Feed 1', 'https://example.com/1');
    await createSource(headers, 'Feed 2', 'https://example.com/2');

    const res = await t.inject({
      method: 'GET',
      url: '/api/sources',
      headers,
    });

    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns every source when limit is omitted, and a page when it is not', async () => {
    const headers = await authed();
    await createSource(headers, 'Feed 1', 'https://example.com/1');
    await createSource(headers, 'Feed 2', 'https://example.com/2');
    await createSource(headers, 'Feed 3', 'https://example.com/3');

    const all = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources', headers })).body);
    expect(all.items).toHaveLength(3);
    expect(all.limit).toBeNull();

    const paged = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources?limit=2', headers })).body);
    expect(paged.items).toHaveLength(2);
    expect(paged.total).toBe(3);
    expect(paged.limit).toBe(2);

    const second = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources?limit=2&offset=2', headers })).body);
    expect(second.items).toHaveLength(1);
    expect(second.total).toBe(3);
  });

  it('searches name and url server-side, across pages', async () => {
    const headers = await authed();
    await createSource(headers, 'Rust Weekly', 'https://rust.example.com/feed');
    await createSource(headers, 'Cooking', 'https://food.example.com/feed');
    await createSource(headers, 'Gardening', 'https://rust-free.example.com/feed');

    const byName = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources?q=weekly', headers })).body);
    expect(byName.items.map((s: { name: string }) => s.name)).toEqual(['Rust Weekly']);

    // Matches the URL of one source and the name of another — the filter runs in
    // SQL, so the count reflects every match rather than the current page.
    const byUrl = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources?q=rust&limit=1', headers })).body);
    expect(byUrl.total).toBe(2);
    expect(byUrl.items).toHaveLength(1);
  });

  it('excludes the bookmarks source when asked', async () => {
    const headers = await authed();
    await createSource(headers, 'Feed 1', 'https://example.com/1');
    // Saving a URL creates the built-in bookmarks source.
    await t.inject({
      method: 'POST',
      url: '/api/bookmarks/save',
      headers,
      payload: { url: 'https://example.com/an-article' },
    });

    const withBookmarks = JSON.parse((await t.inject({ method: 'GET', url: '/api/sources', headers })).body);
    expect(withBookmarks.items.some((s: { type: string }) => s.type === 'bookmarks')).toBe(true);

    const without = JSON.parse(
      (await t.inject({ method: 'GET', url: '/api/sources?includeBookmarks=false', headers })).body,
    );
    expect(without.items.some((s: { type: string }) => s.type === 'bookmarks')).toBe(false);
    expect(without.total).toBe(1);
  });

  it('isolates sources by user', async () => {
    const headers = await authed();
    await createSource(headers, 'My Feed', 'https://example.com/mine');

    const { headers: otherHeaders } = await t.register('otheruser', 'password456');
    const res = await t.inject({
      method: 'GET',
      url: '/api/sources',
      headers: otherHeaders,
    });

    expect(JSON.parse(res.body).items).toHaveLength(0);
  });

  it('exports OPML, excluding the bookmarks source', async () => {
    const headers = await authed();
    await createSource(headers, 'Feed 1', 'https://example.com/1');
    await t.inject({
      method: 'POST',
      url: '/api/bookmarks/save',
      headers,
      payload: { url: 'https://example.com/an-article' },
    });

    const res = await t.inject({ method: 'GET', url: '/api/sources/opml', headers });

    expect(res.statusCode).toBe(200);
    const { opml } = JSON.parse(res.body) as { opml: string };
    expect(opml.startsWith('<?xml')).toBe(true);
    expect(opml).toContain('https://example.com/1');
    expect(opml).not.toContain('bookmarks://saved');
  });
});

describe('GET /api/sources/:id', () => {
  it('returns a source', async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const res = await t.inject({
      method: 'GET',
      url: `/api/sources/${source.id}`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe(source.id);
  });

  it('returns 404 for non-existent source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/sources/nonexistent',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for another user's source", async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const { headers: otherHeaders } = await t.register('otheruser', 'password456');
    const res = await t.inject({
      method: 'GET',
      url: `/api/sources/${source.id}`,
      headers: otherHeaders,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/sources/:id', () => {
  it('updates source name', async () => {
    const headers = await authed();
    const source = await createSource(headers, 'Old Name');

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/sources/${source.id}`,
      headers,
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe('New Name');
  });

  it('updates source url', async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/sources/${source.id}`,
      headers,
      payload: { url: 'https://example.com/new.xml' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).url).toBe('https://example.com/new.xml');
  });

  it("returns 404 for another user's source", async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const { headers: otherHeaders } = await t.register('otheruser', 'password456');
    const res = await t.inject({
      method: 'PATCH',
      url: `/api/sources/${source.id}`,
      headers: otherHeaders,
      payload: { name: 'Hacked' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/sources/:id', () => {
  it('deletes a source', async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const res = await t.inject({
      method: 'DELETE',
      url: `/api/sources/${source.id}`,
      headers,
    });

    expect(res.statusCode).toBe(204);

    const check = await t.inject({
      method: 'GET',
      url: `/api/sources/${source.id}`,
      headers,
    });

    expect(check.statusCode).toBe(404);
  });

  it('returns 404 for non-existent source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'DELETE',
      url: '/api/sources/nonexistent',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/sources/:id/articles', () => {
  it('returns empty page for source with no articles', async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const res = await t.inject({
      method: 'GET',
      url: `/api/sources/${source.id}/articles`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns 404 for non-existent source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'GET',
      url: '/api/sources/nonexistent/articles',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it('respects pagination params', async () => {
    const headers = await authed();
    const source = await createSource(headers);

    const res = await t.inject({
      method: 'GET',
      url: `/api/sources/${source.id}/articles?offset=5&limit=10`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.offset).toBe(5);
    expect(body.limit).toBe(10);
  });
});

describe('POST /api/sources/:id/fetch', () => {
  it('returns 404 for non-existent source', async () => {
    const headers = await authed();
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources/nonexistent/fetch',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 202 with task id', async () => {
    const headers = await authed();
    const source = await createSource(headers, 'HN', 'https://hnrss.org/frontpage');

    const res = await t.inject({
      method: 'POST',
      url: `/api/sources/${source.id}/fetch`,
      headers,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.jobId).toBeDefined();
  });
});

describe('classification stats', () => {
  it('returns empty array when no sources or classifications exist', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'GET',
      url: '/api/sources/classification-stats',
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('returns empty stats when sources have no classifications', async () => {
    const { headers } = await t.register();

    // Create a source but don't classify anything
    await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name: 'Empty Source', url: 'https://empty.example.com/rss' },
    });

    const res = await t.inject({
      method: 'GET',
      url: '/api/sources/classification-stats',
      headers,
    });

    expect(res.statusCode).toBe(200);
    // No articles or classifications exist, so stats are empty
    expect(JSON.parse(res.body)).toEqual([]);
  });
});
