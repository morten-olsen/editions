import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

type FeedResponse = {
  items: { id: string; title: string; score: number; vote: 1 | -1 | null; sourceName: string }[];
  total: number;
  offset: number;
  limit: number | null;
};

const daysAgo = (days: number): string => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('feed routes', () => {
  let t: TestContext;
  let headers: { authorization: string };
  let userId: string;

  const seedSource = async (id: string, name: string): Promise<void> => {
    const db = await t.db();
    await db
      .insertInto('sources')
      .values({
        id,
        user_id: userId,
        type: 'rss',
        name,
        url: `https://${id}.example.com/feed`,
        config: '{}',
        direction: 'ltr',
      })
      .execute();
  };

  const seedArticle = async (params: {
    id: string;
    sourceId: string;
    title: string;
    publishedAt: string;
    readAt?: string;
  }): Promise<void> => {
    const db = await t.db();
    await db
      .insertInto('articles')
      .values({
        id: params.id,
        source_id: params.sourceId,
        external_id: params.id,
        title: params.title,
        published_at: params.publishedAt,
        read_at: params.readAt ?? null,
      })
      .execute();
  };

  const getFeed = async (query = ''): Promise<FeedResponse> => {
    const res = await t.inject({ method: 'GET', url: `/api/feed${query}`, headers });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as FeedResponse;
  };

  beforeEach(async () => {
    t = await createTestApp();
    const user = await t.register();
    headers = user.headers;
    userId = user.id;

    await seedSource('src-a', 'Source A');
    await seedArticle({ id: 'art-old', sourceId: 'src-a', title: 'Old article', publishedAt: daysAgo(10) });
    await seedArticle({ id: 'art-mid', sourceId: 'src-a', title: 'Mid article', publishedAt: daysAgo(5) });
    await seedArticle({ id: 'art-new', sourceId: 'src-a', title: 'New article', publishedAt: daysAgo(1) });
  });

  afterEach(async () => {
    await t.stop();
  });

  it('requires authentication', async () => {
    const res = await t.inject({ method: 'GET', url: '/api/feed' });
    expect(res.statusCode).toBe(401);
  });

  it('returns recent sort newest first with score 0', async () => {
    const feed = await getFeed('?sort=recent');

    expect(feed.total).toBe(3);
    expect(feed.items.map((a) => a.id)).toEqual(['art-new', 'art-mid', 'art-old']);
    expect(feed.items.every((a) => a.score === 0)).toBe(true);
  });

  it('ranks top sort by recency when no votes exist', async () => {
    const feed = await getFeed('?sort=top');

    expect(feed.items.map((a) => a.id)).toEqual(['art-new', 'art-mid', 'art-old']);
    const scores = feed.items.map((a) => a.score);
    expect(scores[0]).toBeGreaterThan(scores[1] as number);
    expect(scores[1]).toBeGreaterThan(scores[2] as number);
  });

  it('sinks a downvoted article and returns the vote on the page', async () => {
    // Equalize recency so the vote signal alone decides the order
    const db = await t.db();
    await db
      .updateTable('articles')
      .set({ published_at: daysAgo(1) })
      .execute();

    const vote = await t.inject({
      method: 'PUT',
      url: '/api/articles/art-new/vote',
      headers,
      payload: { value: -1 },
    });
    expect(vote.statusCode).toBe(200);

    const feed = await getFeed('?sort=top');

    expect(feed.items[feed.items.length - 1]?.id).toBe('art-new');
    expect(feed.items.find((a) => a.id === 'art-new')?.vote).toBe(-1);
  });

  it('filters by read status', async () => {
    const db = await t.db();
    await db.updateTable('articles').set({ read_at: new Date().toISOString() }).where('id', '=', 'art-mid').execute();

    const unread = await getFeed('?status=unread');
    expect(unread.items.map((a) => a.id).sort()).toEqual(['art-new', 'art-old']);

    const read = await getFeed('?status=read');
    expect(read.items.map((a) => a.id)).toEqual(['art-mid']);
  });

  it('filters by date range', async () => {
    const feed = await getFeed(`?from=${encodeURIComponent(daysAgo(7))}&to=${encodeURIComponent(daysAgo(2))}`);
    expect(feed.items.map((a) => a.id)).toEqual(['art-mid']);
  });

  it('paginates after ranking', async () => {
    const first = await getFeed('?sort=top&limit=2&offset=0');
    const second = await getFeed('?sort=top&limit=2&offset=2');

    expect(first.total).toBe(3);
    expect(first.items.map((a) => a.id)).toEqual(['art-new', 'art-mid']);
    expect(second.items.map((a) => a.id)).toEqual(['art-old']);
  });

  it('only shows articles from the requesting user', async () => {
    const other = await t.register('otheruser', 'password456');
    const res = await t.inject({ method: 'GET', url: '/api/feed', headers: other.headers });
    const feed = JSON.parse(res.body) as FeedResponse;

    expect(feed.total).toBe(0);
    expect(feed.items).toEqual([]);
  });
});
