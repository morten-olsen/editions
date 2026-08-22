process.env['EDITIONS_DB'] = ':memory:';
process.env['EDITIONS_JWT_SECRET'] ??= 'test-secret-do-not-use-in-production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import { Services } from '../services/services.ts';
import type { DatabaseSchema } from '../database/database.types.ts';

import { fetchAndStoreFeed, parseRssFeed } from './sources.fetch.ts';

// --- parseRssFeed (pure) ---

describe('parseRssFeed', () => {
  it('parses an RSS 2.0 item with podcast fields', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Test Feed</title>
          <item>
            <guid>ep-1</guid>
            <title>Episode One</title>
            <link>https://example.com/ep1</link>
            <description>A first episode</description>
            <content:encoded><![CDATA[<p>Show notes</p>]]></content:encoded>
            <pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate>
            <itunes:author>Some Host</itunes:author>
            <itunes:duration>1:02:03</itunes:duration>
            <itunes:image href="https://example.com/art.jpg"/>
            <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1234"/>
          </item>
        </channel>
      </rss>`;

    const items = parseRssFeed(xml);

    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({
      externalId: 'ep-1',
      url: 'https://example.com/ep1',
      title: 'Episode One',
      author: 'Some Host',
      summary: 'A first episode',
      content: '<p>Show notes</p>',
      imageUrl: 'https://example.com/art.jpg',
      mediaUrl: 'https://example.com/ep1.mp3',
      mediaType: 'audio/mpeg',
      consumptionTimeSeconds: 3723,
    });
    expect(item?.publishedAt).toBe(new Date('Mon, 01 Jun 2026 10:00:00 GMT').toISOString());
  });

  it('parses Atom entries, resolving the alternate link', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <entry>
          <id>urn:entry-1</id>
          <title>Atom Entry</title>
          <link rel="self" href="https://example.com/self"/>
          <link rel="alternate" href="https://example.com/post"/>
          <author><name>Author Name</name></author>
          <summary>Summary text</summary>
          <published>2026-06-01T10:00:00Z</published>
        </entry>
      </feed>`;

    const items = parseRssFeed(xml);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      externalId: 'urn:entry-1',
      url: 'https://example.com/post',
      title: 'Atom Entry',
      author: 'Author Name',
      summary: 'Summary text',
    });
  });

  it('returns an empty list for unrecognized input', () => {
    expect(parseRssFeed('<html><body>not a feed</body></html>')).toEqual([]);
    expect(parseRssFeed('plain text')).toEqual([]);
  });

  it('falls back to link, then a generated id, when guid is missing', () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>No guid</title><link>https://example.com/a</link></item>
      </channel></rss>`;

    const items = parseRssFeed(xml);
    expect(items[0]?.externalId).toBe('https://example.com/a');
  });
});

// --- fetchAndStoreFeed (fake FetchFn + in-memory DB) ---

const FEED_XML = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <item><guid>a1</guid><title>First</title><link>https://example.com/1</link></item>
    <item><guid>a2</guid><title>Second</title><link>https://example.com/2</link></item>
  </channel></rss>`;

describe('fetchAndStoreFeed', () => {
  let db: Kysely<DatabaseSchema>;
  let services: Services;

  const seedSource = async (id: string, type: 'rss' | 'podcast'): Promise<void> => {
    await db
      .insertInto('sources')
      .values({
        id,
        user_id: 'user-1',
        type,
        name: id,
        url: `https://${id}.example.com/feed`,
        config: '{}',
        direction: 'ltr',
      })
      .execute();
  };

  beforeEach(async () => {
    services = new Services();
    db = await services.get(DatabaseService).getInstance();
    await db
      .insertInto('users')
      .values({ id: 'user-1', username: 'testuser', password_hash: 'x', role: 'admin' })
      .execute();
    await seedSource('src-rss', 'rss');
  });

  afterEach(async () => {
    await services.destroy();
  });

  it('stores feed items as articles and records the fetch time', async () => {
    const fetchFn = async (): Promise<Response> => new Response(FEED_XML, { status: 200 });

    await fetchAndStoreFeed({ db, source: { id: 'src-rss', url: 'ignored', type: 'rss' }, fetchFn });

    const articles = await db.selectFrom('articles').select(['external_id', 'title']).orderBy('external_id').execute();
    expect(articles).toEqual([
      { external_id: 'a1', title: 'First' },
      { external_id: 'a2', title: 'Second' },
    ]);

    const source = await db
      .selectFrom('sources')
      .select(['last_fetched_at', 'fetch_error'])
      .where('id', '=', 'src-rss')
      .executeTakeFirstOrThrow();
    expect(source.last_fetched_at).not.toBeNull();
    expect(source.fetch_error).toBeNull();
  });

  it('deduplicates on (source, external id) across repeated fetches', async () => {
    const fetchFn = async (): Promise<Response> => new Response(FEED_XML, { status: 200 });
    const source = { id: 'src-rss', url: 'ignored', type: 'rss' };

    await fetchAndStoreFeed({ db, source, fetchFn });
    await fetchAndStoreFeed({ db, source, fetchFn });

    const count = await db.selectFrom('articles').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
    expect(Number(count.count)).toBe(2);
  });

  it('records the fetch error on the source and rethrows', async () => {
    const fetchFn = async (): Promise<Response> => new Response('', { status: 404, statusText: 'Not Found' });

    await expect(
      fetchAndStoreFeed({ db, source: { id: 'src-rss', url: 'ignored', type: 'rss' }, fetchFn }),
    ).rejects.toThrow('HTTP 404');

    const source = await db
      .selectFrom('sources')
      .select('fetch_error')
      .where('id', '=', 'src-rss')
      .executeTakeFirstOrThrow();
    expect(source.fetch_error).toContain('HTTP 404');
  });

  it('marks podcast items extracted and strips the duplicated artwork image', async () => {
    await seedSource('src-pod', 'podcast');
    const xml = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel><item>
          <guid>ep-1</guid><title>Ep 1</title><link>https://example.com/ep1</link>
          <itunes:image href="https://example.com/art.jpg"/>
          <content:encoded><![CDATA[<img src="https://example.com/art.jpg"/><p>Notes</p>]]></content:encoded>
        </item></channel>
      </rss>`;
    const fetchFn = async (): Promise<Response> => new Response(xml, { status: 200 });

    await fetchAndStoreFeed({ db, source: { id: 'src-pod', url: 'ignored', type: 'podcast' }, fetchFn });

    const article = await db
      .selectFrom('articles')
      .select(['content', 'extracted_at'])
      .where('source_id', '=', 'src-pod')
      .executeTakeFirstOrThrow();
    expect(article.content).toBe('<p>Notes</p>');
    expect(article.extracted_at).not.toBeNull();
  });
});
