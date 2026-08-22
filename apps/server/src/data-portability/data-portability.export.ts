import { DatabaseService } from '../database/database.ts';
import { EditionsService } from '../editions/editions.ts';
import { FocusesService } from '../focuses/focuses.ts';
import type { Services } from '../services/services.ts';

import type { DataExport } from './data-portability.schemas.ts';

// --- Types ---

type Db = Awaited<ReturnType<DatabaseService['getInstance']>>;
type FocusList = Awaited<ReturnType<FocusesService['list']>>;
type ConfigList = Awaited<ReturnType<EditionsService['listConfigs']>>;
type ArticleKey = { sourceUrl: string; externalId: string };

// --- Private helpers ---

const groupBy = <T>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const arr = map.get(k) ?? [];
    arr.push(row);
    map.set(k, arr);
  }
  return map;
};

// Sources (exclude built-in bookmarks source). Raw rows: `config` is
// type-specific settings this module round-trips without interpreting.
const exportSourcesSection = async (
  db: Db,
  userId: string,
): Promise<{ sources: DataExport['sources']; sourceIdToUrl: Map<string, string>; sourceIds: string[] }> => {
  const allSources = await db.selectFrom('sources').selectAll().where('user_id', '=', userId).execute();
  const sources = allSources
    .filter((s) => s.type !== 'bookmarks')
    .map((s) => ({
      type: s.type as string,
      name: s.name,
      url: s.url,
      config: JSON.parse(s.config) as Record<string, unknown>,
      direction: s.direction,
    }));
  const sourceIdToUrl = new Map(allSources.map((s) => [s.id, s.url]));
  const sourceIds = allSources.filter((s) => s.type !== 'bookmarks').map((s) => s.id);
  return { sources, sourceIdToUrl, sourceIds };
};

// Articles with embeddings and focus classifications
const exportArticlesSection = async ({
  db,
  sourceIds,
  sourceIdToUrl,
  focusIdToName,
}: {
  db: Db;
  sourceIds: string[];
  sourceIdToUrl: Map<string, string>;
  focusIdToName: Map<string, string>;
}): Promise<{ articles: DataExport['articles']; articleIdToKey: Map<string, ArticleKey> }> => {
  const articleRows =
    sourceIds.length > 0
      ? await db.selectFrom('articles').selectAll().where('source_id', 'in', sourceIds).execute()
      : [];
  const articleIds = articleRows.map((a) => a.id);

  const embeddingRows =
    articleIds.length > 0
      ? await db.selectFrom('article_embeddings').selectAll().where('article_id', 'in', articleIds).execute()
      : [];
  const embeddingByArticle = new Map(embeddingRows.map((e) => [e.article_id, e]));

  const articleFocusRows =
    articleIds.length > 0
      ? await db.selectFrom('article_focuses').selectAll().where('article_id', 'in', articleIds).execute()
      : [];
  const articleFocusesByArticle = groupBy(articleFocusRows, (row) => row.article_id);

  const articles = articleRows.map((a) => {
    const embedding = embeddingByArticle.get(a.id);
    const focuses = (articleFocusesByArticle.get(a.id) ?? [])
      .filter((af) => focusIdToName.has(af.focus_id))
      .map((af) => ({
        focusName: focusIdToName.get(af.focus_id) as string,
        similarity: af.similarity,
        similarityModel: af.similarity_model,
        nli: af.nli,
        nliModel: af.nli_model,
      }));

    return {
      sourceUrl: sourceIdToUrl.get(a.source_id) as string,
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
        ? { data: Buffer.from(embedding.embedding as Buffer).toString('base64'), model: embedding.model }
        : null,
      focuses,
    };
  });

  const articleIdToKey = new Map<string, ArticleKey>(
    articleRows.map((a) => [a.id, { sourceUrl: sourceIdToUrl.get(a.source_id) as string, externalId: a.external_id }]),
  );

  return { articles, articleIdToKey };
};

// Focuses with their source links
const buildFocusesSection = (allFocuses: FocusList, sourceIdToUrl: Map<string, string>): DataExport['focuses'] =>
  allFocuses.map((f) => ({
    name: f.name,
    description: f.description,
    icon: f.icon,
    minConfidence: f.minConfidence,
    minConsumptionTimeSeconds: f.minConsumptionTimeSeconds,
    maxConsumptionTimeSeconds: f.maxConsumptionTimeSeconds,
    sources: f.sources
      .filter((fs) => sourceIdToUrl.has(fs.sourceId))
      .map((fs) => ({
        url: sourceIdToUrl.get(fs.sourceId) as string,
        weight: fs.weight,
        minConfidence: fs.minConfidence,
      })),
  }));

