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

describe('focuses CRUD', () => {
  it('returns empty list when no focuses', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'GET',
      url: '/api/focuses',
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('creates a focus', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Technology');
    expect(body.description).toBeNull();
    expect(body.sources).toEqual([]);
  });

  it('creates a focus with description', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Science', description: 'Natural sciences and research' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Science');
    expect(body.description).toBe('Natural sciences and research');
  });

  it('gets a focus by id', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'GET',
      url: `/api/focuses/${id}`,
      headers,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe('Technology');
  });

  it('returns 404 for nonexistent focus', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'GET',
      url: '/api/focuses/nonexistent',
      headers,
    });

    expect(res.statusCode).toBe(404);
  });

  it('updates a focus', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Tech' },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/focuses/${id}`,
      headers,
      payload: { name: 'Technology', description: 'Tech news' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Technology');
    expect(body.description).toBe('Tech news');
  });

  it('clears description with null', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Tech', description: 'Some desc' },
    });
    const { id } = JSON.parse(createRes.body);

    const res = await t.inject({
      method: 'PATCH',
      url: `/api/focuses/${id}`,
      headers,
      payload: { description: null },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).description).toBeNull();
  });

  it('deletes a focus', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const { id } = JSON.parse(createRes.body);

    const delRes = await t.inject({
      method: 'DELETE',
      url: `/api/focuses/${id}`,
      headers,
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await t.inject({
      method: 'GET',
      url: `/api/focuses/${id}`,
      headers,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('isolates focuses between users', async () => {
    const { headers } = await t.register();
    const { headers: otherHeaders } = await t.register('otheruser', 'password456');

    await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'User1 Focus' },
    });

    const res = await t.inject({
      method: 'GET',
      url: '/api/focuses',
      headers: otherHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });
});

describe('focus sources', () => {
  const createSource = async (headers: { authorization: string }, name: string): Promise<string> => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name, url: `https://example.com/${name}/feed.xml` },
    });
    return (JSON.parse(res.body) as { id: string }).id;
  };

  it('sets sources on a focus', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const sourceId = await createSource(headers, 'hn');

    const res = await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: {
        sources: [{ sourceId }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toEqual([{ sourceId, weight: 1, minConfidence: null }]);
  });

  it('replaces sources on a focus', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const source1 = await createSource(headers, 'source1');
    const source2 = await createSource(headers, 'source2');

    // Set first source
    await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: { sources: [{ sourceId: source1 }] },
    });

    // Replace with second source
    const res = await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: { sources: [{ sourceId: source2 }] },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]).toEqual({ sourceId: source2, weight: 1, minConfidence: null });
  });

  it('clears sources with empty array', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const sourceId = await createSource(headers, 'hn');

    await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: { sources: [{ sourceId }] },
    });

    const res = await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: { sources: [] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).sources).toEqual([]);
  });

  it('supports multiple sources with different weights', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const source1 = await createSource(headers, 'source1');
    const source2 = await createSource(headers, 'source2');

    const res = await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: {
        sources: [
          { sourceId: source1, weight: 2 },
          { sourceId: source2, weight: 0.5 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sources).toHaveLength(2);

    const weights = body.sources.map((s: { weight: number }) => s.weight);
    expect(weights).toContain(2);
    expect(weights).toContain(0.5);
  });

  it('includes sources in list response', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const sourceId = await createSource(headers, 'hn');

    await t.inject({
      method: 'PUT',
      url: `/api/focuses/${focusId}/sources`,
      headers,
      payload: { sources: [{ sourceId }] },
    });

    const res = await t.inject({
      method: 'GET',
      url: '/api/focuses',
      headers,
    });

    expect(res.statusCode).toBe(200);
    const focuses = JSON.parse(res.body);
    expect(focuses[0].sources).toEqual([{ sourceId, weight: 1, minConfidence: null }]);
  });
});

describe('focus preview', () => {
  const createSource = async (headers: Record<string, string>, name: string): Promise<string> => {
    const res = await t.inject({
      method: 'POST',
      url: '/api/sources',
      headers,
      payload: { name, url: `https://${name}.example.com/rss` },
    });
    return (JSON.parse(res.body) as { id: string }).id;
  };

  it('returns 404 for non-existent focus', async () => {
    const { headers } = await t.register();

    const res = await t.inject({
      method: 'POST',
      url: '/api/focuses/nonexistent/preview',
      headers,
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns empty page for focus with no scored articles', async () => {
    const { headers } = await t.register();

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Technology' },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    const res = await t.inject({
      method: 'POST',
      url: `/api/focuses/${focusId}/preview`,
      headers,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.articles).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('does not mutate the saved focus config', async () => {
    const { headers } = await t.register();
    const sourceId = await createSource(headers, 'test-source');

    const createRes = await t.inject({
      method: 'POST',
      url: '/api/focuses',
      headers,
      payload: { name: 'Tech', minConfidence: 0.5, sources: [{ sourceId }] },
    });
    const focusId = (JSON.parse(createRes.body) as { id: string }).id;

    // Preview with different threshold
    await t.inject({
      method: 'POST',
      url: `/api/focuses/${focusId}/preview`,
      headers,
      payload: { minConfidence: 0.1 },
    });

    // Verify saved config unchanged
    const getRes = await t.inject({
      method: 'GET',
      url: `/api/focuses/${focusId}`,
      headers,
    });
    const saved = JSON.parse(getRes.body);
    expect(saved.minConfidence).toBe(0.5);
  });
});
