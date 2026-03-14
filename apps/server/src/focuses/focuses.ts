import crypto from 'node:crypto';

import { DatabaseService } from '../database/database.ts';
import { JobService } from '../jobs/jobs.ts';
import type { FocusSourceMode } from '../database/database.types.ts';
import type { ReconcileFocusPayload } from '../jobs/jobs.handlers.ts';
import type { Services } from '../services/services.ts';

import { listFocusArticles } from './focuses.articles.ts';
import type { FocusArticle, FocusArticlesPage, ListArticlesOptions } from './focuses.articles.ts';

// --- Errors ---

class FocusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FocusError';
  }
}

class FocusNotFoundError extends FocusError {
  constructor(id: string) {
    super(`Focus not found: ${id}`);
    this.name = 'FocusNotFoundError';
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
  minConfidence: number | null;
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
    this.#services.get(JobService).enqueue<ReconcileFocusPayload>(
      'reconcile_focus',
      { focusId, forceReclassify },
      {
        userId,
        affects: { focusIds: [focusId] },
      },
    );
  };

  list = async (userId: string): Promise<Focus[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const rows = await db
      .selectFrom('focuses')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    const focusIds = rows.map((r) => r.id);
    const sourceLinks =
      focusIds.length > 0
        ? await db.selectFrom('focus_sources').selectAll().where('focus_id', 'in', focusIds).execute()
        : [];

    const sourceLinksByFocus = new Map<string, FocusSource[]>();
    for (const link of sourceLinks) {
      const arr = sourceLinksByFocus.get(link.focus_id) ?? [];
      arr.push({ sourceId: link.source_id, mode: link.mode as FocusSourceMode, weight: link.weight, minConfidence: link.min_confidence });
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
      .selectFrom('focuses')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!row) {
      throw new FocusNotFoundError(id);
    }

    const sourceLinks = await db.selectFrom('focus_sources').selectAll().where('focus_id', '=', id).execute();

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
        minConfidence: link.min_confidence,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  create = async (params: CreateFocusParams): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const id = crypto.randomUUID();

    await db
      .insertInto('focuses')
      .values({
        id,
        user_id: params.userId,
        name: params.name,
        description: params.description ?? null,
        icon: params.icon ?? null,
        ...(params.minConfidence !== undefined ? { min_confidence: params.minConfidence } : {}),
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
        .insertInto('focus_sources')
        .values(
          params.sources.map((s) => ({
            focus_id: id,
            source_id: s.sourceId,
            mode: s.mode,
            weight: s.weight,
            min_confidence: s.minConfidence ?? null,
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

    if (params.name !== undefined) {
      values.name = params.name;
    }
    if (params.description !== undefined) {
      values.description = params.description;
    }
    if (params.icon !== undefined) {
      values.icon = params.icon;
    }
    if (params.minConfidence !== undefined) {
      values.min_confidence = params.minConfidence;
    }
    if (params.minConsumptionTimeSeconds !== undefined) {
      values.min_consumption_time_seconds = params.minConsumptionTimeSeconds;
    }
    if (params.maxConsumptionTimeSeconds !== undefined) {
      values.max_consumption_time_seconds = params.maxConsumptionTimeSeconds;
    }

    await db.updateTable('focuses').set(values).where('id', '=', id).where('user_id', '=', userId).execute();

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

    await db.deleteFrom('focuses').where('id', '=', id).where('user_id', '=', userId).execute();
  };

  setSources = async (userId: string, focusId: string, sources: FocusSource[]): Promise<Focus> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Verify ownership
    await this.get(userId, focusId);

    // Determine which sources were removed so we only delete their classifications
    const previousLinks = await db
      .selectFrom('focus_sources')
      .select('source_id')
      .where('focus_id', '=', focusId)
      .execute();

    const previousSourceIds = new Set(previousLinks.map((l) => l.source_id));
    const newSourceIds = new Set(sources.map((s) => s.sourceId));
    const removedSourceIds = [...previousSourceIds].filter((id) => !newSourceIds.has(id));
    const hasChanges =
      removedSourceIds.length > 0 ||
      [...newSourceIds].some((id) => !previousSourceIds.has(id)) ||
      sources.some((s) => {
        const prev = previousLinks.find((l) => l.source_id === s.sourceId);
        return prev === undefined;
      });

    // Replace all source associations
    await db.deleteFrom('focus_sources').where('focus_id', '=', focusId).execute();

    // Only delete classifications for articles from removed sources
    if (removedSourceIds.length > 0) {
      const removedArticleIds = await db
        .selectFrom('articles')
        .select('id')
        .where('source_id', 'in', removedSourceIds)
        .execute();

      if (removedArticleIds.length > 0) {
        await db
          .deleteFrom('article_focuses')
          .where('focus_id', '=', focusId)
          .where(
            'article_id',
            'in',
            removedArticleIds.map((a) => a.id),
          )
          .execute();
      }
    }

    if (sources.length > 0) {
      await db
        .insertInto('focus_sources')
        .values(
          sources.map((s) => ({
            focus_id: focusId,
            source_id: s.sourceId,
            mode: s.mode,
            weight: s.weight,
            min_confidence: s.minConfidence ?? null,
          })),
        )
        .execute();

      // Reconcile will pick up articles from new sources that lack classifications
      if (hasChanges) {
        this.#enqueueReconcileFocus(focusId, userId);
      }
    }

    await db.updateTable('focuses').set({ updated_at: new Date().toISOString() }).where('id', '=', focusId).execute();

    return this.get(userId, focusId);
  };

  listArticles = async (
    userId: string,
    focusId: string,
    opts: ListArticlesOptions = {},
  ): Promise<FocusArticlesPage> => {
    const focus = await this.get(userId, focusId);
    return listFocusArticles({ services: this.#services, focus, userId, focusId, opts });
  };
}

export type {
  Focus,
  FocusSource,
  FocusArticle,
  FocusArticlesPage,
  CreateFocusParams,
  UpdateFocusParams,
  ListArticlesOptions,
};
export { FocusesService, FocusError, FocusNotFoundError };
