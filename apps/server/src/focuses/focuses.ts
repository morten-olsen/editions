import crypto from "node:crypto";

import { sql } from "kysely";

import { DatabaseService } from "../database/database.ts";
import { JobService } from "../jobs/jobs.ts";
import {
  VotesService,
  mergeVoteContexts,
  rankArticles,
} from "../votes/votes.ts";
import { computeScore, effectiveConfidence } from "../votes/votes.scoring.ts";

import type { FocusSourceMode } from "../database/database.types.ts";
import type { ReconcileFocusPayload } from "../jobs/jobs.handlers.ts";
import type { ScoringCandidate } from "../votes/votes.ts";
import type { Services } from "../services/services.ts";

// --- Errors ---

class FocusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FocusError";
  }
}

class FocusNotFoundError extends FocusError {
  constructor(id: string) {
    super(`Focus not found: ${id}`);
    this.name = "FocusNotFoundError";
  }
}

// --- Types ---

type CreateFocusParams = {
  userId: string;
  name: string;
  description?: string;
  icon?: string | null;
  minConfidence?: number;
  minConsumptionTimeSeconds?: number | null;
  maxConsumptionTimeSeconds?: number | null;
  sources?: FocusSource[];
};

type UpdateFocusParams = {
  name?: string;
  description?: string | null;
  icon?: string | null;
  minConfidence?: number;
  minConsumptionTimeSeconds?: number | null;
  maxConsumptionTimeSeconds?: number | null;
};

type FocusSource = {
  sourceId: string;
  mode: FocusSourceMode;
  weight: number;
};

type Focus = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sources: FocusSource[];
  createdAt: string;
  updatedAt: string;
};

// --- Service ---

