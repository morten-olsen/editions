import { sql } from 'kysely';
import type { Kysely, SelectQueryBuilder } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';
import { effectiveConfidenceSql, minConfidenceFilterSql } from '../ranking/ranking.ts';

import type { Focus } from './focuses.ts';

// --- Types ---

type TuningArticle = {
  id: string;
  title: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  confidence: number;
};

type ConfidenceBucket = {
  from: number;
  to: number;
  count: number;
};

type SourceBreakdown = {
  sourceId: string;
  sourceName: string;
  matches: number;
  scored: number;
  avgConfidence: number;
};

/**
 * Everything needed to judge a focus's threshold and source selection without
 * reading a single article body.
 */
type FocusTuning = {
  /** Articles that pass every filter — what the focus currently yields. */
  matchCount: number;
  /** Articles scored against this focus at all, before any threshold. */
  scoredCount: number;
  effectiveMinConfidence: number;
  /** Distribution of confidence across all scored articles, in 0.1 bands. */
  confidenceHistogram: ConfidenceBucket[];
  topMatches: TuningArticle[];
  /** Highest-confidence articles that fell *just* below the threshold. */
  nearMisses: TuningArticle[];
  /** Articles that clear the confidence bar but are cut by the reading-time bounds. */
  excludedByReadingTime: number;
  sourceBreakdown: SourceBreakdown[];
};

type BuildFocusTuningParams = {
  db: Kysely<DatabaseSchema>;
  userId: string;
  /** May carry unsaved overrides — tuning never reads the focus back from the DB. */
  focus: Focus;
  sampleSize: number;
  from?: string;
  to?: string;
};

// --- Constants ---

const HISTOGRAM_BUCKETS = 10;

// --- Query building ---

type TuningQuery = SelectQueryBuilder<DatabaseSchema, 'article_focuses' | 'articles' | 'sources', object>;

const perSourceThresholds = (focus: Focus): Map<string, number> => {
  const map = new Map<string, number>();
  for (const source of focus.sources) {
    if (source.minConfidence !== null) {
      map.set(source.sourceId, source.minConfidence);
    }
  }
  return map;
};

/**
 * Every article scored against this focus from a linked source, with date
 * filters applied but *no* confidence or reading-time filtering. Both the
 * matches and the near-misses are carved out of this same set, so the two
 * always agree on their denominator.
 */
