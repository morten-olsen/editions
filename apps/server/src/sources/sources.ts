import crypto from "node:crypto";

import { DatabaseService } from "../database/database.ts";

import type { Services } from "../services/services.ts";

// --- Errors ---

class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

class SourceNotFoundError extends SourceError {
  constructor(id: string) {
    super(`Source not found: ${id}`);
    this.name = "SourceNotFoundError";
  }
}

// --- Types ---

type CreateSourceParams = {
  userId: string;
  name: string;
  url: string;
  config?: Record<string, unknown>;
};

type UpdateSourceParams = {
  name?: string;
  url?: string;
  config?: Record<string, unknown>;
};

type Source = {
  id: string;
  userId: string;
  type: string;
  name: string;
  url: string;
  config: Record<string, unknown>;
  lastFetchedAt: string | null;
  fetchError: string | null;
  createdAt: string;
  updatedAt: string;
};

type Article = {
  id: string;
  sourceId: string;
  externalId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type ArticleDetail = Article & {
  content: string | null;
  wordCount: number | null;
  readingTimeSeconds: number | null;
  readAt: string | null;
  extractedAt: string | null;
};

type ArticlesPage = {
  articles: Article[];
  total: number;
  offset: number;
  limit: number;
};

// --- Service ---

class SourcesService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  list = async (userId: string): Promise<Source[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("sources")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(toSource);
  };

  getOrCreateBookmarksSource = async (userId: string): Promise<Source> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const existing = await db
      .selectFrom("sources")
      .selectAll()
      .where("user_id", "=", userId)
      .where("type", "=", "bookmarks")
      .executeTakeFirst();

    if (existing) {
      return toSource(existing);
    }

    const id = crypto.randomUUID();

    await db
      .insertInto("sources")
      .values({
        id,
        user_id: userId,
        type: "bookmarks",
        name: "Saved Articles",
        url: "bookmarks://saved",
        config: "{}",
      })
      .execute();

    return this.get(userId, id);
  };

  get = async (userId: string, id: string): Promise<Source> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("sources")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!row) {
      throw new SourceNotFoundError(id);
    }

    return toSource(row);
  };

  create = async (params: CreateSourceParams): Promise<Source> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const id = crypto.randomUUID();
    const config = JSON.stringify(params.config ?? {});

    await db
      .insertInto("sources")
      .values({
        id,
        user_id: params.userId,
        type: "rss",
        name: params.name,
        url: params.url,
        config,
      })
      .execute();

    return this.get(params.userId, id);
  };

  update = async (userId: string, id: string, params: UpdateSourceParams): Promise<Source> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, id);

    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.name !== undefined) values.name = params.name;
    if (params.url !== undefined) values.url = params.url;
    if (params.config !== undefined) values.config = JSON.stringify(params.config);

    await db
      .updateTable("sources")
      .set(values)
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();

    return this.get(userId, id);
  };

  listArticles = async (userId: string, sourceId: string, { offset = 0, limit = 20 }: { offset?: number; limit?: number } = {}): Promise<ArticlesPage> => {
    // Verify ownership
    await this.get(userId, sourceId);

    const db = await this.#services.get(DatabaseService).getInstance();

    const countResult = await db
      .selectFrom("articles")
      .select(db.fn.countAll().as("count"))
      .where("source_id", "=", sourceId)
      .executeTakeFirstOrThrow();

    const rows = await db
      .selectFrom("articles")
      .select([
        "id", "source_id", "external_id", "url", "title",
        "author", "summary", "image_url", "published_at", "created_at",
      ])
      .where("source_id", "=", sourceId)
      .orderBy("published_at", "desc")
      .orderBy("created_at", "desc")
      .offset(offset)
      .limit(limit)
      .execute();

    return {
      articles: rows.map((row): Article => ({
        id: row.id,
        sourceId: row.source_id,
        externalId: row.external_id,
        url: row.url,
        title: row.title,
        author: row.author,
        summary: row.summary,
        imageUrl: row.image_url,
        publishedAt: row.published_at,
        createdAt: row.created_at,
      })),
      total: Number(countResult.count),
      offset,
      limit,
    };
  };

  getArticle = async (userId: string, articleId: string): Promise<ArticleDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("articles")
      .innerJoin("sources", "sources.id", "articles.source_id")
      .select([
        "articles.id", "articles.source_id", "articles.external_id",
        "articles.url", "articles.title", "articles.author",
        "articles.summary", "articles.content", "articles.word_count",
        "articles.reading_time_seconds", "articles.image_url",
        "articles.published_at", "articles.read_at", "articles.extracted_at",
        "articles.created_at",
      ])
      .where("articles.id", "=", articleId)
      .where("sources.user_id", "=", userId)
      .executeTakeFirst();

    if (!row) {
      throw new SourceNotFoundError(articleId);
    }

    return {
      id: row.id,
      sourceId: row.source_id,
      externalId: row.external_id,
      url: row.url,
      title: row.title,
      author: row.author,
      summary: row.summary,
      content: row.content,
      wordCount: row.word_count,
      readingTimeSeconds: row.reading_time_seconds,
      imageUrl: row.image_url,
      publishedAt: row.published_at,
      readAt: row.read_at,
      extractedAt: row.extracted_at,
      createdAt: row.created_at,
    };
  };

  setArticleReadStatus = async (
    userId: string,
    articleId: string,
    read: boolean,
  ): Promise<ArticleDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership via getArticle
    await this.getArticle(userId, articleId);

    await db
      .updateTable("articles")
      .set({ read_at: read ? new Date().toISOString() : null })
      .where("id", "=", articleId)
      .execute();

    return this.getArticle(userId, articleId);
  };

  delete = async (userId: string, id: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, id);

    await db
      .deleteFrom("sources")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
  };
}

// --- Helpers ---

const toSource = (row: {
  id: string;
  user_id: string;
  type: string;
  name: string;
  url: string;
  config: string;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: string;
  updated_at: string;
}): Source => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  name: row.name,
  url: row.url,
  config: JSON.parse(row.config) as Record<string, unknown>,
  lastFetchedAt: row.last_fetched_at,
  fetchError: row.fetch_error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export type { Source, Article, ArticleDetail, ArticlesPage, CreateSourceParams, UpdateSourceParams };
export { SourcesService, SourceError, SourceNotFoundError };
