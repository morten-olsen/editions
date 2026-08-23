import crypto from 'node:crypto';

import { XMLParser } from 'fast-xml-parser';
import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

// --- Types ---

type FeedItem = {
  externalId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  consumptionTimeSeconds: number | null;
};

// --- RSS parsing ---

/**
 * `maxTotalExpansions` counts every entity replacement in a document, including
 * 1:1 ones like `&amp;` and `&#8217;`. Its default of 1000 is far below what a
 * legitimate full-text feed contains — a couple of dozen articles of escaped
 * HTML blows past it easily — and exceeding it throws, so the entire feed fails
 * to parse rather than degrading.
 *
 * Raising it is safe because it is not the limit protecting against entity
 * expansion attacks. fast-xml-parser refuses to expand an entity that
 * references another entity (a nested `<!ENTITY b "&a;&a;">` is left literal),
 * so the exponential billion-laughs blowup is structurally impossible here.
 * What remains is flat, linear expansion, still bounded by the untouched
 * `maxEntitySize`, `maxEntityCount` and `maxExpandedLength` defaults.
 */
const MAX_ENTITY_EXPANSIONS = 1_000_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  htmlEntities: true,
  processEntities: { enabled: true, maxTotalExpansions: MAX_ENTITY_EXPANSIONS },
});

const parseRssFeed = (xml: string): FeedItem[] => {
  const parsed = parser.parse(xml) as Record<string, unknown>;

  // RSS 2.0
  const rssChannel = getNestedValue(parsed, 'rss', 'channel') as Record<string, unknown> | undefined;
  if (rssChannel) {
    return normalizeItems(rssChannel.item);
  }

  // Atom
  const atomFeed = parsed.feed as Record<string, unknown> | undefined;
  if (atomFeed) {
    return normalizeAtomEntries(atomFeed.entry);
  }

  // RSS 1.0 (RDF)
  const rdf = parsed['rdf:RDF'] as Record<string, unknown> | undefined;
  if (rdf) {
    return normalizeItems(rdf.item);
  }

  return [];
};

const normalizeItems = (items: unknown): FeedItem[] => {
  if (!items) {
    return [];
  }
  const arr = Array.isArray(items) ? items : [items];

  return arr.map((item: Record<string, unknown>): FeedItem => {
    const guid = item.guid;
    const guidText = typeof guid === 'object' && guid !== null ? (guid as Record<string, unknown>)['#text'] : guid;

    const { mediaUrl, mediaType } = extractMediaEnclosure(item);

    return {
      externalId: String(guidText ?? item.link ?? crypto.randomUUID()),
      url: toStringOrNull(item.link),
      title: String(item.title ?? 'Untitled'),
      author: toStringOrNull(item['dc:creator'] ?? item.author ?? item['itunes:author']),
      summary: toStringOrNull(item.description),
      content: toStringOrNull(item['content:encoded']),
      imageUrl: extractImageUrl(item),
      publishedAt: toIsoDate(item.pubDate ?? item['dc:date']),
      mediaUrl,
      mediaType,
      consumptionTimeSeconds: parseItunesDuration(item['itunes:duration']),
    };
  });
};

const normalizeAtomEntries = (entries: unknown): FeedItem[] => {
  if (!entries) {
    return [];
  }
  const arr = Array.isArray(entries) ? entries : [entries];

  return arr.map((entry: Record<string, unknown>): FeedItem => {
    const link = extractAtomLink(entry.link);

    return {
      externalId: String(entry.id ?? link ?? crypto.randomUUID()),
      url: link,
      title: String(
        typeof entry.title === 'object' && entry.title !== null
          ? (entry.title as Record<string, unknown>)['#text']
          : (entry.title ?? 'Untitled'),
      ),
      author: extractAtomAuthor(entry.author),
      summary: toStringOrNull(
        typeof entry.summary === 'object' && entry.summary !== null
          ? (entry.summary as Record<string, unknown>)['#text']
          : entry.summary,
      ),
      content: toStringOrNull(
        typeof entry.content === 'object' && entry.content !== null
          ? (entry.content as Record<string, unknown>)['#text']
          : entry.content,
      ),
      imageUrl: null,
      publishedAt: toIsoDate(entry.published ?? entry.updated),
      mediaUrl: null,
      mediaType: null,
      consumptionTimeSeconds: null,
    };
  });
};