// Edition configs with focus links and source budgets
const exportEditionConfigsSection = async ({
  db,
  allConfigs,
  focusIdToName,
  sourceIdToUrl,
}: {
  db: Db;
  allConfigs: ConfigList;
  focusIdToName: Map<string, string>;
  sourceIdToUrl: Map<string, string>;
}): Promise<DataExport['editionConfigs']> => {
  const configIds = allConfigs.map((c) => c.id);
  const sourceBudgetRows =
    configIds.length > 0
      ? await db
          .selectFrom('edition_config_source_budgets')
          .selectAll()
          .where('edition_config_id', 'in', configIds)
          .execute()
      : [];
  const budgetsByConfig = groupBy(sourceBudgetRows, (row) => row.edition_config_id);

  return allConfigs.map((c) => ({
    name: c.name,
    icon: c.icon,
    schedule: c.schedule,
    lookbackHours: c.lookbackHours,
    excludePriorEditions: c.excludePriorEditions,
    enabled: c.enabled,
    focuses: c.focuses
      .filter((f) => focusIdToName.has(f.focusId))
      .map((f) => ({
        focusName: focusIdToName.get(f.focusId) as string,
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
        sourceUrl: sourceIdToUrl.get(sb.source_id) as string,
        maxArticles: sb.max_articles,
        maxReadingMinutes: sb.max_reading_minutes,
      })),
  }));
};

// Editions with their articles
const exportEditionsSection = async ({
  db,
  allConfigs,
  articleIdToKey,
  focusIdToName,
}: {
  db: Db;
  allConfigs: ConfigList;
  articleIdToKey: Map<string, ArticleKey>;
  focusIdToName: Map<string, string>;
}): Promise<DataExport['editions']> => {
  const configIdToName = new Map(allConfigs.map((c) => [c.id, c.name]));
  const configIds = allConfigs.map((c) => c.id);

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
  const editionArticlesByEdition = groupBy(editionArticleRows, (row) => row.edition_id);

  return editionRows.map((e) => ({
    editionConfigName: configIdToName.get(e.edition_config_id) as string,
    title: e.title,
    totalReadingMinutes: e.total_reading_minutes,
    articleCount: e.article_count,
    currentPosition: e.current_position,
    readAt: e.read_at,
    publishedAt: e.published_at,
    articles: (editionArticlesByEdition.get(e.id) ?? [])
      .filter((ea) => articleIdToKey.has(ea.article_id) && focusIdToName.has(ea.focus_id))
      .map((ea) => {
        const key = articleIdToKey.get(ea.article_id) as ArticleKey;
        return {
          sourceUrl: key.sourceUrl,
          externalId: key.externalId,
          focusName: focusIdToName.get(ea.focus_id) as string,
          position: ea.position,
        };
      }),
  }));
};

// Scoring weights
const exportScoringWeightsSection = async (db: Db, userId: string): Promise<DataExport['scoringWeights']> => {
  const userRow = await db.selectFrom('users').select('scoring_weights').where('id', '=', userId).executeTakeFirst();
  return userRow?.scoring_weights ? (JSON.parse(userRow.scoring_weights) as Record<string, unknown>) : null;
};

// --- Public API ---

const exportUserData = async (services: Services, userId: string): Promise<DataExport> => {
  const db = await services.get(DatabaseService).getInstance();

  const { sources, sourceIdToUrl, sourceIds } = await exportSourcesSection(db, userId);

  const allFocuses = await services.get(FocusesService).list(userId);
  const focusIdToName = new Map(allFocuses.map((f) => [f.id, f.name]));

  const { articles, articleIdToKey } = await exportArticlesSection({ db, sourceIds, sourceIdToUrl, focusIdToName });
  const focuses = buildFocusesSection(allFocuses, sourceIdToUrl);

  const allConfigs = await services.get(EditionsService).listConfigs(userId);
  const editionConfigs = await exportEditionConfigsSection({ db, allConfigs, focusIdToName, sourceIdToUrl });
  const editions = await exportEditionsSection({ db, allConfigs, articleIdToKey, focusIdToName });
  const scoringWeights = await exportScoringWeightsSection(db, userId);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sources,
    articles,
    focuses,
    editionConfigs,
    editions,
    scoringWeights,
  };
};

export { exportUserData };
