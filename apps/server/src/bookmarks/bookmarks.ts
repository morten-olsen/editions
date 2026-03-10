import crypto from "node:crypto";

import { DatabaseService } from "../database/database.ts";
import { SourcesService } from "../sources/sources.ts";
import { TaskService } from "../tasks/tasks.ts";

import type { ExtractArticlePayload } from "../sources/sources.fetch.ts";
import type { Services } from "../services/services.ts";

// --- Types ---

type Bookmark = {
  id: string;
  userId: string;
  articleId: string;
  createdAt: string;
};

type BookmarkWithArticle = {
  id: string;
  articleId: string;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  sourceId: string;
  sourceName: string;
  sourceType: string;
};

type BookmarksPage = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

type SavedArticle = {
  bookmark: Bookmark;
  articleId: string;
  sourceId: string;
};

type ListBookmarksOptions = {
  offset?: number;
  limit?: number;
};

// --- Service ---

class BookmarksService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  saveUrl = async (userId: string, url: string): Promise<SavedArticle> => {
    const sourcesService = this.#services.get(SourcesService);
    const source = await sourcesService.getOrCreateBookmarksSource(userId);
    const db = await this.#services.get(DatabaseService).getInstance();

    // Check if this URL already exists under the bookmarks source
    const existing = await db
      .selectFrom("articles")
      .select("id")
      .where("source_id", "=", source.id)
      .where("url", "=", url)
      .executeTakeFirst();

    let articleId: string;

    if (existing) {
      articleId = existing.id;
    } else {
      articleId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .insertInto("articles")
        .values({
          id: articleId,
          source_id: source.id,
          external_id: url,
          url,
          title: url,
          published_at: now,
        })
        .execute();

      // Enqueue extraction (which chains to analysis)
      const taskService = this.#services.get(TaskService);
      taskService.enqueue<ExtractArticlePayload>("extract_article", {
        articleId,
        userId,
      }, { userId });
    }

    const bookmark = await this.add(userId, articleId);

    return { bookmark, articleId, sourceId: source.id };
  };

  add = async (userId: string, articleId: string): Promise<Bookmark> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Check if already bookmarked
    const existing = await db
      .selectFrom("bookmarks")
      .selectAll()
      .where("user_id", "=", userId)
      .where("article_id", "=", articleId)
      .executeTakeFirst();

    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        articleId: existing.article_id,
        createdAt: existing.created_at,
      };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .insertInto("bookmarks")
      .values({
        id,
        user_id: userId,
        article_id: articleId,
        created_at: now,
      })
      .execute();

    return { id, userId, articleId, createdAt: now };
  };

  remove = async (userId: string, articleId: string): Promise<boolean> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const result = await db
      .deleteFrom("bookmarks")
      .where("user_id", "=", userId)
      .where("article_id", "=", articleId)
      .executeTakeFirst();

    return result.numDeletedRows > 0n;
  };

  isBookmarked = async (userId: string, articleId: string): Promise<boolean> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("bookmarks")
      .select("id")
      .where("user_id", "=", userId)
      .where("article_id", "=", articleId)
      .executeTakeFirst();

    return row !== undefined;
  };

  getBookmarkedArticleIds = async (
    userId: string,
    articleIds: string[],
  ): Promise<Set<string>> => {
    if (articleIds.length === 0) return new Set();

    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("bookmarks")
      .select("article_id")
      .where("user_id", "=", userId)
      .where("article_id", "in", articleIds)
      .execute();

    return new Set(rows.map((r) => r.article_id));
  };

  listByUser = async (
    userId: string,
    { offset = 0, limit = 50 }: ListBookmarksOptions = {},
  ): Promise<BookmarksPage> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const countResult = await db
      .selectFrom("bookmarks")
      .select(db.fn.countAll().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();

    const rows = await db
      .selectFrom("bookmarks")
      .innerJoin("articles", "articles.id", "bookmarks.article_id")
      .innerJoin("sources", "sources.id", "articles.source_id")
      .where("bookmarks.user_id", "=", userId)
      .select([
        "bookmarks.id",
        "bookmarks.article_id",
        "bookmarks.created_at",
        "articles.title as article_title",
        "articles.url as article_url",
        "articles.author",
        "articles.summary",
        "articles.image_url",
        "articles.published_at",
        "articles.consumption_time_seconds",
        "articles.source_id",
        "sources.name as source_name",
        "sources.type as source_type",
      ])
      .orderBy("bookmarks.created_at", "desc")
      .offset(offset)
      .limit(limit)
      .execute();

    return {
      bookmarks: rows.map((row) => ({
        id: row.id,
        articleId: row.article_id,
        createdAt: row.created_at,
        articleTitle: row.article_title,
        articleUrl: row.article_url,
        author: row.author,
        summary: row.summary,
        imageUrl: row.image_url,
        publishedAt: row.published_at,
        consumptionTimeSeconds: row.consumption_time_seconds,
        sourceId: row.source_id,
        sourceName: row.source_name,
        sourceType: row.source_type,
      })),
      total: Number(countResult.count),
      offset,
      limit,
    };
  };
}

export type { Bookmark, BookmarkWithArticle, BookmarksPage, ListBookmarksOptions, SavedArticle };
export { BookmarksService };
