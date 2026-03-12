import crypto from 'node:crypto';

import { DatabaseService } from '../database/database.ts';
import { FocusesService } from '../focuses/focuses.ts';
import { VotesService } from '../votes/votes.ts';
import type { Services } from '../services/services.ts';

import { loadExcludedArticleIds, loadFocusDetails, collectArticlesForFocuses } from './editions.generate.ts';
import {
  mapFocusLinkRow,
  mapEditionArticleRow,
  mapEditionRow,
  mapConfigRow,
  queryFocusLinks,
  queryFocusLinksForConfigs,
  queryEditionArticles,
} from './editions.queries.ts';
import type {
  EditionConfig,
  EditionConfigFocus,
  CreateEditionConfigParams,
  UpdateEditionConfigParams,
  Edition,
  EditionDetail,
  EditionSummary,
  EditionArticle,
} from './editions.queries.ts';

// --- Errors ---

class EditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditionError';
  }
}

class EditionConfigNotFoundError extends EditionError {
  constructor(id: string) {
    super(`Edition config not found: ${id}`);
    this.name = 'EditionConfigNotFoundError';
  }
}

class EditionNotFoundError extends EditionError {
  constructor(id: string) {
    super(`Edition not found: ${id}`);
    this.name = 'EditionNotFoundError';
  }
}

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
      .selectFrom('edition_configs')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    const configIds = rows.map((r) => r.id);
    const focusLinks = configIds.length > 0 ? await queryFocusLinksForConfigs(db, configIds).execute() : [];

    const focusesByConfig = new Map<string, EditionConfigFocus[]>();
    for (const link of focusLinks) {
      const arr = focusesByConfig.get(link.edition_config_id) ?? [];
      arr.push(mapFocusLinkRow(link));
      focusesByConfig.set(link.edition_config_id, arr);
    }

    return rows.map((row) => mapConfigRow(row, focusesByConfig.get(row.id) ?? []));
  };

  getConfig = async (userId: string, id: string): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom('edition_configs')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!row) {
      throw new EditionConfigNotFoundError(id);
    }

    const focusLinks = await queryFocusLinks(db, id).execute();
    return mapConfigRow(row, focusLinks.map(mapFocusLinkRow));
  };

  createConfig = async (params: CreateEditionConfigParams): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const id = crypto.randomUUID();

    await db
      .insertInto('edition_configs')
      .values({
        id,
        user_id: params.userId,
        name: params.name,
        icon: params.icon ?? null,
        schedule: params.schedule,
        lookback_hours: params.lookbackHours,
        exclude_prior_editions: params.excludePriorEditions ? 1 : 0,
        enabled: params.enabled === false ? 0 : 1,
      })
      .execute();

    if (params.focuses.length > 0) {
      await db
        .insertInto('edition_config_focuses')
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

  updateConfig = async (userId: string, id: string, params: UpdateEditionConfigParams): Promise<EditionConfig> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    await this.getConfig(userId, id);

    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.name !== undefined) {
      values.name = params.name;
    }
    if (params.icon !== undefined) {
      values.icon = params.icon;
    }
    if (params.schedule !== undefined) {
      values.schedule = params.schedule;
    }
    if (params.lookbackHours !== undefined) {
      values.lookback_hours = params.lookbackHours;
    }
    if (params.excludePriorEditions !== undefined) {
      values.exclude_prior_editions = params.excludePriorEditions ? 1 : 0;
    }
    if (params.enabled !== undefined) {
      values.enabled = params.enabled ? 1 : 0;
    }

    await db.updateTable('edition_configs').set(values).where('id', '=', id).where('user_id', '=', userId).execute();

    if (params.focuses !== undefined) {
      await db.deleteFrom('edition_config_focuses').where('edition_config_id', '=', id).execute();

      if (params.focuses.length > 0) {
        await db
          .insertInto('edition_config_focuses')
          .values(
            params.focuses.map((f) => ({
              edition_config_id: id,
              focus_id: f.focusId,
              position: f.position,
              budget_type: f.budgetType,
              budget_value: f.budgetValue,
              lookback_hours: f.lookbackHours ?? null,
              exclude_prior_editions:
                f.excludePriorEditions === undefined || f.excludePriorEditions === null
                  ? null
                  : f.excludePriorEditions
                    ? 1
                    : 0,
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
    await db.deleteFrom('edition_configs').where('id', '=', id).where('user_id', '=', userId).execute();
  };

  // --- Generated Editions ---

  listEditions = async (userId: string, configId: string): Promise<EditionSummary[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await this.getConfig(userId, configId);

    const rows = await db
      .selectFrom('editions')
      .innerJoin('edition_configs', 'edition_configs.id', 'editions.edition_config_id')
      .select([
        'editions.id',
        'editions.edition_config_id',
        'editions.title',
        'editions.total_reading_minutes',
        'editions.article_count',
        'editions.current_position',
        'editions.read_at',
        'editions.published_at',
        'editions.created_at',
        'edition_configs.name as config_name',
      ])
      .where('editions.edition_config_id', '=', configId)
      .where('edition_configs.user_id', '=', userId)
      .orderBy('editions.published_at', 'desc')
      .execute();

    return rows.map((row) => ({ ...mapEditionRow(row), configName: row.config_name }));
  };

  getEdition = async (userId: string, editionId: string): Promise<EditionDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const row = await db
      .selectFrom('editions')
      .innerJoin('edition_configs', 'edition_configs.id', 'editions.edition_config_id')
      .select([
        'editions.id',
        'editions.edition_config_id',
        'editions.title',
        'editions.total_reading_minutes',
        'editions.article_count',
        'editions.current_position',
        'editions.read_at',
        'editions.published_at',
        'editions.created_at',
      ])
      .where('editions.id', '=', editionId)
      .where('edition_configs.user_id', '=', userId)
      .executeTakeFirst();

    if (!row) {
      throw new EditionNotFoundError(editionId);
    }

    const articles = await queryEditionArticles(db, editionId).execute();
    return { ...mapEditionRow(row), articles: articles.map(mapEditionArticleRow) };
  };

  deleteEdition = async (userId: string, editionId: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await this.getEdition(userId, editionId);
    await db.deleteFrom('editions').where('id', '=', editionId).execute();
  };

  setEditionReadStatus = async (userId: string, editionId: string, read: boolean): Promise<Edition> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const edition = await this.getEdition(userId, editionId);
    const readAt = read ? new Date().toISOString() : null;

    await db.updateTable('editions').set({ read_at: readAt }).where('id', '=', editionId).execute();

    const articleIds = edition.articles.map((a) => a.id);
    if (articleIds.length > 0) {
      await db.updateTable('articles').set({ read_at: readAt }).where('id', 'in', articleIds).execute();
    }

    return { ...edition, readAt };
  };

  updateEditionProgress = async (userId: string, editionId: string, currentPosition: number): Promise<Edition> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const edition = await this.getEdition(userId, editionId);

    await db.updateTable('editions').set({ current_position: currentPosition }).where('id', '=', editionId).execute();

    return { ...edition, currentPosition };
  };

  // --- Generation ---

  generate = async (userId: string, configId: string): Promise<EditionDetail> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const config = await this.getConfig(userId, configId);

    if (config.focuses.length === 0) {
      throw new EditionError('Edition config has no focuses');
    }

    const sortedFocuses = [...config.focuses].sort((a, b) => a.position - b.position);
    const needsExcludedSet = config.excludePriorEditions || config.focuses.some((f) => f.excludePriorEditions === true);

    const focusesService = this.#services.get(FocusesService);
    const votesService = this.#services.get(VotesService);

    const [excludedArticleIds, focusDetails, voteData] = await Promise.all([
      loadExcludedArticleIds(db, configId, needsExcludedSet),
      loadFocusDetails(focusesService, userId, sortedFocuses),
      Promise.all([
        votesService.loadVoteContext(userId, null),
        votesService.loadEditionVoteContext(userId, configId),
        votesService.loadUserScoringWeights(userId),
      ]),
    ]);

    const [globalVoteContext, editionVoteContext, userWeights] = voteData;

    const { articles: editionArticles, totalReadingSeconds } = await collectArticlesForFocuses({
      db,
      userId,
      configId,
      defaultLookbackHours: config.lookbackHours,
      defaultExcludePriorEditions: config.excludePriorEditions,
      sortedFocuses,
      focusDetails,
      excludedArticleIds,
      voteContext: { global: globalVoteContext, edition: editionVoteContext },
      votesService,
      editionWeights: userWeights.edition,
    });

    const editionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = `${config.name} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    await db
      .insertInto('editions')
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
        .insertInto('edition_articles')
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