const extractAtomLink = (link: unknown): string | null => {
  if (!link) {
    return null;
  }
  if (typeof link === 'string') {
    return link;
  }
  if (Array.isArray(link)) {
    const alternate = link.find((l: Record<string, unknown>) => l['@_rel'] === 'alternate' || !l['@_rel']) as
      | Record<string, unknown>
      | undefined;
    return toStringOrNull(alternate?.['@_href']);
  }
  if (typeof link === 'object') {
    return toStringOrNull((link as Record<string, unknown>)['@_href']);
  }
  return null;
};

const extractAtomAuthor = (author: unknown): string | null => {
  if (!author) {
    return null;
  }
  if (typeof author === 'string') {
    return author;
  }
  if (typeof author === 'object') {
    return toStringOrNull((author as Record<string, unknown>).name);
  }
  return null;
};

const extractImageUrl = (item: Record<string, unknown>): string | null => {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (enclosure) {
    const type = String(enclosure['@_type'] ?? '');
    if (type.startsWith('image/')) {
      return toStringOrNull(enclosure['@_url']);
    }
  }
  // Podcast feeds often use itunes:image for episode artwork
  const itunesImage = item['itunes:image'] as Record<string, unknown> | undefined;
  if (itunesImage) {
    return toStringOrNull(itunesImage['@_href']);
  }
  // Megaphone and other feeds use media:thumbnail
  const mediaThumbnail = item['media:thumbnail'] as Record<string, unknown> | undefined;
  if (mediaThumbnail) {
    return toStringOrNull(mediaThumbnail['@_url']);
  }
  // media:content with image medium or type
  const mediaContent = item['media:content'] as Record<string, unknown> | undefined;
  if (mediaContent) {
    const medium = String(mediaContent['@_medium'] ?? '');
    const mediaType = String(mediaContent['@_type'] ?? '');
    if (medium === 'image' || mediaType.startsWith('image/')) {
      return toStringOrNull(mediaContent['@_url']);
    }
  }
  return null;
};

const extractMediaEnclosure = (
  item: Record<string, unknown>,
): { mediaUrl: string | null; mediaType: string | null } => {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (!enclosure) {
    return { mediaUrl: null, mediaType: null };
  }

  const type = String(enclosure['@_type'] ?? '');
  if (type.startsWith('audio/') || type.startsWith('video/')) {
    return {
      mediaUrl: toStringOrNull(enclosure['@_url']),
      mediaType: type || null,
    };
  }

  return { mediaUrl: null, mediaType: null };
};

const parseItunesDuration = (val: unknown): number | null => {
  if (val === null || val === undefined) {
    return null;
  }
  const s = String(val).trim();
  if (s.length === 0) {
    return null;
  }

  const parts = s.split(':').map(Number);
  if (parts.some(isNaN)) {
    return null;
  }

  if (parts.length === 3) {
    return (parts[0] as number) * 3600 + (parts[1] as number) * 60 + (parts[2] as number);
  }
  if (parts.length === 2) {
    return (parts[0] as number) * 60 + (parts[1] as number);
  }
  if (parts.length === 1) {
    return parts[0] as number;
  }
  return null;
};

const toStringOrNull = (val: unknown): string | null => {
  if (val === null || val === undefined) {
    return null;
  }
  const s = String(val).trim();
  return s.length > 0 ? s : null;
};

