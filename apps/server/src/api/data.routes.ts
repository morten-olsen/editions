import crypto from 'node:crypto';

import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { DatabaseService } from '../database/database.ts';
import { SourcesService } from '../sources/sources.ts';
import { FocusesService } from '../focuses/focuses.ts';
import { EditionsService } from '../editions/editions.ts';
import { JobService } from '../jobs/jobs.ts';
import type { ReconcileFocusPayload } from '../jobs/jobs.handlers.ts';
import type { Services } from '../services/services.ts';

import type { DataExport } from './data.routes.schemas.ts';
import { dataExportSchema, dataImportResultSchema } from './data.routes.schemas.ts';

// --- Helpers ---

const errorResponseSchema = z.object({ error: z.string() });

// --- Export ---

const buildExport = async (services: Services, userId: string): Promise<DataExport> => {
  const db = await services.get(DatabaseService).getInstance();

  // Sources (exclude built-in bookmarks source)
  const sourcesService = services.get(SourcesService);
  const allSources = await sourcesService.list(userId);
  const exportSources = allSources
    .filter((s) => s.type !== 'bookmarks')
    .map((s) => ({
      type: s.type,
      name: s.name,
      url: s.url,
      config: s.config,
      direction: s.direction,
    }));

  const sourceIdToUrl = new Map(allSources.map((s) => [s.id, s.url]));
  const sourceIds = allSources.filter((s) => s.type !== 'bookmarks').map((s) => s.id);

  // Articles with embeddings and focus classifications
  const articleRows =
    sourceIds.length > 0
      ? await db.selectFrom('articles').selectAll().where('source_id', 'in', sourceIds).execute()
      : [];

  const articleIds = articleRows.map((a) => a.id);

  // Embeddings
  const embeddingRows =
    articleIds.length > 0
      ? await db.selectFrom('article_embeddings').selectAll().where('article_id', 'in', articleIds).execute()
      : [];
  const embeddingByArticle = new Map(embeddingRows.map((e) => [e.article_id, e]));

  // Focus classifications
  const focusesService = services.get(FocusesService);
  const allFocuses = await focusesService.list(userId);
  const focusIdToName = new Map(allFocuses.map((f) => [f.id, f.name]));

  const articleFocusRows =
    articleIds.length > 0
      ? await db.selectFrom('article_focuses').selectAll().where('article_id', 'in', articleIds).execute()
      : [];
  const articleFocusesByArticle = new Map<string, typeof articleFocusRows>();
  for (const row of articleFocusRows) {
    const arr = articleFocusesByArticle.get(row.article_id) ?? [];
    arr.push(row);
    articleFocusesByArticle.set(row.article_id, arr);
  }

  const exportArticles = articleRows.map((a) => {
    const embedding = embeddingByArticle.get(a.id);
    const focuses = (articleFocusesByArticle.get(a.id) ?? [])
      .filter((af) => focusIdToName.has(af.focus_id))
      .map((af) => ({
        focusName: focusIdToName.get(af.focus_id)!,
        similarity: af.similarity,
        similarityModel: af.similarity_model,
        nli: af.nli,
        nliModel: af.nli_model,
      }));

    return {
      sourceUrl: sourceIdToUrl.get(a.source_id)!,
      externalId: a.external_id,
      url: a.url,
      title: a.title,
      author: a.author,
      summary: a.summary,
      content: a.content,
      consumptionTimeSeconds: a.consumption_time_seconds,
      imageUrl: a.image_url,
      mediaUrl: a.media_url,
      mediaType: a.media_type,
      publishedAt: a.published_at,
      extractedAt: a.extracted_at,
      analysedAt: a.analysed_at,
      readAt: a.read_at,
      progress: a.progress,
      embedding: embedding
        ? { data: Buffer.from(embedding.embedding).toString('base64'), model: embedding.model }
        : null,
      focuses,
    };
  });

  // Focuses with their source links
  const exportFocuses = allFocuses.map((f) => ({
    name: f.name,
    description: f.description,
    icon: f.icon,
    minConfidence: f.minConfidence,
    minConsumptionTimeSeconds: f.minConsumptionTimeSeconds,
    maxConsumptionTimeSeconds: f.maxConsumptionTimeSeconds,
    sources: f.sources
      .filter((fs) => sourceIdToUrl.has(fs.sourceId))
      .map((fs) => ({
        url: sourceIdToUrl.get(fs.sourceId)!,
        weight: fs.weight,
        minConfidence: fs.minConfidence,
      })),
  }));

  // Edition configs with focus links and source budgets
  const editionsService = services.get(EditionsService);
  const allConfigs = await editionsService.listConfigs(userId);

  const configIds = allConfigs.map((c) => c.id);
  const sourceBudgetRows =
    configIds.length > 0
      ? await db
          .selectFrom('edition_config_source_budgets')
          .selectAll()
          .where('edition_config_id', 'in', configIds)
          .execute()
      : [];

  const budgetsByConfig = new Map<string, typeof sourceBudgetRows>();
  for (const row of sourceBudgetRows) {
    const arr = budgetsByConfig.get(row.edition_config_id) ?? [];
    arr.push(row);
    budgetsByConfig.set(row.edition_config_id, arr);
  }

  const exportEditionConfigs = allConfigs.map((c) => ({
    name: c.name,
    icon: c.icon,
    schedule: c.schedule,
    lookbackHours: c.lookbackHours,
    excludePriorEditions: c.excludePriorEditions,
    enabled: c.enabled,
    focuses: c.focuses
      .filter((f) => focusIdToName.has(f.focusId))
      .map((f) => ({
        focusName: focusIdToName.get(f.focusId)!,
        position: f.position,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    sourceBudgets: (budgetsByConfig.get(c.id) ?? [])
      .filter((sb) => sourceIdToUrl.has(sb.source_id))
      .map((sb) => ({
        sourceUrl: sourceIdToUrl.get(sb.source_id)!,
        maxArticles: sb.max_articles,
        maxReadingMinutes: sb.max_reading_minutes,
      })),
  }));

  // Editions with their articles
  const configIdToName = new Map(allConfigs.map((c) => [c.id, c.name]));
  const articleIdToKey = new Map(
    articleRows.map((a) => [a.id, { sourceUrl: sourceIdToUrl.get(a.source_id)!, externalId: a.external_id }]),
  );

  const editionRows =
    configIds.length > 0
      ? await db
          .selectFrom('editions')
          .selectAll()
          .where('edition_config_id', 'in', configIds)
          .orderBy('published_at', 'desc')
          .execute()
      : [];

  const editionIds = editionRows.map((e) => e.id);
  const editionArticleRows =
    editionIds.length > 0
      ? await db.selectFrom('edition_articles').selectAll().where('edition_id', 'in', editionIds).execute()
      : [];

  const editionArticlesByEdition = new Map<string, typeof editionArticleRows>();
  for (const row of editionArticleRows) {
    const arr = editionArticlesByEdition.get(row.edition_id) ?? [];
    arr.push(row);
    editionArticlesByEdition.set(row.edition_id, arr);
  }

  const exportEditions = editionRows.map((e) => ({
    editionConfigName: configIdToName.get(e.edition_config_id)!,
    title: e.title,
    totalReadingMinutes: e.total_reading_minutes,
    articleCount: e.article_count,
    currentPosition: e.current_position,
    readAt: e.read_at,
    publishedAt: e.published_at,
    articles: (editionArticlesByEdition.get(e.id) ?? [])
      .filter((ea) => articleIdToKey.has(ea.article_id) && focusIdToName.has(ea.focus_id))
      .map((ea) => ({
        sourceUrl: articleIdToKey.get(ea.article_id)!.sourceUrl,
        externalId: articleIdToKey.get(ea.article_id)!.externalId,
        focusName: focusIdToName.get(ea.focus_id)!,
        position: ea.position,
      })),
  }));

  // Scoring weights
  const userRow = await db.selectFrom('users').select('scoring_weights').where('id', '=', userId).executeTakeFirst();
  const scoringWeights = userRow?.scoring_weights ? (JSON.parse(userRow.scoring_weights) as Record<string, unknown>) : null;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sources: exportSources,
    articles: exportArticles,
    focuses: exportFocuses,
    editionConfigs: exportEditionConfigs,
    editions: exportEditions,
    scoringWeights,
  };
};

// --- Import ---

type ImportResult = {
  sources: number;
  articles: number;
  focuses: number;
  editionConfigs: number;
  editions: number;
  scoringWeightsImported: boolean;
};

const clearUserData = async (services: Services, userId: string): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();

  // Delete in dependency order — FK cascades handle junction tables.
  // edition_configs → editions, edition_config_focuses, edition_config_source_budgets
  await db.deleteFrom('edition_configs').where('user_id', '=', userId).execute();
  // bookmarks (references articles, no cascade on this FK)
  await db.deleteFrom('bookmarks').where('user_id', '=', userId).execute();
  // article_votes
  await db.deleteFrom('article_votes').where('user_id', '=', userId).execute();
  // focuses → focus_sources, article_focuses
  await db.deleteFrom('focuses').where('user_id', '=', userId).execute();
  // sources (non-bookmarks) → articles → article_embeddings
  const nonBookmarkSources = await db
    .selectFrom('sources')
    .select('id')
    .where('user_id', '=', userId)
    .where('type', '!=', 'bookmarks')
    .execute();
  if (nonBookmarkSources.length > 0) {
    await db
      .deleteFrom('sources')
      .where(
        'id',
        'in',
        nonBookmarkSources.map((s) => s.id),
      )
      .execute();
  }
  // Reset scoring weights
  await db.updateTable('users').set({ scoring_weights: null }).where('id', '=', userId).execute();
};

const importData = async (services: Services, userId: string, data: DataExport): Promise<ImportResult> => {
  const db = await services.get(DatabaseService).getInstance();
  const sourcesService = services.get(SourcesService);

  // Clear all existing user data first for a clean slate
  await clearUserData(services, userId);

  const result: ImportResult = {
    sources: 0,
    articles: 0,
    focuses: 0,
    editionConfigs: 0,
    editions: 0,
    scoringWeightsImported: false,
  };

  // 1. Import sources
  const urlToSourceId = new Map<string, string>();

  // The bookmarks source may still exist — index it
  const remainingSources = await sourcesService.list(userId);
  for (const s of remainingSources) {
    urlToSourceId.set(s.url.toLowerCase(), s.id);
  }

  for (const src of data.sources) {
    const created = await sourcesService.create({
      userId,
      name: src.name,
      url: src.url,
      type: src.type,
      direction: src.direction,
      config: src.config,
    });
    urlToSourceId.set(src.url.toLowerCase(), created.id);
    result.sources++;
  }

  // 2. Import articles (with embeddings and focus classification data)
  // Build a lookup: (sourceUrl, externalId) → new article ID
  type ArticleKey = `${string}|${string}`;
  const articleKeyToId = new Map<ArticleKey, string>();
  const makeKey = (sourceUrl: string, externalId: string): ArticleKey =>
    `${sourceUrl.toLowerCase()}|${externalId}`;

  for (const article of data.articles) {
    const sourceId = urlToSourceId.get(article.sourceUrl.toLowerCase());
    if (!sourceId) continue;

    const id = crypto.randomUUID();
    await db
      .insertInto('articles')
      .values({
        id,
        source_id: sourceId,
        external_id: article.externalId,
        url: article.url,
        title: article.title,
        author: article.author,
        summary: article.summary,
        content: article.content,
        consumption_time_seconds: article.consumptionTimeSeconds,
        image_url: article.imageUrl,
        media_url: article.mediaUrl,
        media_type: article.mediaType,
        published_at: article.publishedAt,
        extracted_at: article.extractedAt,
        analysed_at: article.analysedAt,
        read_at: article.readAt,
        progress: article.progress,
      })
      .execute();

    articleKeyToId.set(makeKey(article.sourceUrl, article.externalId), id);

    // Embedding
    if (article.embedding) {
      await db
        .insertInto('article_embeddings')
        .values({
          article_id: id,
          embedding: Buffer.from(article.embedding.data, 'base64'),
          model: article.embedding.model,
        })
        .execute();
    }

    result.articles++;
  }

  // 3. Import focuses
  const focusNameToId = new Map<string, string>();

  for (const focus of data.focuses) {
    const focusSources = focus.sources
      .map((fs) => {
        const sourceId = urlToSourceId.get(fs.url.toLowerCase());
        if (!sourceId) return null;
        return { sourceId, weight: fs.weight, minConfidence: fs.minConfidence };
      })
      .filter((fs): fs is NonNullable<typeof fs> => fs !== null);

    const id = crypto.randomUUID();
    await db
      .insertInto('focuses')
      .values({
        id,
        user_id: userId,
        name: focus.name,
        description: focus.description,
        icon: focus.icon,
        min_confidence: focus.minConfidence,
        min_consumption_time_seconds: focus.minConsumptionTimeSeconds,
        max_consumption_time_seconds: focus.maxConsumptionTimeSeconds,
      })
      .execute();

    if (focusSources.length > 0) {
      await db
        .insertInto('focus_sources')
        .values(
          focusSources.map((fs) => ({
            focus_id: id,
            source_id: fs.sourceId,
            weight: fs.weight,
            min_confidence: fs.minConfidence,
          })),
        )
        .execute();
    }

    focusNameToId.set(focus.name.toLowerCase(), id);
    result.focuses++;
  }

  // 3b. Import article focus classifications (now that focuses exist)
  for (const article of data.articles) {
    const articleId = articleKeyToId.get(makeKey(article.sourceUrl, article.externalId));
    if (!articleId) continue;

    const classificationRows = article.focuses
      .map((af) => {
        const focusId = focusNameToId.get(af.focusName.toLowerCase());
        if (!focusId) return null;
        return {
          article_id: articleId,
          focus_id: focusId,
          similarity: af.similarity,
          similarity_model: af.similarityModel,
          nli: af.nli,
          nli_model: af.nliModel,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (classificationRows.length > 0) {
      await db.insertInto('article_focuses').values(classificationRows).execute();
    }
  }

  // 4. Import edition configs
  const editionConfigNameToId = new Map<string, string>();

  for (const config of data.editionConfigs) {
    const configFocuses = config.focuses
      .map((f) => {
        const focusId = focusNameToId.get(f.focusName.toLowerCase());
        if (!focusId) return null;
        return {
          focusId,
          position: f.position,
          budgetType: f.budgetType as 'time' | 'count',
          budgetValue: f.budgetValue,
          lookbackHours: f.lookbackHours,
          excludePriorEditions: f.excludePriorEditions,
          weight: f.weight,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const id = crypto.randomUUID();
    await db
      .insertInto('edition_configs')
      .values({
        id,
        user_id: userId,
        name: config.name,
        icon: config.icon,
        schedule: config.schedule,
        lookback_hours: config.lookbackHours,
        exclude_prior_editions: config.excludePriorEditions ? 1 : 0,
        enabled: config.enabled ? 1 : 0,
      })
      .execute();

    if (configFocuses.length > 0) {
      await db
        .insertInto('edition_config_focuses')
        .values(
          configFocuses.map((f) => ({
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
            weight: f.weight,
          })),
        )
        .execute();
    }

    // Source budgets
    const configSourceBudgets = config.sourceBudgets
      .map((sb) => {
        const sourceId = urlToSourceId.get(sb.sourceUrl.toLowerCase());
        if (!sourceId) return null;
        return {
          edition_config_id: id,
          source_id: sourceId,
          max_articles: sb.maxArticles,
          max_reading_minutes: sb.maxReadingMinutes,
        };
      })
      .filter((sb): sb is NonNullable<typeof sb> => sb !== null);

    if (configSourceBudgets.length > 0) {
      await db.insertInto('edition_config_source_budgets').values(configSourceBudgets).execute();
    }

    editionConfigNameToId.set(config.name.toLowerCase(), id);
    result.editionConfigs++;
  }

  // 5. Import editions
  for (const edition of data.editions) {
    const configId = editionConfigNameToId.get(edition.editionConfigName.toLowerCase());
    if (!configId) continue;

    const id = crypto.randomUUID();
    await db
      .insertInto('editions')
      .values({
        id,
        edition_config_id: configId,
        title: edition.title,
        total_reading_minutes: edition.totalReadingMinutes,
        article_count: edition.articleCount,
        current_position: edition.currentPosition,
        read_at: edition.readAt,
        published_at: edition.publishedAt,
      })
      .execute();

    const editionArticles = edition.articles
      .map((ea) => {
        const articleId = articleKeyToId.get(makeKey(ea.sourceUrl, ea.externalId));
        const focusId = focusNameToId.get(ea.focusName.toLowerCase());
        if (!articleId || !focusId) return null;
        return {
          edition_id: id,
          article_id: articleId,
          focus_id: focusId,
          position: ea.position,
        };
      })
      .filter((ea): ea is NonNullable<typeof ea> => ea !== null);

    if (editionArticles.length > 0) {
      await db.insertInto('edition_articles').values(editionArticles).execute();
    }

    result.editions++;
  }

  // 6. Import scoring weights
  if (data.scoringWeights != null) {
    await db
      .updateTable('users')
      .set({ scoring_weights: JSON.stringify(data.scoringWeights) })
      .where('id', '=', userId)
      .execute();
    result.scoringWeightsImported = true;
  }

  // 7. Enqueue reconcile jobs for all imported focuses to handle embedding model differences
  const jobService = services.get(JobService);
  for (const [, focusId] of focusNameToId) {
    jobService.enqueue<ReconcileFocusPayload>(
      'reconcile_focus',
      { focusId, forceReclassify: false },
      { userId, affects: { focusIds: [focusId] } },
    );
  }

  return result;
};

// --- Routes ---

const createDataRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // Export all user data
    fastify.route({
      method: 'GET',
      url: '/data/export',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: dataExportSchema },
      },
      handler: async (req, _reply) => {
        return buildExport(services, req.user.sub);
      },
    });

    // Import user data (replaces all existing data)
    fastify.route({
      method: 'POST',
      url: '/data/import',
      bodyLimit: 50 * 1024 * 1024, // 50 MB — exports with embeddings can be large
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: dataExportSchema,
        response: { 200: dataImportResultSchema, 400: errorResponseSchema },
      },
      handler: async (req, reply) => {
        if (req.body.version !== 1) {
          return reply.code(400).send({ error: `Unsupported export version: ${req.body.version}` });
        }
        return importData(services, req.user.sub, req.body);
      },
    });
  };

export { createDataRoutes };
