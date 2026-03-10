import crypto from "node:crypto";

import { extract } from "@extractus/article-extractor";
import { XMLParser } from "fast-xml-parser";

import { DatabaseService } from "../database/database.ts";
import { SourcesService } from "./sources.ts";
import { TaskService } from "../tasks/tasks.ts";

import type { AnalyseArticlePayload } from "../analysis/analysis.ts";
import type { Services } from "../services/services.ts";

// --- Types ---

type FetchSourcePayload = {
  sourceId: string;
  userId: string;
};

type ExtractArticlePayload = {
  articleId: string;
  userId?: string;
};

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

type FetchResult = {
  sourceId: string;
  newArticles: number;
  totalItems: number;
};

// --- RSS parsing ---

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const parseRssFeed = (xml: string): FeedItem[] => {
  const parsed = parser.parse(xml) as Record<string, unknown>;

  // RSS 2.0
  const rssChannel = getNestedValue(parsed, "rss", "channel") as Record<string, unknown> | undefined;
  if (rssChannel) {
    return normalizeItems(rssChannel.item);
  }

  // Atom
  const atomFeed = parsed.feed as Record<string, unknown> | undefined;
  if (atomFeed) {
    return normalizeAtomEntries(atomFeed.entry);
  }

  // RSS 1.0 (RDF)
  const rdf = parsed["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rdf) {
    return normalizeItems(rdf.item);
  }

  return [];
};

const normalizeItems = (items: unknown): FeedItem[] => {
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];

  return arr.map((item: Record<string, unknown>): FeedItem => {
    const guid = item.guid;
    const guidText = typeof guid === "object" && guid !== null
      ? (guid as Record<string, unknown>)["#text"]
      : guid;

    const { mediaUrl, mediaType } = extractMediaEnclosure(item);

    return {
      externalId: String(guidText ?? item.link ?? crypto.randomUUID()),
      url: toStringOrNull(item.link),
      title: String(item.title ?? "Untitled"),
      author: toStringOrNull(item["dc:creator"] ?? item.author ?? item["itunes:author"]),
      summary: toStringOrNull(item.description),
      content: toStringOrNull(item["content:encoded"]),
      imageUrl: extractImageUrl(item),
      publishedAt: toIsoDate(item.pubDate ?? item["dc:date"]),
      mediaUrl,
      mediaType,
      consumptionTimeSeconds: parseItunesDuration(item["itunes:duration"]),
    };
  });
};

