import crypto from 'node:crypto';

import { DatabaseService } from '../database/database.ts';
import type { SourceType } from '../database/database.types.ts';
import { JobService } from '../jobs/jobs.ts';
import type { Services } from '../services/services.ts';

import type { DataExport } from './data-portability.schemas.ts';

// --- Types ---

type ImportResult = {
  sources: number;
  articles: number;
  focuses: number;
  editionConfigs: number;
  editions: number;
  scoringWeightsImported: boolean;
};

type Db = Awaited<ReturnType<DatabaseService['getInstance']>>;

// Shared state threaded through the import steps: lookup maps translate the
// portable name/URL references back into the freshly generated row ids.
type ImportContext = {
  db: Db;
  userId: string;
  result: ImportResult;
  urlToSourceId: Map<string, string>;
  articleKeyToId: Map<string, string>;
  focusNameToId: Map<string, string>;
  editionConfigNameToId: Map<string, string>;
};

// --- Private helpers ---

// Lookup key: (sourceUrl, externalId) uniquely identifies an article
const makeArticleKey = (sourceUrl: string, externalId: string): string => `${sourceUrl.toLowerCase()}|${externalId}`;

// 1. Import sources
const importSources = async (ctx: ImportContext, sources: DataExport['sources']): Promise<void> => {
  // The bookmarks source may still exist — index it
  const remainingSources = await ctx.db
    .selectFrom('sources')
    .select(['id', 'url'])
    .where('user_id', '=', ctx.userId)
    .execute();
  for (const s of remainingSources) {
    ctx.urlToSourceId.set(s.url.toLowerCase(), s.id);
  }

  for (const src of sources) {
    const id = crypto.randomUUID();
    await ctx.db
      .insertInto('sources')
      .values({
        id,
        user_id: ctx.userId,
        type: src.type as SourceType,
        name: src.name,
        url: src.url,
        config: JSON.stringify(src.config),
        direction: src.direction,
      })
      .execute();
    ctx.urlToSourceId.set(src.url.toLowerCase(), id);
    ctx.result.sources++;
  }
};

// 2. Import articles (with embeddings)
const importArticles = async (ctx: ImportContext, articles: DataExport['articles']): Promise<void> => {
  for (const article of articles) {
    const sourceId = ctx.urlToSourceId.get(article.sourceUrl.toLowerCase());
    if (!sourceId) {
      continue;
    }

    const id = crypto.randomUUID();
    await ctx.db
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

    ctx.articleKeyToId.set(makeArticleKey(article.sourceUrl, article.externalId), id);

    // Embedding
    if (article.embedding) {
      await ctx.db
        .insertInto('article_embeddings')
        .values({
          article_id: id,
          embedding: Buffer.from(article.embedding.data, 'base64'),
          model: article.embedding.model,
        })
        .execute();
    }

    ctx.result.articles++;
  }
};