const buildScopeQuery = ({ db, userId, focus, from, to }: Omit<BuildFocusTuningParams, 'sampleSize'>): TuningQuery => {
  const linkedSourceIds = focus.sources.map((s) => s.sourceId);

  let query = db
    .selectFrom('article_focuses')
    .innerJoin('articles', 'articles.id', 'article_focuses.article_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .where('article_focuses.focus_id', '=', focus.id)
    .where('sources.user_id', '=', userId);

  if (linkedSourceIds.length > 0) {
    query = query.where('articles.source_id', 'in', linkedSourceIds);
  } else {
    // No sources linked — the focus yields nothing, by definition.
    query = query.where(sql`0`, '=', sql`1`);
  }

  if (from) {
    query = query.where('articles.published_at', '>=', from);
  }
  if (to) {
    query = query.where('articles.published_at', '<=', to);
  }

  return query;
};

const withinReadingTime = (query: TuningQuery, focus: Focus): TuningQuery => {
  let q = query;
  if (focus.minConsumptionTimeSeconds !== null) {
    q = q.where('articles.consumption_time_seconds', '>=', focus.minConsumptionTimeSeconds);
  }
  if (focus.maxConsumptionTimeSeconds !== null) {
    q = q.where('articles.consumption_time_seconds', '<=', focus.maxConsumptionTimeSeconds);
  }
  return q;
};

const ARTICLE_COLUMNS = [
  'articles.id',
  'articles.title',
  'articles.source_id',
  'articles.published_at',
  'articles.consumption_time_seconds',
  'sources.name as source_name',
] as const;

type ArticleRow = {
  id: string;
  title: string;
  source_id: string;
  published_at: string | null;
  consumption_time_seconds: number | null;
  source_name: string;
  confidence: number | null;
};

const toTuningArticle = (row: ArticleRow): TuningArticle => ({
  id: row.id,
  title: row.title,
  sourceId: row.source_id,
  sourceName: row.source_name,
  publishedAt: row.published_at,
  consumptionTimeSeconds: row.consumption_time_seconds,
  confidence: Number(row.confidence ?? 0),
});

const countOf = async (query: TuningQuery, db: Kysely<DatabaseSchema>): Promise<number> => {
  const row = await query.select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
  return Number(row.count);
};

// --- Public entry point ---

/**
 * Builds the read model behind focus tuning: how many articles a focus matches,
 * how confidence is distributed, what it just barely caught, and what it just
 * barely missed.
 *
 * This exists so a caller can evaluate a threshold change without fetching
 * article content — the near-miss list answers "what would I gain by lowering
 * this?" directly, which is otherwise only discoverable by lowering it and
 * re-listing.
 *
 * `focus` is taken by value rather than by id so unsaved overrides can be
 * previewed. Threshold, source links and reading-time bounds all re-filter
 * stored scores and are therefore cheap; changing name or description is not,
 * because it invalidates the scores themselves.
 */
const buildFocusTuning = async (params: BuildFocusTuningParams): Promise<FocusTuning> => {
  const { db, focus, sampleSize } = params;

  const confidence = effectiveConfidenceSql();
  const confidenceFilter = minConfidenceFilterSql({
    minConfidence: focus.minConfidence,
    perSource: perSourceThresholds(focus),
  });

  const scope = (): TuningQuery => buildScopeQuery(params);
  const passesConfidence = (q: TuningQuery): TuningQuery => (confidenceFilter ? q.where(confidenceFilter) : q);
  const failsConfidence = (q: TuningQuery): TuningQuery =>
    confidenceFilter ? q.where(sql<boolean>`NOT (${confidenceFilter})`) : q.where(sql`0`, '=', sql`1`);

  const matchesQuery = (): TuningQuery => withinReadingTime(passesConfidence(scope()), focus);

  const [scoredCount, matchCount, confidencePassCount] = await Promise.all([
    countOf(scope(), db),
    countOf(matchesQuery(), db),
    countOf(passesConfidence(scope()), db),
  ]);

  const [histogramRows, topRows, nearMissRows, breakdownRows] = await Promise.all([
    scope()
      .select([
        sql<number>`MIN(${HISTOGRAM_BUCKETS - 1}, CAST(${confidence} * ${HISTOGRAM_BUCKETS} AS INTEGER))`.as('bucket'),
        db.fn.countAll().as('count'),
      ])
      .groupBy('bucket')
      .execute(),

    matchesQuery()
      .select([...ARTICLE_COLUMNS, confidence.as('confidence')])
      .orderBy(sql`confidence`, 'desc')
      .limit(sampleSize)
      .execute(),

    withinReadingTime(failsConfidence(scope()), focus)
      .select([...ARTICLE_COLUMNS, confidence.as('confidence')])
      .orderBy(sql`confidence`, 'desc')
      .limit(sampleSize)
      .execute(),

    matchesQuery()
      .select([
        'sources.id as source_id',
        'sources.name as source_name',
        db.fn.countAll().as('matches'),
        sql<number>`AVG(${confidence})`.as('avg_confidence'),
      ])
      .groupBy(['sources.id', 'sources.name'])
      .orderBy('matches', 'desc')
      .execute(),
  ]);

  const scoredBySource = await scope()
    .select(['sources.id as source_id', db.fn.countAll().as('scored')])
    .groupBy('sources.id')
    .execute();
  const scoredMap = new Map(scoredBySource.map((r) => [r.source_id, Number(r.scored)]));

  const histogram: ConfidenceBucket[] = Array.from({ length: HISTOGRAM_BUCKETS }, (_, i) => ({
    from: Number((i / HISTOGRAM_BUCKETS).toFixed(1)),
    to: Number(((i + 1) / HISTOGRAM_BUCKETS).toFixed(1)),
    count: 0,
  }));
  for (const row of histogramRows) {
    const bucket = histogram[Math.max(0, Math.min(HISTOGRAM_BUCKETS - 1, Number(row.bucket)))];
    if (bucket) {
      bucket.count = Number(row.count);
    }
  }

  return {
    matchCount,
    scoredCount,
    effectiveMinConfidence: focus.minConfidence,
    confidenceHistogram: histogram,
    topMatches: (topRows as ArticleRow[]).map(toTuningArticle),
    nearMisses: (nearMissRows as ArticleRow[]).map(toTuningArticle),
    excludedByReadingTime: confidencePassCount - matchCount,
    sourceBreakdown: breakdownRows.map((row) => ({
      sourceId: row.source_id,
      sourceName: row.source_name,
      matches: Number(row.matches),
      scored: scoredMap.get(row.source_id) ?? 0,
      avgConfidence: Number(row.avg_confidence ?? 0),
    })),
  };
};

export type { FocusTuning, TuningArticle, ConfidenceBucket, SourceBreakdown };
export { buildFocusTuning };
