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

// --- Helpers ---

type Auth = { authorization: string };

const daysAgo = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

const createConfig = async (headers: Auth, name = 'Morning Briefing'): Promise<string> => {
  const focusRes = await t.inject({
    method: 'POST',
    url: '/api/focuses',
    headers,
    payload: { name: `Focus for ${name}`, sources: [] },
  });
  const focusId = (JSON.parse(focusRes.body) as { id: string }).id;

  const res = await t.inject({
    method: 'POST',
    url: '/api/editions/configs',
    headers,
    payload: {
      name,
      schedule: '0 7 * * *',
      lookbackHours: 24,
      focuses: [{ focusId, position: 0, budgetType: 'count', budgetValue: 5 }],
    },
  });
  expect(res.statusCode).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
};

/**
 * Seeds an issue directly. Deliberately not via /generate: that needs analysed
 * articles, and seeding rows keeps these tests about the sweep.
 */
const seedIssue = async ({
  configId,
  id,
  publishedAt,
  read = false,
}: {
  configId: string;
  id: string;
  publishedAt: string;
  read?: boolean;
}): Promise<void> => {
  const db = await t.db();
  await db
    .insertInto('editions')
    .values({
      id,
      edition_config_id: configId,
      title: `Issue ${id}`,
      total_reading_minutes: 10,
      article_count: 0,
      current_position: 0,
      read_at: read ? publishedAt : null,
      published_at: publishedAt,
    })
    .execute();
};

const seedArticleInIssue = async ({
  editionId,
  articleId,
  sourceId,
  readAt = null,
}: {
  editionId: string;
  articleId: string;
  sourceId: string;
  readAt?: string | null;
}): Promise<void> => {
  const db = await t.db();
  await db
    .insertInto('articles')
    .values({
      id: articleId,
      source_id: sourceId,
      external_id: articleId,
      url: `https://example.com/${articleId}`,
      title: `Article ${articleId}`,
      author: null,
      summary: null,
      content: null,
      consumption_time_seconds: 120,
      image_url: null,
      media_url: null,
      media_type: null,
      published_at: daysAgo(1),
      extracted_at: null,
      analysed_at: null,
      read_at: readAt,
      progress: 0,
    })
    .execute();

  const focus = await db.selectFrom('focuses').select('id').executeTakeFirstOrThrow();
  await db
    .insertInto('edition_articles')
    .values({ edition_id: editionId, article_id: articleId, focus_id: focus.id, position: 0 })
    .execute();
};

const createSource = async (headers: Auth): Promise<string> => {
  const res = await t.inject({
    method: 'POST',
    url: '/api/sources',
    headers,
    payload: { name: 'Feed', url: 'https://example.com/feed.xml' },
  });
  return (JSON.parse(res.body) as { id: string }).id;
};