const toIsoDate = (val: unknown): string | null => {
  if (!val) {
    return null;
  }
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const getNestedValue = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

// --- Ingest ---

type IngestSource = {
  id: string;
  url: string;
  type: string;
  /** `'oldest'` reads a backlog forwards; anything else reads newest-first. */
  direction?: string;
};

// Same shape as the reconciler's EmbedFn/ClassifyFn seams: a function-typed
// dependency — global fetch in production, a fake in tests
type FetchFn = (url: string) => Promise<Response>;

/**
 * How many items a single fetch will ingest.
 *
 * Some feeds serve their entire archive — thousands of items — and every one
 * ingested is extracted, embedded and classified against every focus. That is
 * a lot of compute for articles far too old to reach an edition, whose lookback
 * is measured in hours or days. Capping ingest is much cheaper than analysing
 * and then never using them.
 */
const DEFAULT_MAX_ITEMS_PER_FETCH = 200;

/**
 * The slice of a feed worth ingesting: the newest `maxItems`, or the oldest
 * when the source is being read as a backlog.
 *
 * Feed order is conventionally newest-first but not guaranteed, so this sorts
 * on `publishedAt` where it exists. Undated items keep their feed order and go
 * last — an undated item is more likely to be a malformed straggler than the
 * most important thing in the feed.
 */
const selectItemsToIngest = (items: FeedItem[], maxItems: number, direction?: string): FeedItem[] => {
  if (items.length <= maxItems) {
    return items;
  }

  const dated = items.filter((i) => i.publishedAt !== null);
  const undated = items.filter((i) => i.publishedAt === null);

  const oldestFirst = direction === 'oldest';
  dated.sort((a, b) => {
    const diff = Date.parse(a.publishedAt as string) - Date.parse(b.publishedAt as string);
    return oldestFirst ? diff : -diff;
  });

  return [...dated, ...undated].slice(0, maxItems);
};

// Fetch a source's feed and upsert its items as articles.
// Records fetch errors on the source row; rethrows so callers see failure.
const fetchAndStoreFeed = async ({
  db,
  source,
  fetchFn = fetch,
  maxItems = DEFAULT_MAX_ITEMS_PER_FETCH,
}: {
  db: Kysely<DatabaseSchema>;
  source: IngestSource;
  fetchFn?: FetchFn;
  maxItems?: number;
}): Promise<void> => {
  let items: FeedItem[];
  try {
    const response = await fetchFn(source.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xml = await response.text();
    items = parseRssFeed(xml);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .updateTable('sources')
      .set({ fetch_error: errorMsg, updated_at: new Date().toISOString() })
      .where('id', '=', source.id)
      .execute();
    throw err;
  }

  const now = new Date().toISOString();
  await db
    .updateTable('sources')
    .set({ fetch_error: null, last_fetched_at: now, updated_at: now })
    .where('id', '=', source.id)
    .execute();

  const isPodcast = source.type === 'podcast';

  for (const item of selectItemsToIngest(items, maxItems, source.direction)) {
    const id = crypto.randomUUID();

    let content = item.content;
    if (isPodcast && item.imageUrl && content) {
      // Feed readers often inject the episode artwork as a leading <img>;
      // strip it so the artwork isn't duplicated above the show notes
      const escapedUrl = item.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stripped = content.replace(new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*/?>`, 'gi'), '').trim();
      content = stripped || null;
    }

    await db
      .insertInto('articles')
      .values({
        id,
        source_id: source.id,
        external_id: item.externalId,
        url: item.url,
        title: item.title,
        author: item.author,
        summary: item.summary,
        content,
        image_url: item.imageUrl,
        published_at: item.publishedAt,
        media_url: item.mediaUrl,
        media_type: item.mediaType,
        consumption_time_seconds: item.consumptionTimeSeconds,
        // Podcast "content" is the feed's show notes — there is nothing to extract
        ...(isPodcast ? { extracted_at: new Date().toISOString() } : {}),
      })
      .onConflict((oc) => oc.columns(['source_id', 'external_id']).doNothing())
      .execute();
  }
};

export type { FeedItem, FetchFn, IngestSource };
export { parseRssFeed, fetchAndStoreFeed, selectItemsToIngest, DEFAULT_MAX_ITEMS_PER_FETCH };
