import crypto from "node:crypto";

import { DatabaseService } from "../database/database.ts";

import type { ArticleVoteValue } from "../database/database.types.ts";
import type { Services } from "../services/services.ts";
import type { UserScoringWeights, VoteContext, VotedArticle } from "./votes.scoring.ts";
import { MAX_VOTE_CONTEXT_SIZE, emptyVoteContext, mergeVoteContexts, parseUserScoringWeights, rankArticles } from "./votes.scoring.ts";

// --- Errors ---

class VoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoteError";
  }
}

class ArticleNotFoundForVoteError extends VoteError {
  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ArticleNotFoundForVoteError";
  }
}

// --- Types ---

type Vote = {
  id: string;
  userId: string;
  articleId: string;
  focusId: string | null;
  editionId: string | null;
  value: ArticleVoteValue;
  createdAt: string;
};

type UpsertVoteParams = {
  userId: string;
  articleId: string;
  focusId: string | null;
  editionId: string | null;
  value: ArticleVoteValue;
};

type ArticleVotePair = {
  focus: ArticleVoteValue | null;
  global: ArticleVoteValue | null;
  edition: ArticleVoteValue | null;
};

type ArticleVotesMap = Map<string, ArticleVotePair>;

type ListVotesOptions = {
  offset?: number;
  limit?: number;
  scope?: "global" | "focus" | "edition";
  value?: ArticleVoteValue;
};

type VoteWithArticle = {
  id: string;
  articleId: string;
  focusId: string | null;
  value: ArticleVoteValue;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  sourceId: string;
  sourceName: string;
  focusName: string | null;
};