class FocusesService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  #enqueueReconcileFocus = (focusId: string, userId?: string, forceReclassify?: boolean): void => {
    this.#services
      .get(JobService)
      .enqueue<ReconcileFocusPayload>("reconcile_focus", { focusId, forceReclassify }, {
        userId,
        affects: { focusIds: [focusId] },
      });
  };

  list = async (userId: string): Promise<Focus[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("focuses")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();

    const focusIds = rows.map((r) => r.id);
    const sourceLinks =
      focusIds.length > 0
        ? await db
            .selectFrom("focus_sources")
            .selectAll()
            .where("focus_id", "in", focusIds)
            .execute()
        : [];

    const sourceLinksByFocus = new Map<string, FocusSource[]>();
    for (const link of sourceLinks) {
      const arr = sourceLinksByFocus.get(link.focus_id) ?? [];
      arr.push({ sourceId: link.source_id, mode: link.mode as FocusSourceMode, weight: link.weight });
      sourceLinksByFocus.set(link.focus_id, arr);
    }

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      minConfidence: row.min_confidence,
      minConsumptionTimeSeconds: row.min_consumption_time_seconds,
      maxConsumptionTimeSeconds: row.max_consumption_time_seconds,
      sources: sourceLinksByFocus.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  };

  get = async (userId: string, id: string): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("focuses")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!row) {
      throw new FocusNotFoundError(id);
    }

    const sourceLinks = await db
      .selectFrom("focus_sources")
      .selectAll()
      .where("focus_id", "=", id)
      .execute();

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      minConfidence: row.min_confidence,
      minConsumptionTimeSeconds: row.min_consumption_time_seconds,
      maxConsumptionTimeSeconds: row.max_consumption_time_seconds,
      sources: sourceLinks.map((link) => ({
        sourceId: link.source_id,
        mode: link.mode as FocusSourceMode,
        weight: link.weight,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  create = async (params: CreateFocusParams): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const id = crypto.randomUUID();

    await db
      .insertInto("focuses")
      .values({
        id,
        user_id: params.userId,
        name: params.name,
        description: params.description ?? null,
        icon: params.icon ?? null,
        ...(params.minConfidence !== undefined
          ? { min_confidence: params.minConfidence }
          : {}),
        ...(params.minConsumptionTimeSeconds !== undefined
          ? { min_consumption_time_seconds: params.minConsumptionTimeSeconds }
          : {}),
        ...(params.maxConsumptionTimeSeconds !== undefined
          ? { max_consumption_time_seconds: params.maxConsumptionTimeSeconds }
          : {}),
      })
      .execute();

    if (params.sources && params.sources.length > 0) {
      await db
        .insertInto("focus_sources")
        .values(
          params.sources.map((s) => ({
            focus_id: id,
            source_id: s.sourceId,
            mode: s.mode,
            weight: s.weight,
          })),
        )
        .execute();

      // Trigger classification of existing articles against the new focus
      this.#enqueueReconcileFocus(id, params.userId);
    }

    return this.get(params.userId, id);
  };

  update = async (userId: string, id: string, params: UpdateFocusParams): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, id);

    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.name !== undefined) values.name = params.name;
    if (params.description !== undefined) values.description = params.description;
    if (params.icon !== undefined) values.icon = params.icon;
    if (params.minConfidence !== undefined) values.min_confidence = params.minConfidence;
    if (params.minConsumptionTimeSeconds !== undefined) values.min_consumption_time_seconds = params.minConsumptionTimeSeconds;
    if (params.maxConsumptionTimeSeconds !== undefined) values.max_consumption_time_seconds = params.maxConsumptionTimeSeconds;

    await db
      .updateTable("focuses")
      .set(values)
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();

    // If name or description changed, reclassify all articles for this focus.
    // Uses forceReclassify to upsert over existing scores rather than deleting
    // first — the feed stays populated while reclassification runs in the background.
    if (params.name !== undefined || params.description !== undefined) {
      this.#enqueueReconcileFocus(id, userId, true);
    }

    return this.get(userId, id);
  };

  delete = async (userId: string, id: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, id);

    await db
      .deleteFrom("focuses")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
  };

  setSources = async (
    userId: string,
    focusId: string,
    sources: FocusSource[],
  ): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, focusId);

    // Determine which sources were removed so we only delete their classifications
    const previousLinks = await db
      .selectFrom("focus_sources")
      .select("source_id")
      .where("focus_id", "=", focusId)
      .execute();

    const previousSourceIds = new Set(previousLinks.map((l) => l.source_id));
    const newSourceIds = new Set(sources.map((s) => s.sourceId));
    const removedSourceIds = [...previousSourceIds].filter((id) => !newSourceIds.has(id));
    const hasChanges = removedSourceIds.length > 0
      || [...newSourceIds].some((id) => !previousSourceIds.has(id))
      || sources.some((s) => {
        const prev = previousLinks.find((l) => l.source_id === s.sourceId);
        return prev === undefined;
      });

    // Replace all source associations
    await db.deleteFrom("focus_sources").where("focus_id", "=", focusId).execute();

    // Only delete classifications for articles from removed sources
    if (removedSourceIds.length > 0) {
      const removedArticleIds = await db
        .selectFrom("articles")
        .select("id")
        .where("source_id", "in", removedSourceIds)
        .execute();

      if (removedArticleIds.length > 0) {
        await db
          .deleteFrom("article_focuses")
          .where("focus_id", "=", focusId)
          .where("article_id", "in", removedArticleIds.map((a) => a.id))
          .execute();
      }
    }

    if (sources.length > 0) {
      await db
        .insertInto("focus_sources")
        .values(
          sources.map((s) => ({
            focus_id: focusId,
            source_id: s.sourceId,
            mode: s.mode,
            weight: s.weight,
          })),
        )
        .execute();

      // Reconcile will pick up articles from new sources that lack classifications
      if (hasChanges) {
        this.#enqueueReconcileFocus(focusId, userId);
      }
    }

    await db
      .updateTable("focuses")
      .set({ updated_at: new Date().toISOString() })
      .where("id", "=", focusId)
      .execute();

    return this.get(userId, focusId);
  };

  listArticles = async (
    userId: string,
    focusId: string,
    {
      offset = 0,
      limit = 20,
      sort = "top",
      from,
      to,
      status = "all",
    }: ListArticlesOptions = {},
  ): Promise<FocusArticlesPage> => {
    const focus = await this.get(userId, focusId);

    const db = await this.#services.get(DatabaseService).getInstance();

    // Build base query with filters
    const baseQuery = () => {
      let q = db
        .selectFrom("article_focuses")
        .innerJoin("articles", "articles.id", "article_focuses.article_id")
        .innerJoin("sources", "sources.id", "articles.source_id")
        .where("article_focuses.focus_id", "=", focusId)
        .where("sources.user_id", "=", userId);

      // Apply confidence threshold using COALESCE(nli, similarity)
      if (focus.minConfidence > 0) {
        q = q.where(
          sql`COALESCE(article_focuses.nli, article_focuses.similarity)`,
          ">=",
          focus.minConfidence,
        );
      }

      // Date range filter
      if (from) {
        q = q.where("articles.published_at", ">=", from);
      }
      if (to) {
        q = q.where("articles.published_at", "<=", to);
      }

      // Read status filter
      if (status === "unread") {
        q = q.where("articles.read_at", "is", null);
      } else if (status === "read") {
        q = q.where("articles.read_at", "is not", null);
      }

      // Reading time filters
      if (focus.minConsumptionTimeSeconds !== null) {
        q = q.where("articles.consumption_time_seconds", ">=", focus.minConsumptionTimeSeconds);
      }
      if (focus.maxConsumptionTimeSeconds !== null) {
        q = q.where("articles.consumption_time_seconds", "<=", focus.maxConsumptionTimeSeconds);
      }

      return q;
    };

    const countResult = await baseQuery()
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    // For "recent" sort, we can paginate in SQL — no scoring needed
    if (sort === "recent") {
      const rows = await baseQuery()
        .leftJoin(
          "article_embeddings",
          "article_embeddings.article_id",
          "articles.id",
        )
        .select([
          "articles.id",
          "articles.source_id",
          "articles.external_id",
          "articles.url",
          "articles.title",
          "articles.author",
          "articles.summary",
          "articles.image_url",
          "articles.published_at",
          "articles.consumption_time_seconds",
          "articles.read_at",
          "articles.created_at",
          "article_focuses.similarity",
          "article_focuses.nli",
          "sources.name as source_name",
          "sources.type as source_type",
        ])
        .orderBy("articles.published_at", "desc")
        .offset(offset)
        .limit(limit)
        .execute();

      // Get votes for the page
      const votesService = this.#services.get(VotesService);
      const articleIds = rows.map((r) => r.id);
      const votesMap = await votesService.getVotesByArticleIds(
        userId,
        articleIds,
        focusId,
      );

      return {
        articles: rows.map((row) => {
          const votes = votesMap.get(row.id);
          const confidence = row.nli ?? row.similarity ?? 0;
          return {
            id: row.id,
            sourceId: row.source_id,
            externalId: row.external_id,
            url: row.url,
            title: row.title,
            author: row.author,
            summary: row.summary,
            imageUrl: row.image_url,
            publishedAt: row.published_at,
            consumptionTimeSeconds: row.consumption_time_seconds,
            readAt: row.read_at,
            createdAt: row.created_at,
            confidence,
            score: confidence, // no vote scoring in recent mode
            vote: votes?.focus ?? null,
            globalVote: votes?.global ?? null,
            sourceName: row.source_name,
            sourceType: row.source_type,
          };
        }),
        total: Number(countResult.count),
        offset,
        limit,
      };
    }

    // "top" sort — fetch all, score, then paginate
    const rows = await baseQuery()
      .leftJoin(
        "article_embeddings",
        "article_embeddings.article_id",
        "articles.id",
      )
      .select([
        "articles.id",
        "articles.source_id",
        "articles.external_id",
        "articles.url",
        "articles.title",
        "articles.author",
        "articles.summary",
        "articles.image_url",
        "articles.published_at",
        "articles.consumption_time_seconds",
        "articles.read_at",
        "articles.created_at",
        "article_focuses.similarity",
        "article_focuses.nli",
        "article_embeddings.embedding",
        "sources.name as source_name",
        "sources.type as source_type",
      ])
      .execute();

    // Load vote contexts and user scoring weights for scoring
    const votesService = this.#services.get(VotesService);
    const [focusContext, globalContext, userWeights] = await Promise.all([
      votesService.loadVoteContext(userId, focusId),
      votesService.loadVoteContext(userId, null),
      votesService.loadUserScoringWeights(userId),
    ]);
    const voteContext = mergeVoteContexts(globalContext, focusContext);

    // Build source weight map from focus sources
    const sourceWeights = new Map<string, number>();
    for (const src of focus.sources) {
      sourceWeights.set(src.sourceId, src.weight);
    }

    // Build scoring candidates
    const candidates = rows.map((row) => {
      const embeddingBuf = row.embedding as Buffer | null;
      const embedding = embeddingBuf
        ? new Float32Array(
            embeddingBuf.buffer,
            embeddingBuf.byteOffset,
            embeddingBuf.byteLength / 4,
          )
        : null;

      return {
        articleId: row.id,
        similarity: row.similarity,
        nli: row.nli,
        publishedAt: row.published_at,
        embedding,
        sourceId: row.source_id,
        externalId: row.external_id,
        url: row.url,
        title: row.title,
        author: row.author,
        summary: row.summary,
        imageUrl: row.image_url,
        consumptionTimeSeconds: row.consumption_time_seconds,
        readAt: row.read_at,
        createdAt: row.created_at,
        sourceName: row.source_name,
        sourceType: row.source_type,
      };
    });

    // Score and rank (apply source weights to scores)
    const scored = candidates.map((c) => ({
      item: c,
      score: computeScore(c, voteContext, userWeights.focus) * (sourceWeights.get(c.sourceId) ?? 1),
    }));
    scored.sort((a, b) => b.score - a.score);
    const ranked = scored.map((s) => s.item);

    // Paginate
    const page = ranked.slice(offset, offset + limit);

    // Resolve vote display values for the page
    const articleIds = page.map((c) => c.articleId);
    const votesMap = await votesService.getVotesByArticleIds(
      userId,
      articleIds,
      focusId,
    );

    return {
      articles: page.map((c) => {
        const votes = votesMap.get(c.articleId);
        return {
          id: c.articleId,
          sourceId: c.sourceId,
          externalId: c.externalId,
          url: c.url,
          title: c.title,
          author: c.author,
          summary: c.summary,
          imageUrl: c.imageUrl,
          publishedAt: c.publishedAt,
          consumptionTimeSeconds: c.consumptionTimeSeconds,
          readAt: c.readAt,
          createdAt: c.createdAt,
          confidence: effectiveConfidence(c),
          score: computeScore(c, voteContext, userWeights.focus) * (sourceWeights.get(c.sourceId) ?? 1),
          vote: votes?.focus ?? null,
          globalVote: votes?.global ?? null,
          sourceName: c.sourceName,
          sourceType: c.sourceType,
        };
      }),
      total: Number(countResult.count),
      offset,
      limit,
    };
  };
}

// --- Types ---

type ArticleSort = "top" | "recent";
type ArticleStatus = "unread" | "read" | "all";

type ListArticlesOptions = {
  offset?: number;
  limit?: number;
  sort?: ArticleSort;
  from?: string;
  to?: string;
  status?: ArticleStatus;
};

type FocusArticle = {
  id: string;
  sourceId: string;
  externalId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  readAt: string | null;
  createdAt: string;
  confidence: number;
  score: number;
  vote: 1 | -1 | null;
  globalVote: 1 | -1 | null;
  sourceName: string;
  sourceType: string;
};

type FocusArticlesPage = {
  articles: FocusArticle[];
  total: number;
  offset: number;
  limit: number;
};

export type { Focus, FocusSource, FocusArticle, FocusArticlesPage, CreateFocusParams, UpdateFocusParams, ListArticlesOptions };
export { FocusesService, FocusError, FocusNotFoundError };
