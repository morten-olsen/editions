import crypto from "node:crypto";

import { DatabaseService } from "../database/database.ts";
import { FocusesService } from "../focuses/focuses.ts";
import {
  VotesService,
  mergeVoteContexts,
} from "../votes/votes.ts";
import { computeScore } from "../votes/votes.scoring.ts";

import type { EditionBudgetType } from "../database/database.types.ts";
import type { Services } from "../services/services.ts";

// --- Errors ---

class EditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditionError";
  }
}

class EditionConfigNotFoundError extends EditionError {
  constructor(id: string) {
    super(`Edition config not found: ${id}`);
    this.name = "EditionConfigNotFoundError";
  }
}

class EditionNotFoundError extends EditionError {
  constructor(id: string) {
    super(`Edition not found: ${id}`);
    this.name = "EditionNotFoundError";
  }
}

// --- Types ---

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours: number | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  userId: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
  createdAt: string;
  updatedAt: string;
};

type CreateEditionConfigParams = {
  userId: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions?: boolean;
  enabled?: boolean;
  focuses: CreateEditionConfigFocusParams[];
};

type CreateEditionConfigFocusParams = {
  focusId: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours?: number | null;
  weight?: number;
};

type UpdateEditionConfigParams = {
  name?: string;
  schedule?: string;
  lookbackHours?: number;
  excludePriorEditions?: boolean;
  enabled?: boolean;
  focuses?: CreateEditionConfigFocusParams[];
};

type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  readingTimeSeconds: number | null;
  readAt: string | null;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type Edition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  createdAt: string;
};

type EditionDetail = Edition & {
  articles: EditionArticle[];
};

type EditionSummary = Edition & {
  configName: string;
};

// --- Service ---

