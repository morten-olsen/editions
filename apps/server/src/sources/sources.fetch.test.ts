process.env['EDITIONS_DB'] = ':memory:';
process.env['EDITIONS_JWT_SECRET'] ??= 'test-secret-do-not-use-in-production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import { Services } from '../services/services.ts';
import type { DatabaseSchema } from '../database/database.types.ts';

import { DEFAULT_MAX_ITEMS_PER_FETCH, fetchAndStoreFeed, parseRssFeed, selectItemsToIngest } from './sources.fetch.ts';
import type { FeedItem } from './sources.fetch.ts';

// --- selectItemsToIngest (pure) ---

const feedItem = (title: string, publishedAt: string | null): FeedItem => ({
  externalId: title,
  url: null,
  title,
  author: null,
  summary: null,
  content: null,
  imageUrl: null,
  publishedAt,
  mediaUrl: null,
  mediaType: null,
  consumptionTimeSeconds: null,
});

describe('selectItemsToIngest', () => {
  const dated = [
    feedItem('oldest', '2026-01-01T00:00:00.000Z'),
    feedItem('newest', '2026-03-01T00:00:00.000Z'),
    feedItem('middle', '2026-02-01T00:00:00.000Z'),
  ];

  it('returns everything when the feed is under the cap', () => {
    expect(selectItemsToIngest(dated, 10).map((i) => i.title)).toEqual(['oldest', 'newest', 'middle']);
  });

  it('keeps the newest items, not the first ones in the feed', () => {
    expect(selectItemsToIngest(dated, 2).map((i) => i.title)).toEqual(['newest', 'middle']);
  });

  // A backlog source is read forwards, so capping to the newest items would
  // mean the beginning of the archive never arrives.
  it('keeps the oldest items for a backlog source', () => {
    expect(selectItemsToIngest(dated, 2, 'oldest').map((i) => i.title)).toEqual(['oldest', 'middle']);
  });

  it('ranks undated items last but keeps their feed order', () => {
    const mixed = [
      feedItem('no-date-1', null),
      feedItem('dated', '2026-01-01T00:00:00.000Z'),
      feedItem('no-date-2', null),
    ];

    expect(selectItemsToIngest(mixed, 2).map((i) => i.title)).toEqual(['dated', 'no-date-1']);
  });

  it('falls back to feed order when nothing is dated', () => {
    const undated = [feedItem('a', null), feedItem('b', null), feedItem('c', null)];

    expect(selectItemsToIngest(undated, 2).map((i) => i.title)).toEqual(['a', 'b']);
  });
});

// --- parseRssFeed (pure) ---

describe('parseRssFeed', () => {
  /**
   * fast-xml-parser counts every entity replacement — including 1:1 ones like
   * `&amp;` — against a single `maxTotalExpansions` budget that defaults to
   * 1000. A real full-text feed blows through that easily, and the whole feed
   * then fails to parse with "Entity expansion limit exceeded".
   *
   * The billion-laughs protections that budget is meant to provide are all
   * DOCTYPE-specific and left at their defaults; see `sources.fetch.ts`.
   */
  it('parses a feed containing far more than 1000 harmless entities', () => {
    const body = '&amp;nbsp; caf&#233; &quot;quoted&quot; &lt;tag&gt; &#8217;s '.repeat(60);
    const items = Array.from(
      { length: 20 },
      (_, i) => `
        <item>
          <guid>e-${i}</guid>
          <title>Item ${i} &amp; more</title>
          <link>https://example.com/${i}?a=1&amp;b=2</link>
          <description>${body}</description>
        </item>`,
    ).join('');

    const parsed = parseRssFeed(`<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`);

    expect(parsed).toHaveLength(20);
    expect(parsed[0]?.title).toBe('Item 0 & more');
    expect(parsed[0]?.url).toBe('https://example.com/0?a=1&b=2');
  });

  /**
   * Why raising `maxTotalExpansions` does not reopen a billion-laughs hole:
   * the parser will not expand an entity whose value references another entity,
   * so recursive — and therefore exponential — expansion cannot happen at all.
   * A flat entity still expands; a nested one is left literal.
   *
   * If a future fast-xml-parser starts expanding nested entities, this test
   * fails and the raised limit needs revisiting.
   */
  it('does not expand nested entities, so expansion cannot blow up', () => {
    const flat = parseRssFeed(
      '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "HELLO">]>' +
        '<rss version="2.0"><channel><item><guid>x</guid><title>&a;</title></item></channel></rss>',
    );
    expect(flat[0]?.title).toBe('HELLO');

    const nested = parseRssFeed(
      '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY a "AB"><!ENTITY b "&a;&a;&a;">]>' +
        '<rss version="2.0"><channel><item><guid>x</guid><title>&b;</title></item></channel></rss>',
    );
    expect(nested[0]?.title).toBe('&b;');
  });

  it('caps a huge archive feed at the ingest limit', () => {
    const items = Array.from(
      { length: 3000 },
      (_, i) => `<item><guid>a-${i}</guid><title>Article ${i}</title>
        <pubDate>${new Date(Date.UTC(2020, 0, 1) + i * 3_600_000).toUTCString()}</pubDate></item>`,
    ).join('');

    const parsed = parseRssFeed(`<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`);
    expect(parsed).toHaveLength(3000);

    // parseRssFeed stays faithful to the feed; the cap belongs to ingest.
    const selected = selectItemsToIngest(parsed, DEFAULT_MAX_ITEMS_PER_FETCH);
    expect(selected).toHaveLength(200);
    expect(selected[0]?.title).toBe('Article 2999');
    expect(selected.at(-1)?.title).toBe('Article 2800');
  });

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

  it('stores at most maxItems articles from an archive feed', async () => {
    await seedSource('src-archive', 'rss');
    const items = Array.from(
      { length: 500 },
      (_, i) => `<item><guid>a-${i}</guid><title>Article ${i}</title>
        <pubDate>${new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toUTCString()}</pubDate></item>`,
    ).join('');
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
    const fetchFn = async (): Promise<Response> => new Response(xml, { status: 200 });

    await fetchAndStoreFeed({
      db,
      source: { id: 'src-archive', url: 'ignored', type: 'rss' },
      fetchFn,
      maxItems: 50,
    });

    const rows = await db
      .selectFrom('articles')
      .select(['title'])
      .where('source_id', '=', 'src-archive')
      .orderBy('published_at', 'desc')
      .execute();

    expect(rows).toHaveLength(50);
    expect(rows[0]?.title).toBe('Article 499');
    expect(rows.at(-1)?.title).toBe('Article 450');
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
