import crypto from 'node:crypto';

import { XMLParser } from 'fast-xml-parser';

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

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  htmlEntities: true,
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

export type { FeedItem };
export { parseRssFeed };