const listIssues = async (headers: Auth, configId: string, query = ''): Promise<Record<string, never>> => {
  const res = await t.inject({
    method: 'GET',
    url: `/api/editions/configs/${configId}/editions${query}`,
    headers,
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body);
};

type SweepBody = {
  filter: { read?: boolean; publishedBefore?: string; keepLatest?: number };
  action: 'delete' | 'mark-read' | 'mark-unread';
};

const preview = async (headers: Auth, configId: string, body: SweepBody): Promise<number> => {
  const res = await t.inject({
    method: 'POST',
    url: `/api/editions/configs/${configId}/issues/sweep/preview`,
    headers,
    payload: body,
  });
  expect(res.statusCode).toBe(200);
  return (JSON.parse(res.body) as { affected: number }).affected;
};

const sweep = async (headers: Auth, configId: string, body: SweepBody): Promise<number> => {
  const res = await t.inject({
    method: 'POST',
    url: `/api/editions/configs/${configId}/issues/sweep`,
    headers,
    payload: body,
  });
  expect(res.statusCode).toBe(200);
  return (JSON.parse(res.body) as { affected: number }).affected;
};

// --- Tests ---

describe('GET /api/editions/configs/:configId/editions', () => {
  it('returns a page with a total, newest first', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    await seedIssue({ configId, id: 'old', publishedAt: daysAgo(10) });
    await seedIssue({ configId, id: 'mid', publishedAt: daysAgo(5) });
    await seedIssue({ configId, id: 'new', publishedAt: daysAgo(1) });

    const page = (await listIssues(headers, configId, '?limit=2')) as unknown as {
      items: { id: string }[];
      total: number;
      limit: number;
    };

    expect(page.total).toBe(3);
    expect(page.items.map((i) => i.id)).toEqual(['new', 'mid']);
    expect(page.limit).toBe(2);

    const second = (await listIssues(headers, configId, '?limit=2&offset=2')) as unknown as {
      items: { id: string }[];
      total: number;
    };
    expect(second.items.map((i) => i.id)).toEqual(['old']);
    expect(second.total).toBe(3);
  });

  it('filters by read status', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    await seedIssue({ configId, id: 'read-one', publishedAt: daysAgo(2), read: true });
    await seedIssue({ configId, id: 'unread-one', publishedAt: daysAgo(1) });

    const unread = (await listIssues(headers, configId, '?read=false')) as unknown as {
      items: { id: string }[];
      total: number;
    };
    expect(unread.items.map((i) => i.id)).toEqual(['unread-one']);
    expect(unread.total).toBe(1);
  });

  it("404s on another user's config", async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    const { headers: otherHeaders } = await t.register('other', 'password456');

    const res = await t.inject({
      method: 'GET',
      url: `/api/editions/configs/${configId}/editions`,
      headers: otherHeaders,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('issue sweep', () => {
  it('previews the same count it then deletes', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    await seedIssue({ configId, id: 'r1', publishedAt: daysAgo(9), read: true });
    await seedIssue({ configId, id: 'r2', publishedAt: daysAgo(8), read: true });
    await seedIssue({ configId, id: 'u1', publishedAt: daysAgo(1) });

    const body: SweepBody = { filter: { read: true }, action: 'delete' };
    const previewed = await preview(headers, configId, body);
    const affected = await sweep(headers, configId, body);

    expect(previewed).toBe(2);
    expect(affected).toBe(previewed);

    const page = (await listIssues(headers, configId)) as unknown as { items: { id: string }[] };
    expect(page.items.map((i) => i.id)).toEqual(['u1']);
  });

  it('keepLatest protects the newest issues even when they match the filter', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    for (let i = 1; i <= 5; i++) {
      await seedIssue({ configId, id: `i${i}`, publishedAt: daysAgo(i), read: true });
    }

    // Every issue is read, so without the guard this would delete all five.
    const affected = await sweep(headers, configId, { filter: { read: true, keepLatest: 2 }, action: 'delete' });

    expect(affected).toBe(3);
    const page = (await listIssues(headers, configId)) as unknown as { items: { id: string }[]; total: number };
    expect(page.items.map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(page.total).toBe(2);
  });

  it('filters by publishedBefore', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    await seedIssue({ configId, id: 'ancient', publishedAt: daysAgo(40) });
    await seedIssue({ configId, id: 'recent', publishedAt: daysAgo(2) });

    const affected = await sweep(headers, configId, {
      filter: { publishedBefore: daysAgo(30) },
      action: 'delete',
    });

    expect(affected).toBe(1);
    const page = (await listIssues(headers, configId)) as unknown as { items: { id: string }[] };
    expect(page.items.map((i) => i.id)).toEqual(['recent']);
  });

  it("never touches another user's issues", async () => {
    const { headers } = await t.register();
    const mine = await createConfig(headers, 'Mine');
    await seedIssue({ configId: mine, id: 'mine-1', publishedAt: daysAgo(3) });

    const { headers: otherHeaders } = await t.register('other', 'password456');
    const theirs = await createConfig(otherHeaders, 'Theirs');
    await seedIssue({ configId: theirs, id: 'theirs-1', publishedAt: daysAgo(3) });

    await sweep(headers, mine, { filter: {}, action: 'delete' });

    const theirPage = (await listIssues(otherHeaders, theirs)) as unknown as { total: number };
    expect(theirPage.total).toBe(1);
  });

  it('404s when sweeping a config the user does not own', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    const { headers: otherHeaders } = await t.register('other', 'password456');

    const res = await t.inject({
      method: 'POST',
      url: `/api/editions/configs/${configId}/issues/sweep`,
      headers: otherHeaders,
      payload: { filter: {}, action: 'delete' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('issue read state is monotonic', () => {
  it('marking read only sets articles that were unread, and unread leaves them read', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    const sourceId = await createSource(headers);
    const alreadyReadAt = daysAgo(20);

    await seedIssue({ configId, id: 'issue-1', publishedAt: daysAgo(2) });
    await seedArticleInIssue({ editionId: 'issue-1', articleId: 'fresh', sourceId });
    await seedArticleInIssue({ editionId: 'issue-1', articleId: 'seen', sourceId, readAt: alreadyReadAt });

    await sweep(headers, configId, { filter: {}, action: 'mark-read' });

    const db = await t.db();
    const afterRead = await db.selectFrom('articles').select(['id', 'read_at']).orderBy('id').execute();
    const byId = new Map(afterRead.map((a) => [a.id, a.read_at]));

    // The already-read article keeps its original timestamp rather than being
    // overwritten with "now".
    expect(byId.get('seen')).toBe(alreadyReadAt);
    expect(byId.get('fresh')).not.toBeNull();

    const issueAfterRead = await db
      .selectFrom('editions')
      .select('read_at')
      .where('id', '=', 'issue-1')
      .executeTakeFirstOrThrow();
    expect(issueAfterRead.read_at).not.toBeNull();

    await sweep(headers, configId, { filter: {}, action: 'mark-unread' });

    const issueAfterUnread = await db
      .selectFrom('editions')
      .select('read_at')
      .where('id', '=', 'issue-1')
      .executeTakeFirstOrThrow();
    expect(issueAfterUnread.read_at).toBeNull();

    // Un-reading the issue does not un-read its articles: an article that was
    // read stays read, including one read via another issue.
    const afterUnread = await db.selectFrom('articles').select(['id', 'read_at']).orderBy('id').execute();
    expect(afterUnread.every((a) => a.read_at !== null)).toBe(true);
  });

  it('applies the same rule to the single-issue read toggle', async () => {
    const { headers } = await t.register();
    const configId = await createConfig(headers);
    const sourceId = await createSource(headers);
    const alreadyReadAt = daysAgo(15);

    await seedIssue({ configId, id: 'issue-1', publishedAt: daysAgo(2) });
    await seedArticleInIssue({ editionId: 'issue-1', articleId: 'seen', sourceId, readAt: alreadyReadAt });

    const readRes = await t.inject({
      method: 'PUT',
      url: '/api/editions/issue-1/read',
      headers,
      payload: { read: true },
    });
    expect(readRes.statusCode).toBe(200);

    const db = await t.db();
    const article = await db
      .selectFrom('articles')
      .select('read_at')
      .where('id', '=', 'seen')
      .executeTakeFirstOrThrow();
    expect(article.read_at).toBe(alreadyReadAt);

    const unreadRes = await t.inject({
      method: 'PUT',
      url: '/api/editions/issue-1/read',
      headers,
      payload: { read: false },
    });
    expect(unreadRes.statusCode).toBe(200);
    expect((JSON.parse(unreadRes.body) as { readAt: string | null }).readAt).toBeNull();

    const afterUnread = await db
      .selectFrom('articles')
      .select('read_at')
      .where('id', '=', 'seen')
      .executeTakeFirstOrThrow();
    expect(afterUnread.read_at).toBe(alreadyReadAt);
  });
});