// 3. Import focuses (with source links resolved by URL)
const importFocuses = async (ctx: ImportContext, focuses: DataExport['focuses']): Promise<void> => {
  for (const focus of focuses) {
    const focusSources = focus.sources
      .map((fs) => {
        const sourceId = ctx.urlToSourceId.get(fs.url.toLowerCase());
        if (!sourceId) {
          return null;
        }
        return { sourceId, weight: fs.weight, minConfidence: fs.minConfidence };
      })
      .filter((fs): fs is NonNullable<typeof fs> => fs !== null);

    const id = crypto.randomUUID();
    await ctx.db
      .insertInto('focuses')
      .values({
        id,
        user_id: ctx.userId,
        name: focus.name,
        description: focus.description,
        icon: focus.icon,
        min_confidence: focus.minConfidence,
        min_consumption_time_seconds: focus.minConsumptionTimeSeconds,
        max_consumption_time_seconds: focus.maxConsumptionTimeSeconds,
      })
      .execute();

    if (focusSources.length > 0) {
      await ctx.db
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

    ctx.focusNameToId.set(focus.name.toLowerCase(), id);
    ctx.result.focuses++;
  }
};

// 3b. Import article focus classifications (once focuses exist)
const importArticleClassifications = async (ctx: ImportContext, articles: DataExport['articles']): Promise<void> => {
  for (const article of articles) {
    const articleId = ctx.articleKeyToId.get(makeArticleKey(article.sourceUrl, article.externalId));
    if (!articleId) {
      continue;
    }

    const classificationRows = article.focuses
      .map((af) => {
        const focusId = ctx.focusNameToId.get(af.focusName.toLowerCase());
        if (!focusId) {
          return null;
        }
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
      await ctx.db.insertInto('article_focuses').values(classificationRows).execute();
    }
  }
};

const insertConfigFocuses = async ({
  ctx,
  configId,
  focuses,
}: {
  ctx: ImportContext;
  configId: string;
  focuses: DataExport['editionConfigs'][number]['focuses'];
}): Promise<void> => {
  const rows = focuses
    .map((f) => {
      const focusId = ctx.focusNameToId.get(f.focusName.toLowerCase());
      if (!focusId) {
        return null;
      }
      return {
        edition_config_id: configId,
        focus_id: focusId,
        position: f.position,
        budget_type: f.budgetType as 'time' | 'count',
        budget_value: f.budgetValue,
        lookback_hours: f.lookbackHours ?? null,
        exclude_prior_editions:
          f.excludePriorEditions === undefined || f.excludePriorEditions === null
            ? null
            : f.excludePriorEditions
              ? 1
              : 0,
        weight: f.weight,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await ctx.db.insertInto('edition_config_focuses').values(rows).execute();
  }
};

const insertConfigSourceBudgets = async ({
  ctx,
  configId,
  sourceBudgets,
}: {
  ctx: ImportContext;
  configId: string;
  sourceBudgets: DataExport['editionConfigs'][number]['sourceBudgets'];
}): Promise<void> => {
  const rows = sourceBudgets
    .map((sb) => {
      const sourceId = ctx.urlToSourceId.get(sb.sourceUrl.toLowerCase());
      if (!sourceId) {
        return null;
      }
      return {
        edition_config_id: configId,
        source_id: sourceId,
        max_articles: sb.maxArticles,
        max_reading_minutes: sb.maxReadingMinutes,
      };
    })
    .filter((sb): sb is NonNullable<typeof sb> => sb !== null);

  if (rows.length > 0) {
    await ctx.db.insertInto('edition_config_source_budgets').values(rows).execute();
  }
};

// 4. Import edition configs (with focus links and source budgets)
const importEditionConfigs = async (ctx: ImportContext, configs: DataExport['editionConfigs']): Promise<void> => {
  for (const config of configs) {
    const id = crypto.randomUUID();
    await ctx.db
      .insertInto('edition_configs')
      .values({
        id,
        user_id: ctx.userId,
        name: config.name,
        icon: config.icon,
        schedule: config.schedule,
        lookback_hours: config.lookbackHours,
        exclude_prior_editions: config.excludePriorEditions ? 1 : 0,
        enabled: config.enabled ? 1 : 0,
      })
      .execute();

    await insertConfigFocuses({ ctx, configId: id, focuses: config.focuses });
    await insertConfigSourceBudgets({ ctx, configId: id, sourceBudgets: config.sourceBudgets });

    ctx.editionConfigNameToId.set(config.name.toLowerCase(), id);
    ctx.result.editionConfigs++;
  }
};

// 5. Import editions (with their articles)
const importEditions = async (ctx: ImportContext, editions: DataExport['editions']): Promise<void> => {
  for (const edition of editions) {
    const configId = ctx.editionConfigNameToId.get(edition.editionConfigName.toLowerCase());
    if (!configId) {
      continue;
    }

    const id = crypto.randomUUID();
    await ctx.db
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
        const articleId = ctx.articleKeyToId.get(makeArticleKey(ea.sourceUrl, ea.externalId));
        const focusId = ctx.focusNameToId.get(ea.focusName.toLowerCase());
        if (!articleId || !focusId) {
          return null;
        }
        return {
          edition_id: id,
          article_id: articleId,
          focus_id: focusId,
          position: ea.position,
        };
      })
      .filter((ea): ea is NonNullable<typeof ea> => ea !== null);

    if (editionArticles.length > 0) {
      await ctx.db.insertInto('edition_articles').values(editionArticles).execute();
    }

    ctx.result.editions++;
  }
};

// 6. Import scoring weights
const importScoringWeights = async (
  ctx: ImportContext,
  scoringWeights: DataExport['scoringWeights'],
): Promise<void> => {
  if (scoringWeights != null) {
    await ctx.db
      .updateTable('users')
      .set({ scoring_weights: JSON.stringify(scoringWeights) })
      .where('id', '=', ctx.userId)
      .execute();
    ctx.result.scoringWeightsImported = true;
  }
};

// 7. Re-analyse everything imported: the exporting instance may have used
// different embedding/NLI models — the pipeline re-scores on model mismatch
const enqueueReconcileJobs = (services: Services, ctx: ImportContext): void => {
  const jobService = services.get(JobService);
  for (const [, focusId] of ctx.focusNameToId) {
    jobService.enqueue(
      'reconcile_focus',
      { focusId, forceReclassify: false },
      { userId: ctx.userId, affects: { focusIds: [focusId] } },
    );
  }
};

// --- Public API ---

// Expects the caller to have cleared existing user data already.
const importUserData = async ({
  services,
  userId,
  data,
}: {
  services: Services;
  userId: string;
  data: DataExport;
}): Promise<ImportResult> => {
  const db = await services.get(DatabaseService).getInstance();
  const ctx: ImportContext = {
    db,
    userId,
    result: { sources: 0, articles: 0, focuses: 0, editionConfigs: 0, editions: 0, scoringWeightsImported: false },
    urlToSourceId: new Map(),
    articleKeyToId: new Map(),
    focusNameToId: new Map(),
    editionConfigNameToId: new Map(),
  };

  await importSources(ctx, data.sources);
  await importArticles(ctx, data.articles);
  await importFocuses(ctx, data.focuses);
  await importArticleClassifications(ctx, data.articles);
  await importEditionConfigs(ctx, data.editionConfigs);
  await importEditions(ctx, data.editions);
  await importScoringWeights(ctx, data.scoringWeights);
  enqueueReconcileJobs(services, ctx);

  return ctx.result;
};

export type { ImportResult };
export { importUserData };
