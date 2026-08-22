import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import { scoreAndRank } from '../ranking/ranking.ts';
import type { RankingCandidate } from '../ranking/ranking.ts';
import { VotesService } from '../votes/votes.ts';
import type { Services } from '../services/services.ts';

// --- Types ---

type FeedSort = 'top' | 'recent';
type FeedStatus = 'unread' | 'read' | 'all';

type ListFeedOptions = {
  offset?: number;
  limit?: number;
  sort?: FeedSort;
  status?: FeedStatus;
  from?: string;
  to?: string;
};

type FeedArticle = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt: string | null;
  progress: number;
  createdAt: string;
  score: number;
  vote: 1 | -1 | null;
  sourceName: string;
};

type FeedPage = {
  articles: FeedArticle[];
  total: number;
  offset: number;
  limit: number;
};

type FeedCandidate = RankingCandidate & {
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  consumptionTimeSeconds: number | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt: string | null;
  progress: number;
  createdAt: string;
  sourceName: string;
};

type ListContext = {
  services: Services;
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely base query type
  baseQuery: () => any;
  offset: number;
  limit: number;
  total: number;
};

// --- Column selections ---

const ARTICLE_SELECT_COLUMNS = [
  'articles.id',
  'articles.source_id',
  'articles.url',
  'articles.title',
  'articles.author',
  'articles.summary',
  'articles.image_url',
  'articles.published_at',
  'articles.consumption_time_seconds',
  'articles.media_url',
  'articles.media_type',
  'articles.read_at',
  'articles.progress',
  'articles.created_at',
  'sources.name as source_name',
  'sources.type as source_type',
] as const;

// --- Private helpers ---

const buildBaseQuery = (params: {
  db: Kysely<DatabaseSchema>;
  userId: string;
  filters: { status: FeedStatus; from?: string; to?: string };
}): (() => ReturnType<typeof baseSelect>) => {
  const { db, userId, filters } = params;

  const baseSelect = () =>
    db
      .selectFrom('articles')
      .innerJoin('sources', 'sources.id', 'articles.source_id')
      .where('sources.user_id', '=', userId);

  return () => {
    let q = baseSelect();

    if (filters.status === 'unread') {
      q = q.where('articles.read_at', 'is', null);
    } else if (filters.status === 'read') {
      q = q.where('articles.read_at', 'is not', null);
    }
    if (filters.from) {
      q = q.where('articles.published_at', '>=', filters.from);
    }
    if (filters.to) {
      q = q.where('articles.published_at', '<=', filters.to);
    }

    return q;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely row types vary by query shape
const mapRowToArticle = (row: any, vote: 1 | -1 | null, score: number): FeedArticle => ({
  id: row.id,
  sourceId: row.source_id,
  url: row.url,
  title: row.title,
  author: row.author,
  summary: row.summary,
  imageUrl: row.image_url,
  publishedAt: row.published_at,
  consumptionTimeSeconds: row.consumption_time_seconds,
  mediaUrl: row.media_url,
  mediaType: row.media_type,
  sourceType: row.source_type,
  readAt: row.read_at,
  progress: row.progress,
  createdAt: row.created_at,
  score,
  vote,
  sourceName: row.source_name,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely row type from dynamic query
const rowToCandidate = (row: any): FeedCandidate => {
  return {
    articleId: row.id,
    // The global feed has no focus context, so confidence is a constant.
    // It is uniform across candidates and never affects ordering.
    similarity: 1,
    nli: null,
    publishedAt: row.published_at,
    embedding: row.embedding,
    sourceId: row.source_id,
    url: row.url,
    title: row.title,
    author: row.author,
    summary: row.summary,
    imageUrl: row.image_url,
    consumptionTimeSeconds: row.consumption_time_seconds,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    sourceType: row.source_type,
    readAt: row.read_at,
    progress: row.progress,
    createdAt: row.created_at,
    sourceName: row.source_name,
  };
};

const mapCandidateToArticle = (c: FeedCandidate, vote: 1 | -1 | null, score: number): FeedArticle => ({
  id: c.articleId,
  sourceId: c.sourceId,
  url: c.url,
  title: c.title,
  author: c.author,
  summary: c.summary,
  imageUrl: c.imageUrl,
  publishedAt: c.publishedAt,
  consumptionTimeSeconds: c.consumptionTimeSeconds,
  mediaUrl: c.mediaUrl,
  mediaType: c.mediaType,
  sourceType: c.sourceType,
  readAt: c.readAt,
  progress: c.progress,
  createdAt: c.createdAt,
  score,
  vote,
  sourceName: c.sourceName,
});

const listRecent = async (ctx: ListContext): Promise<FeedPage> => {
  const rows = await ctx
    .baseQuery()
    .select(ARTICLE_SELECT_COLUMNS)
    .orderBy('articles.published_at', 'desc')
    .offset(ctx.offset)
    .limit(ctx.limit)
    .execute();

  const votesService = ctx.services.get(VotesService);
  const articleIds = rows.map((r: { id: string }) => r.id);
  const votesMap = await votesService.getVotesByArticleIds(ctx.userId, articleIds, null);

  return {
    articles: rows.map((row: unknown) => {
      const r = row as { id: string };
      const votes = votesMap.get(r.id);
      return mapRowToArticle(row, votes?.global ?? null, 0);
    }),
    total: ctx.total,
    offset: ctx.offset,
    limit: ctx.limit,
  };
};

const listTop = async (ctx: ListContext): Promise<FeedPage> => {
  const rows = await ctx
    .baseQuery()
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .select([...ARTICLE_SELECT_COLUMNS, 'article_embeddings.embedding'])
    .execute();

  const votesService = ctx.services.get(VotesService);
  const [globalContext, userWeights] = await Promise.all([
    votesService.loadVoteContext(ctx.userId, null),
    votesService.loadUserScoringWeights(ctx.userId),
  ]);

  const candidates = (rows as unknown[]).map(rowToCandidate);
  const ranked = scoreAndRank({ candidates, voteContext: globalContext, weights: userWeights.global });
  const page = ranked.slice(ctx.offset, ctx.offset + ctx.limit);

  const articleIds = page.map((r) => r.item.articleId);
  const votesMap = await votesService.getVotesByArticleIds(ctx.userId, articleIds, null);

  return {
    articles: page.map(({ item, score }) => {
      const votes = votesMap.get(item.articleId);
      return mapCandidateToArticle(item, votes?.global ?? null, score);
    }),
    total: ctx.total,
    offset: ctx.offset,
    limit: ctx.limit,
  };
};

// --- Public entry point ---

type ListFeedArticlesParams = {
  services: Services;
  userId: string;
  opts?: ListFeedOptions;
};

const listFeedArticles = async (params: ListFeedArticlesParams): Promise<FeedPage> => {
  const { services, userId, opts = {} } = params;
  const { offset = 0, limit = 20, sort = 'top', status = 'all', from, to } = opts;

  const db = await services.get(DatabaseService).getInstance();
  const baseQuery = buildBaseQuery({ db, userId, filters: { status, from, to } });

  const countResult = await baseQuery().select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
  const total = Number(countResult.count);

  const ctx: ListContext = { services, userId, baseQuery, offset, limit, total };

  if (sort === 'recent') {
    return listRecent(ctx);
  }

  return listTop(ctx);
};

export type { FeedArticle, FeedPage, ListFeedOptions, FeedSort, FeedStatus };
export { listFeedArticles };