class EditionsService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  // --- Edition Config CRUD ---

  listConfigs = async (userId: string): Promise<EditionConfig[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom("edition_configs")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();

    const configIds = rows.map((r) => r.id);
    const focusLinks =
      configIds.length > 0
        ? await db
            .selectFrom("edition_config_focuses")
            .innerJoin("focuses", "focuses.id", "edition_config_focuses.focus_id")
            .select([
              "edition_config_focuses.edition_config_id",
              "edition_config_focuses.focus_id",
              "edition_config_focuses.position",
              "edition_config_focuses.budget_type",
              "edition_config_focuses.budget_value",
              "edition_config_focuses.lookback_hours",
              "edition_config_focuses.weight",
              "focuses.name as focus_name",
            ])
            .where("edition_config_id", "in", configIds)
            .orderBy("edition_config_focuses.position", "asc")
            .execute()
        : [];

    const focusesByConfig = new Map<string, EditionConfigFocus[]>();
    for (const link of focusLinks) {
      const arr = focusesByConfig.get(link.edition_config_id) ?? [];
      arr.push({
        focusId: link.focus_id,
        focusName: link.focus_name,
        position: link.position,
        budgetType: link.budget_type as EditionBudgetType,
        budgetValue: link.budget_value,
        lookbackHours: link.lookback_hours,
        weight: link.weight,
      });
      focusesByConfig.set(link.edition_config_id, arr);
    }

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      schedule: row.schedule,
      lookbackHours: row.lookback_hours,
      excludePriorEditions: row.exclude_prior_editions === 1,
      enabled: row.enabled === 1,
      focuses: focusesByConfig.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  };

  getConfig = async (userId: string, id: string): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("edition_configs")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!row) {
      throw new EditionConfigNotFoundError(id);
    }

    const focusLinks = await db
      .selectFrom("edition_config_focuses")
      .innerJoin("focuses", "focuses.id", "edition_config_focuses.focus_id")
      .select([
        "edition_config_focuses.focus_id",
        "edition_config_focuses.position",
        "edition_config_focuses.budget_type",
        "edition_config_focuses.budget_value",
        "edition_config_focuses.lookback_hours",
        "edition_config_focuses.weight",
        "focuses.name as focus_name",
      ])
      .where("edition_config_id", "=", id)
      .orderBy("edition_config_focuses.position", "asc")
      .execute();

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      schedule: row.schedule,
      lookbackHours: row.lookback_hours,
      excludePriorEditions: row.exclude_prior_editions === 1,
      enabled: row.enabled === 1,
      focuses: focusLinks.map((link) => ({
        focusId: link.focus_id,
        focusName: link.focus_name,
        position: link.position,
        budgetType: link.budget_type as EditionBudgetType,
        budgetValue: link.budget_value,
        lookbackHours: link.lookback_hours,
        weight: link.weight,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  createConfig = async (params: CreateEditionConfigParams): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const id = crypto.randomUUID();

    await db
      .insertInto("edition_configs")
      .values({
        id,
        user_id: params.userId,
        name: params.name,
        schedule: params.schedule,
        lookback_hours: params.lookbackHours,
        exclude_prior_editions: params.excludePriorEditions ? 1 : 0,
        enabled: params.enabled === false ? 0 : 1,
      })
      .execute();

    if (params.focuses.length > 0) {
      await db
        .insertInto("edition_config_focuses")
        .values(
          params.focuses.map((f) => ({
            edition_config_id: id,
            focus_id: f.focusId,
            position: f.position,
            budget_type: f.budgetType,
            budget_value: f.budgetValue,
            lookback_hours: f.lookbackHours ?? null,
            weight: f.weight ?? 1,
          })),
        )
        .execute();
    }

    return this.getConfig(params.userId, id);
  };

  updateConfig = async (
    userId: string,
    id: string,
    params: UpdateEditionConfigParams,
  ): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    await this.getConfig(userId, id);

    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.name !== undefined) values.name = params.name;
    if (params.schedule !== undefined) values.schedule = params.schedule;
    if (params.lookbackHours !== undefined) values.lookback_hours = params.lookbackHours;
    if (params.excludePriorEditions !== undefined)
      values.exclude_prior_editions = params.excludePriorEditions ? 1 : 0;
    if (params.enabled !== undefined) values.enabled = params.enabled ? 1 : 0;

    await db
      .updateTable("edition_configs")
      .set(values)
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();

    if (params.focuses !== undefined) {
      await db
        .deleteFrom("edition_config_focuses")
        .where("edition_config_id", "=", id)
        .execute();

      if (params.focuses.length > 0) {
        await db
          .insertInto("edition_config_focuses")
          .values(
            params.focuses.map((f) => ({
              edition_config_id: id,
              focus_id: f.focusId,
              position: f.position,
              budget_type: f.budgetType,
              budget_value: f.budgetValue,
              lookback_hours: f.lookbackHours ?? null,
              weight: f.weight ?? 1,
            })),
          )
          .execute();
      }
    }

    return this.getConfig(userId, id);
  };

  deleteConfig = async (userId: string, id: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    await this.getConfig(userId, id);

    await db
      .deleteFrom("edition_configs")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
  };

  // --- Generated Editions ---

  listEditions = async (userId: string, configId: string): Promise<EditionSummary[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    await this.getConfig(userId, configId);

    const rows = await db
      .selectFrom("editions")
      .innerJoin("edition_configs", "edition_configs.id", "editions.edition_config_id")
      .select([
        "editions.id",
        "editions.edition_config_id",
        "editions.title",
        "editions.total_reading_minutes",
        "editions.article_count",
        "editions.current_position",
        "editions.read_at",
        "editions.published_at",
        "editions.created_at",
        "edition_configs.name as config_name",
      ])
      .where("editions.edition_config_id", "=", configId)
      .where("edition_configs.user_id", "=", userId)
      .orderBy("editions.published_at", "desc")
      .execute();

    return rows.map((row) => ({
      id: row.id,
      editionConfigId: row.edition_config_id,
      title: row.title,
      totalReadingMinutes: row.total_reading_minutes,
      articleCount: row.article_count,
      currentPosition: row.current_position,
      readAt: row.read_at,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      configName: row.config_name,
    }));
  };

  getEdition = async (userId: string, editionId: string): Promise<EditionDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom("editions")
      .innerJoin("edition_configs", "edition_configs.id", "editions.edition_config_id")
      .select([
        "editions.id",
        "editions.edition_config_id",
        "editions.title",
        "editions.total_reading_minutes",
        "editions.article_count",
        "editions.current_position",
        "editions.read_at",
        "editions.published_at",
        "editions.created_at",
      ])
      .where("editions.id", "=", editionId)
      .where("edition_configs.user_id", "=", userId)
      .executeTakeFirst();

    if (!row) {
      throw new EditionNotFoundError(editionId);
    }

    const articles = await db
      .selectFrom("edition_articles")
      .innerJoin("articles", "articles.id", "edition_articles.article_id")
      .innerJoin("sources", "sources.id", "articles.source_id")
      .innerJoin("focuses", "focuses.id", "edition_articles.focus_id")
      .select([
        "articles.id",
        "articles.source_id",
        "articles.title",
        "articles.author",
        "articles.summary",
        "articles.url",
        "articles.image_url",
        "articles.published_at",
        "articles.reading_time_seconds",
        "articles.read_at",
        "sources.name as source_name",
        "edition_articles.focus_id",
        "focuses.name as focus_name",
        "edition_articles.position",
      ])
      .where("edition_articles.edition_id", "=", editionId)
      .orderBy("edition_articles.position", "asc")
      .execute();

    return {
      id: row.id,
      editionConfigId: row.edition_config_id,
      title: row.title,
      totalReadingMinutes: row.total_reading_minutes,
      articleCount: row.article_count,
      currentPosition: row.current_position,
      readAt: row.read_at,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      articles: articles.map((a) => ({
        id: a.id,
        sourceId: a.source_id,
        title: a.title,
        author: a.author,
        summary: a.summary,
        url: a.url,
        imageUrl: a.image_url,
        publishedAt: a.published_at,
        readingTimeSeconds: a.reading_time_seconds,
        readAt: a.read_at,
        sourceName: a.source_name,
        focusId: a.focus_id,
        focusName: a.focus_name,
        position: a.position,
      })),
    };
  };

  deleteEdition = async (userId: string, editionId: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.getEdition(userId, editionId);

    await db.deleteFrom("editions").where("id", "=", editionId).execute();
  };

  setEditionReadStatus = async (
    userId: string,
    editionId: string,
    read: boolean,
  ): Promise<Edition> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const edition = await this.getEdition(userId, editionId);
    const readAt = read ? new Date().toISOString() : null;

    await db
      .updateTable("editions")
      .set({ read_at: readAt })
      .where("id", "=", editionId)
      .execute();

    return { ...edition, readAt };
  };

  updateEditionProgress = async (
    userId: string,
    editionId: string,
    currentPosition: number,
  ): Promise<Edition> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const edition = await this.getEdition(userId, editionId);

    await db
      .updateTable("editions")
      .set({ current_position: currentPosition })
      .where("id", "=", editionId)
      .execute();

    return { ...edition, currentPosition };
  };

  // --- Generation ---

  generate = async (userId: string, configId: string): Promise<EditionDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const config = await this.getConfig(userId, configId);

    if (config.focuses.length === 0) {
      throw new EditionError("Edition config has no focuses");
    }

    // Collect IDs of articles already in prior editions of this config (if configured)
    const excludedArticleIds = new Set<string>();

    if (config.excludePriorEditions) {
      const priorArticles = await db
        .selectFrom("edition_articles")
        .innerJoin("editions", "editions.id", "edition_articles.edition_id")
        .select("edition_articles.article_id")
        .where("editions.edition_config_id", "=", configId)
        .execute();

      for (const row of priorArticles) {
        excludedArticleIds.add(row.article_id);
      }
    }

    // Track articles claimed across focuses
    const claimedArticleIds = new Set<string>();
    const editionArticles: { articleId: string; focusId: string; position: number }[] = [];
    let globalPosition = 0;
    let totalReadingSeconds = 0;

    // Process focuses in position order
    const sortedFocuses = [...config.focuses].sort((a, b) => a.position - b.position);

    // Load focus details to get min_confidence thresholds and source weights
    const focusesService = this.#services.get(FocusesService);
    const focusDetails = new Map<
      string,
      { minConfidence: number; sourceWeights: Map<string, number> }
    >();
    for (const fc of sortedFocuses) {
      const focus = await focusesService.get(userId, fc.focusId);
      const sourceWeights = new Map<string, number>();
      for (const src of focus.sources) {
        sourceWeights.set(src.sourceId, src.weight);
      }
      focusDetails.set(fc.focusId, { minConfidence: focus.minConfidence, sourceWeights });
    }

    // Load global vote context once for the user
    const votesService = this.#services.get(VotesService);
    const globalVoteContext = await votesService.loadVoteContext(userId, null);

    // Load edition-config-scoped vote context
    const editionVoteContext = await votesService.loadEditionVoteContext(userId, configId);

    for (const focusConfig of sortedFocuses) {
      const focusInfo = focusDetails.get(focusConfig.focusId)!;

      // Per-focus cutoff: use focus-level lookback if set, otherwise config default
      const lookbackHours = focusConfig.lookbackHours ?? config.lookbackHours;
      const cutoff = new Date(
        Date.now() - lookbackHours * 60 * 60 * 1000,
      ).toISOString();

      // Get all candidate articles for this focus within the time window
      let candidateQuery = db
        .selectFrom("article_focuses")
        .innerJoin("articles", "articles.id", "article_focuses.article_id")
        .innerJoin("sources", "sources.id", "articles.source_id")
        .leftJoin(
          "article_embeddings",
          "article_embeddings.article_id",
          "articles.id",
        )
        .select([
          "articles.id",
          "articles.source_id",
          "articles.published_at",
          "articles.reading_time_seconds",
          "article_focuses.confidence",
          "article_embeddings.embedding",
        ])
        .where("article_focuses.focus_id", "=", focusConfig.focusId)
        .where("sources.user_id", "=", userId)
        .where("articles.read_at", "is", null) // unread only
        .where("articles.published_at", ">=", cutoff);

      if (focusInfo.minConfidence > 0) {
        candidateQuery = candidateQuery.where(
          "article_focuses.confidence",
          ">=",
          focusInfo.minConfidence,
        );
      }

      const candidates = await candidateQuery.execute();

      // Load focus-scoped vote context and merge with global + edition
      const focusVoteContext = await votesService.loadVoteContext(
        userId,
        focusConfig.focusId,
      );
      const voteContext = mergeVoteContexts(
        mergeVoteContexts(globalVoteContext, focusVoteContext),
        editionVoteContext,
      );

      // Score and rank candidates (apply source weights and focus weight to scores)
      const { sourceWeights } = focusInfo;
      const focusWeight = focusConfig.weight;
      const mapped = candidates.map((c) => {
        const embeddingBuf = c.embedding as Buffer | null;
        return {
          ...c,
          articleId: c.id,
          publishedAt: c.published_at,
          embedding: embeddingBuf
            ? new Float32Array(
                embeddingBuf.buffer,
                embeddingBuf.byteOffset,
                embeddingBuf.byteLength / 4,
              )
            : null,
        };
      });
      const scored = mapped.map((c) => ({
        item: c,
        score: computeScore(c, voteContext) * (sourceWeights.get(c.source_id) ?? 1) * focusWeight,
      }));
      scored.sort((a, b) => b.score - a.score);
      const scoredCandidates = scored.map((s) => s.item);

      // Filter out already claimed or excluded articles
      const eligible = scoredCandidates.filter(
        (c) => !claimedArticleIds.has(c.id) && !excludedArticleIds.has(c.id),
      );

      // Group by source for weighted round-robin
      const bySource = new Map<string, typeof eligible>();
      for (const article of eligible) {
        const arr = bySource.get(article.source_id) ?? [];
        arr.push(article);
        bySource.set(article.source_id, arr);
      }

      // Weighted round-robin using fractional accumulator
      const sourceIds = [...bySource.keys()];
      const sourceIndex = new Map<string, number>();
      const accumulator = new Map<string, number>();
      for (const sid of sourceIds) {
        sourceIndex.set(sid, 0);
        accumulator.set(sid, 0);
      }

      let focusBudgetUsed = 0;

      // Each round: add weight to accumulators, then pick from sources with accumulator >= 1
      let progress = true;
      while (progress) {
        progress = false;

        // Add weight to each source's accumulator
        for (const sourceId of sourceIds) {
          const weight = sourceWeights.get(sourceId) ?? 1;
          accumulator.set(sourceId, (accumulator.get(sourceId) ?? 0) + weight);
        }

        // Sort sources by accumulator descending for fairness
        const sortedSources = [...sourceIds].sort(
          (a, b) => (accumulator.get(b) ?? 0) - (accumulator.get(a) ?? 0),
        );

        for (const sourceId of sortedSources) {
          // Pick articles while accumulator >= 1 and articles remain
          while ((accumulator.get(sourceId) ?? 0) >= 1) {
            const idx = sourceIndex.get(sourceId)!;
            const articles = bySource.get(sourceId)!;
            const article = articles[idx];

            if (!article) break;

            sourceIndex.set(sourceId, idx + 1);
            accumulator.set(sourceId, (accumulator.get(sourceId) ?? 0) - 1);

            claimedArticleIds.add(article.id);
            editionArticles.push({
              articleId: article.id,
              focusId: focusConfig.focusId,
              position: globalPosition++,
            });

            if (focusConfig.budgetType === "count") {
              focusBudgetUsed++;
            } else {
              totalReadingSeconds += article.reading_time_seconds ?? 0;
              focusBudgetUsed += Math.ceil((article.reading_time_seconds ?? 0) / 60);
            }

            progress = true;

            if (focusBudgetUsed >= focusConfig.budgetValue) break;
          }

          if (focusBudgetUsed >= focusConfig.budgetValue) break;
        }

        if (focusBudgetUsed >= focusConfig.budgetValue) break;
      }
    }

    // Create the edition snapshot
    const editionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = `${config.name} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    await db
      .insertInto("editions")
      .values({
        id: editionId,
        edition_config_id: configId,
        title,
        total_reading_minutes: Math.ceil(totalReadingSeconds / 60) || null,
        article_count: editionArticles.length,
        current_position: 0,
        published_at: now,
      })
      .execute();

    if (editionArticles.length > 0) {
      await db
        .insertInto("edition_articles")
        .values(
          editionArticles.map((ea) => ({
            edition_id: editionId,
            article_id: ea.articleId,
            focus_id: ea.focusId,
            position: ea.position,
          })),
        )
        .execute();
    }

    return this.getEdition(userId, editionId);
  };
}

export type {
  EditionConfig,
  EditionConfigFocus,
  CreateEditionConfigParams,
  UpdateEditionConfigParams,
  Edition,
  EditionDetail,
  EditionSummary,
  EditionArticle,
};
export { EditionsService, EditionError, EditionConfigNotFoundError, EditionNotFoundError };