const normalizeAtomEntries = (entries: unknown): FeedItem[] => {
  if (!entries) return [];
  const arr = Array.isArray(entries) ? entries : [entries];

  return arr.map((entry: Record<string, unknown>): FeedItem => {
    const link = extractAtomLink(entry.link);

    return {
      externalId: String(entry.id ?? link ?? crypto.randomUUID()),
      url: link,
      title: String(
        typeof entry.title === "object" && entry.title !== null
          ? (entry.title as Record<string, unknown>)["#text"]
          : entry.title ?? "Untitled",
      ),
      author: extractAtomAuthor(entry.author),
      summary: toStringOrNull(
        typeof entry.summary === "object" && entry.summary !== null
          ? (entry.summary as Record<string, unknown>)["#text"]
          : entry.summary,
      ),
      content: toStringOrNull(
        typeof entry.content === "object" && entry.content !== null
          ? (entry.content as Record<string, unknown>)["#text"]
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
  if (!link) return null;
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alternate = link.find(
      (l: Record<string, unknown>) =>
        l["@_rel"] === "alternate" || !l["@_rel"],
    ) as Record<string, unknown> | undefined;
    return toStringOrNull(alternate?.["@_href"]);
  }
  if (typeof link === "object") {
    return toStringOrNull((link as Record<string, unknown>)["@_href"]);
  }
  return null;
};

const extractAtomAuthor = (author: unknown): string | null => {
  if (!author) return null;
  if (typeof author === "string") return author;
  if (typeof author === "object") {
    return toStringOrNull((author as Record<string, unknown>).name);
  }
  return null;
};

const extractImageUrl = (item: Record<string, unknown>): string | null => {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (enclosure) {
    const type = String(enclosure["@_type"] ?? "");
    if (type.startsWith("image/")) {
      return toStringOrNull(enclosure["@_url"]);
    }
  }
  // Podcast feeds often use itunes:image for episode artwork
  const itunesImage = item["itunes:image"] as Record<string, unknown> | undefined;
  if (itunesImage) {
    return toStringOrNull(itunesImage["@_href"]);
  }
  // Megaphone and other feeds use media:thumbnail
  const mediaThumbnail = item["media:thumbnail"] as Record<string, unknown> | undefined;
  if (mediaThumbnail) {
    return toStringOrNull(mediaThumbnail["@_url"]);
  }
  // media:content with image medium or type
  const mediaContent = item["media:content"] as Record<string, unknown> | undefined;
  if (mediaContent) {
    const medium = String(mediaContent["@_medium"] ?? "");
    const mediaType = String(mediaContent["@_type"] ?? "");
    if (medium === "image" || mediaType.startsWith("image/")) {
      return toStringOrNull(mediaContent["@_url"]);
    }
  }
  return null;
};

const extractMediaEnclosure = (item: Record<string, unknown>): { mediaUrl: string | null; mediaType: string | null } => {
  const enclosure = item.enclosure as Record<string, unknown> | undefined;
  if (!enclosure) return { mediaUrl: null, mediaType: null };

  const type = String(enclosure["@_type"] ?? "");
  if (type.startsWith("audio/") || type.startsWith("video/")) {
    return {
      mediaUrl: toStringOrNull(enclosure["@_url"]),
      mediaType: type || null,
    };
  }

  return { mediaUrl: null, mediaType: null };
};

const parseItunesDuration = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s.length === 0) return null;

  const parts = s.split(":").map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return null;
};

const toStringOrNull = (val: unknown): string | null => {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
};

const toIsoDate = (val: unknown): string | null => {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const getNestedValue = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

// --- Task handlers ---

const handleFetchSource = async (payload: FetchSourcePayload, services: Services): Promise<FetchResult> => {
  const sourcesService = services.get(SourcesService);
  const source = await sourcesService.get(payload.userId, payload.sourceId);
  const db = await services.get(DatabaseService).getInstance();

  let items: FeedItem[];
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xml = await response.text();
    items = parseRssFeed(xml);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Update source with fetch error
    await db
      .updateTable("sources")
      .set({ fetch_error: errorMsg, updated_at: new Date().toISOString() })
      .where("id", "=", source.id)
      .execute();
    throw err;
  }

  // Clear fetch error, update last_fetched_at
  const now = new Date().toISOString();
  await db
    .updateTable("sources")
    .set({ fetch_error: null, last_fetched_at: now, updated_at: now })
    .where("id", "=", source.id)
    .execute();

  // Insert articles, dedup on (source_id, external_id)
  const taskService = services.get(TaskService);
  const isPodcast = source.type === "podcast";
  let newArticles = 0;

  for (const item of items) {
    const id = crypto.randomUUID();

    // For podcasts, strip the episode image from content when it duplicates image_url.
    // Podcast feeds (e.g. Darknet Diaries) often put the episode artwork as an <img>
    // in content:encoded — the same image is already captured in image_url, so showing
    // it in the content body would duplicate it.
    let content = item.content;
    if (isPodcast && item.imageUrl && content) {
      const escapedUrl = item.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stripped = content
        .replace(new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*/?>`, "gi"), "")
        .trim();
      content = stripped || null;
    }

    const result = await db
      .insertInto("articles")
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
        // Podcast episodes are fully described by the feed — mark extracted immediately
        ...(isPodcast ? { extracted_at: new Date().toISOString() } : {}),
      })
      .onConflict((oc) => oc.columns(["source_id", "external_id"]).doNothing())
      .returning("id")
      .executeTakeFirst();

    if (result) {
      newArticles++;

      if (isPodcast) {
        // Podcast: skip extraction, go straight to analysis if we have content
        if (item.summary || item.content) {
          taskService.enqueue<AnalyseArticlePayload>("analyse_article", {
            articleId: result.id,
          }, { userId: payload.userId });
        }
      } else {
        // Article: queue extraction which chains to analysis
        taskService.enqueue<ExtractArticlePayload>("extract_article", {
          articleId: result.id,
          userId: payload.userId,
        }, { userId: payload.userId });
      }
    }
  }

  return {
    sourceId: source.id,
    newArticles,
    totalItems: items.length,
  };
};

const WORDS_PER_MINUTE = 238;

const handleExtractArticle = async (payload: ExtractArticlePayload, services: Services): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();

  const article = await db
    .selectFrom("articles")
    .innerJoin("sources", "sources.id", "articles.source_id")
    .select(["articles.id", "articles.url", "articles.title", "articles.content", "articles.extracted_at", "sources.type as source_type"])
    .where("articles.id", "=", payload.articleId)
    .executeTakeFirst();

  if (!article) return;

  // Podcast episodes are fully handled at fetch time — no extraction needed
  if (article.source_type === "podcast") return;

  // Extract full content if we don't already have substantial content
  if (!article.extracted_at && article.url) {
    try {
      const result = await extract(article.url);
      if (result?.content) {
        const wordCount = result.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
        const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

        const updates: Record<string, unknown> = {
          content: result.content,
          consumption_time_seconds: consumptionTimeSeconds,
          image_url: result.image ?? undefined,
          extracted_at: new Date().toISOString(),
        };

        // Backfill metadata from extractor when the article has placeholder values
        // (e.g. bookmarked-by-URL articles where only the URL was known at creation)
        if (result.title && article.title === article.url) {
          updates.title = result.title;
        }
        if (result.author) updates.author = result.author;
        if (result.description) updates.summary = result.description;

        await db
          .updateTable("articles")
          .set(updates)
          .where("id", "=", article.id)
          .execute();
      } else if (article.content) {
        // Extractor returned nothing but we have feed content — mark as extracted
        const wordCount = article.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
        const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

        await db
          .updateTable("articles")
          .set({
            consumption_time_seconds: consumptionTimeSeconds,
            extracted_at: new Date().toISOString(),
          })
          .where("id", "=", article.id)
          .execute();
      }
    } catch {
      // Extraction failures are non-fatal — if we have feed content, mark extracted
      if (article.content) {
        const wordCount = article.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
        const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

        await db
          .updateTable("articles")
          .set({
            consumption_time_seconds: consumptionTimeSeconds,
            extracted_at: new Date().toISOString(),
          })
          .where("id", "=", article.id)
          .execute();
      }
    }
  }

  // Reload to check if we have content for analysis
  const updated = await db
    .selectFrom("articles")
    .select(["id", "content"])
    .where("id", "=", article.id)
    .executeTakeFirst();

  if (updated?.content) {
    const taskService = services.get(TaskService);
    taskService.enqueue<AnalyseArticlePayload>("analyse_article", {
      articleId: updated.id,
    }, { userId: payload.userId });
  }
};

// --- Registration ---

const registerSourceTaskHandlers = (services: Services): void => {
  const taskService = services.get(TaskService);
  taskService.register<FetchSourcePayload>("fetch_source", handleFetchSource);
  taskService.register<ExtractArticlePayload>("extract_article", handleExtractArticle);
};

export type { FetchSourcePayload, ExtractArticlePayload, FetchResult };
export { registerSourceTaskHandlers };