type VotesPage = {
  votes: VoteWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

// --- Service ---

class VotesService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  upsert = async (params: UpsertVoteParams): Promise<Vote> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify article exists
    const article = await db
      .selectFrom("articles")
      .select("id")
      .where("id", "=", params.articleId)
      .executeTakeFirst();

    if (!article) {
      throw new ArticleNotFoundForVoteError(params.articleId);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Delete-then-insert in a transaction to handle partial unique index
    await db.transaction().execute(async (trx) => {
      let query = trx
        .deleteFrom("article_votes")
        .where("user_id", "=", params.userId)
        .where("article_id", "=", params.articleId);

      if (params.focusId === null) {
        query = query.where("focus_id", "is", null);
      } else {
        query = query.where("focus_id", "=", params.focusId);
      }

      if (params.editionId === null) {
        query = query.where("edition_id", "is", null);
      } else {
        query = query.where("edition_id", "=", params.editionId);
      }

      await query.execute();

      await trx
        .insertInto("article_votes")
        .values({
          id,
          user_id: params.userId,
          article_id: params.articleId,
          focus_id: params.focusId,
          edition_id: params.editionId,
          value: params.value,
          created_at: now,
        })
        .execute();
    });

    return {
      id,
      userId: params.userId,
      articleId: params.articleId,
      focusId: params.focusId,
      editionId: params.editionId,
      value: params.value,
      createdAt: now,
    };
  };

  remove = async (
    userId: string,
    articleId: string,
    focusId: string | null,
    editionId: string | null = null,
  ): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    let query = db
      .deleteFrom("article_votes")
      .where("user_id", "=", userId)
      .where("article_id", "=", articleId);

    if (focusId === null) {
      query = query.where("focus_id", "is", null);
    } else {
      query = query.where("focus_id", "=", focusId);
    }

    if (editionId === null) {
      query = query.where("edition_id", "is", null);
    } else {
      query = query.where("edition_id", "=", editionId);
    }

    await query.execute();
  };

  getForArticle = async (
    userId: string,
    articleId: string,
    focusId: string | null,
  ): Promise<Vote | null> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    let query = db
      .selectFrom("article_votes")
      .selectAll()
      .where("user_id", "=", userId)
      .where("article_id", "=", articleId);

    if (focusId === null) {
      query = query.where("focus_id", "is", null);
    } else {
      query = query.where("focus_id", "=", focusId);
    }

    const row = await query.executeTakeFirst();
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      focusId: row.focus_id,
      editionId: row.edition_id,
      value: row.value as ArticleVoteValue,
      createdAt: row.created_at,
    };
  };

  loadVoteContext = async (
    userId: string,
    focusId: string | null,
  ): Promise<VoteContext> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    let query = db
      .selectFrom("article_votes")
      .leftJoin(
        "article_embeddings",
        "article_embeddings.article_id",
        "article_votes.article_id",
      )
      .select([
        "article_votes.article_id",
        "article_votes.value",
        "article_embeddings.embedding",
      ])
      .where("article_votes.user_id", "=", userId)
      .orderBy("article_votes.created_at", "desc")
      .limit(MAX_VOTE_CONTEXT_SIZE);

    if (focusId === null) {
      query = query.where("article_votes.focus_id", "is", null);
    } else {
      query = query.where("article_votes.focus_id", "=", focusId);
    }

    const rows = await query.execute();

    const votes = new Map<string, 1 | -1>();
    const votedArticles: VotedArticle[] = [];

    for (const row of rows) {
      const value = row.value as ArticleVoteValue;
      votes.set(row.article_id, value);

      if (row.embedding) {
        const buffer = row.embedding as Buffer;
        const embedding = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4,
        );
        votedArticles.push({ embedding, value });
      }
    }

    return { votes, votedArticles };
  };

  loadEditionVoteContext = async (
    userId: string,
    editionConfigId: string,
  ): Promise<VoteContext> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("article_votes")
      .innerJoin("editions", "editions.id", "article_votes.edition_id")
      .leftJoin(
        "article_embeddings",
        "article_embeddings.article_id",
        "article_votes.article_id",
      )
      .select([
        "article_votes.article_id",
        "article_votes.value",
        "article_embeddings.embedding",
      ])
      .where("article_votes.user_id", "=", userId)
      .where("editions.edition_config_id", "=", editionConfigId)
      .orderBy("article_votes.created_at", "desc")
      .limit(MAX_VOTE_CONTEXT_SIZE)
      .execute();

    const votes = new Map<string, 1 | -1>();
    const votedArticles: VotedArticle[] = [];

    for (const row of rows) {
      const value = row.value as ArticleVoteValue;
      votes.set(row.article_id, value);

      if (row.embedding) {
        const buffer = row.embedding as Buffer;
        const embedding = new Float32Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength / 4,
        );
        votedArticles.push({ embedding, value });
      }
    }

    return { votes, votedArticles };
  };

  listByUser = async (
    userId: string,
    { offset = 0, limit = 50, scope, value }: ListVotesOptions = {},
  ): Promise<VotesPage> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const baseQuery = () => {
      let q = db
        .selectFrom("article_votes")
        .innerJoin("articles", "articles.id", "article_votes.article_id")
        .innerJoin("sources", "sources.id", "articles.source_id")
        .leftJoin("focuses", "focuses.id", "article_votes.focus_id")
        .where("article_votes.user_id", "=", userId);

      if (scope === "global") {
        q = q.where("article_votes.focus_id", "is", null).where("article_votes.edition_id", "is", null);
      } else if (scope === "focus") {
        q = q.where("article_votes.focus_id", "is not", null);
      } else if (scope === "edition") {
        q = q.where("article_votes.edition_id", "is not", null);
      }

      if (value !== undefined) {
        q = q.where("article_votes.value", "=", value);
      }

      return q;
    };

    const countResult = await baseQuery()
      .select(db.fn.countAll().as("count"))
      .executeTakeFirstOrThrow();

    const rows = await baseQuery()
      .select([
        "article_votes.id",
        "article_votes.article_id",
        "article_votes.focus_id",
        "article_votes.value",
        "article_votes.created_at",
        "articles.title as article_title",
        "articles.url as article_url",
        "articles.source_id",
        "sources.name as source_name",
        "focuses.name as focus_name",
      ])
      .orderBy("article_votes.created_at", "desc")
      .offset(offset)
      .limit(limit)
      .execute();

    return {
      votes: rows.map((row) => ({
        id: row.id,
        articleId: row.article_id,
        focusId: row.focus_id,
        value: row.value as ArticleVoteValue,
        createdAt: row.created_at,
        articleTitle: row.article_title,
        articleUrl: row.article_url,
        sourceId: row.source_id,
        sourceName: row.source_name,
        focusName: (row.focus_name as string | null) ?? null,
      })),
      total: Number(countResult.count),
      offset,
      limit,
    };
  };

  removeById = async (userId: string, voteId: string): Promise<boolean> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const result = await db
      .deleteFrom("article_votes")
      .where("id", "=", voteId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return result.numDeletedRows > 0n;
  };

  loadUserScoringWeights = async (userId: string): Promise<UserScoringWeights> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const row = await db
      .selectFrom("users")
      .select("scoring_weights")
      .where("id", "=", userId)
      .executeTakeFirst();
    return parseUserScoringWeights(row?.scoring_weights ?? null);
  };

  saveUserScoringWeights = async (userId: string, weights: UserScoringWeights): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await db
      .updateTable("users")
      .set({
        scoring_weights: JSON.stringify(weights),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", userId)
      .execute();
  };

  resetUserScoringWeights = async (userId: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await db
      .updateTable("users")
      .set({
        scoring_weights: null,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", userId)
      .execute();
  };

  getVotesByArticleIds = async (
    userId: string,
    articleIds: string[],
    focusId: string | null,
    editionId: string | null = null,
  ): Promise<ArticleVotesMap> => {
    if (articleIds.length === 0) return new Map();

    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("article_votes")
      .select(["article_id", "focus_id", "edition_id", "value"])
      .where("user_id", "=", userId)
      .where("article_id", "in", articleIds)
      .where((eb) => {
        const conditions = [
          // Global votes (no focus, no edition)
          eb.and([eb("focus_id", "is", null), eb("edition_id", "is", null)]),
        ];
        if (focusId !== null) {
          conditions.push(eb("focus_id", "=", focusId));
        }
        if (editionId !== null) {
          conditions.push(eb("edition_id", "=", editionId));
        }
        return eb.or(conditions);
      })
      .execute();

    const result: ArticleVotesMap = new Map();

    for (const row of rows) {
      const value = row.value as ArticleVoteValue;
      const existing = result.get(row.article_id) ?? { focus: null, global: null, edition: null };

      if (row.edition_id !== null) {
        existing.edition = value;
      } else if (row.focus_id !== null) {
        existing.focus = value;
      } else {
        existing.global = value;
      }

      result.set(row.article_id, existing);
    }

    return result;
  };
}

export type { Vote, UpsertVoteParams, ArticleVotePair, ArticleVotesMap, ListVotesOptions, VoteWithArticle, VotesPage };
export { VotesService, VoteError, ArticleNotFoundForVoteError };

// Re-export scoring utilities for consumers
export type { VoteContext, ScoringCandidate, UserScoringWeights } from "./votes.scoring.ts";
export { rankArticles, mergeVoteContexts, emptyVoteContext, defaultUserScoringWeights } from "./votes.scoring.ts";
