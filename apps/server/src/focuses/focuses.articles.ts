import { sql } from 'kysely';
import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';
import { VotesService, mergeVoteContexts } from '../votes/votes.ts';
import { computeScore } from '../votes/votes.scoring.ts';
import type { Services } from '../services/services.ts';

import type { Focus } from './focuses.ts';

// --- Types ---

type ArticleSort = 'top' | 'recent';
type ArticleStatus = 'unread' | 'read' | 'all';

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

type ListContext = {
  services: Services;
  focus: Focus;
  userId: string;
  focusId: string;
  offset: number;
  limit: number;
  total: number;
};

// --- Column selections ---

const ARTICLE_COLUMNS = [
  'articles.id',
  'articles.source_id',
  'articles.external_id',
  'articles.url',
  'articles.title',
  'articles.author',
  'articles.summary',
  'articles.image_url',
  'articles.published_at',
  'articles.consumption_time_seconds',
  'articles.read_at',
  'articles.created_at',
  'article_focuses.similarity',
  'article_focuses.nli',
  'sources.name as source_name',
  'sources.type as source_type',
] as const;

// --- Query helpers ---

type BaseQuery = ReturnType<typeof buildBaseQuery>;

type BaseQueryParams = {
  db: Kysely<DatabaseSchema>;
  focusId: string;
  userId: string;
  focus: Focus;
  filters: { from?: string; to?: string; status?: ArticleStatus };
};

const buildBaseQuery = (params: BaseQueryParams) => {
  const { db, focusId, userId, focus, filters } = params;

  const hasSourceOverrides = focus.sources.some((s) => s.minConfidence !== null);

  // Filter to only articles from sources linked to this focus
  const linkedSourceIds = focus.sources.map((s) => s.sourceId);

  let q = db
    .selectFrom('article_focuses')
    .innerJoin('articles', 'articles.id', 'article_focuses.article_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .where('article_focuses.focus_id', '=', focusId)
    .where('sources.user_id', '=', userId);

  if (linkedSourceIds.length > 0) {
    q = q.where('articles.source_id', 'in', linkedSourceIds);
  } else {
    // No sources linked — return nothing
    q = q.where(sql`0`, '=', sql`1`);
  }

  if (focus.minConfidence > 0 || hasSourceOverrides) {
    if (hasSourceOverrides) {
      // Build threshold from the in-memory source config so previews
      // with unsaved overrides work correctly
      const cases = focus.sources
        .filter((s) => s.minConfidence !== null)
        .map((s) => sql`WHEN articles.source_id = ${s.sourceId} THEN ${s.minConfidence}`);

      const thresholdExpr =
        cases.length > 0
          ? sql`CASE ${sql.join(cases, sql` `)} ELSE ${focus.minConfidence} END`
          : sql`${focus.minConfidence}`;

      q = q.where(sql`COALESCE(article_focuses.nli, article_focuses.similarity)`, '>=', thresholdExpr);
    } else {
      q = q.where(sql`COALESCE(article_focuses.nli, article_focuses.similarity)`, '>=', focus.minConfidence);
    }
  }
  if (filters.from) {
    q = q.where('articles.published_at', '>=', filters.from);
  }
  if (filters.to) {
    q = q.where('articles.published_at', '<=', filters.to);
  }
  if (filters.status === 'unread') {
    q = q.where('articles.read_at', 'is', null);
  } else if (filters.status === 'read') {
    q = q.where('articles.read_at', 'is not', null);
  }
  if (focus.minConsumptionTimeSeconds !== null) {
    q = q.where('articles.consumption_time_seconds', '>=', focus.minConsumptionTimeSeconds);
  }
  if (focus.maxConsumptionTimeSeconds !== null) {
    q = q.where('articles.consumption_time_seconds', '<=', focus.maxConsumptionTimeSeconds);
  }

  return q;
};

const mapRowToArticle = (
  row: Record<string, unknown>,
  votes: { focus: 1 | -1 | null; global: 1 | -1 | null } | undefined,
  score: number,
): FocusArticle => ({
  id: row.id as string,
  sourceId: row.source_id as string,
  externalId: row.external_id as string,
  url: row.url as string | null,
  title: row.title as string,
  author: row.author as string | null,
  summary: row.summary as string | null,
  imageUrl: row.image_url as string | null,
  publishedAt: row.published_at as string | null,
  consumptionTimeSeconds: row.consumption_time_seconds as number | null,
  readAt: row.read_at as string | null,
  createdAt: row.created_at as string,
  confidence: (row.nli as number | null) ?? (row.similarity as number | null) ?? 0,
  score,
  vote: votes?.focus ?? null,
  globalVote: votes?.global ?? null,
  sourceName: row.source_name as string,
  sourceType: row.source_type as string,
});

// --- Sort strategies ---

const listRecent = async (ctx: ListContext, base: BaseQuery): Promise<FocusArticlesPage> => {
  const rows = await base
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .select(ARTICLE_COLUMNS)
    .orderBy('articles.published_at', 'desc')
    .offset(ctx.offset)
    .limit(ctx.limit)
    .execute();

  const votesService = ctx.services.get(VotesService);
  const votesMap = await votesService.getVotesByArticleIds(
    ctx.userId,
    rows.map((r) => r.id),
    ctx.focusId,
  );

  return {
    articles: rows.map((row) => {
      const confidence = row.nli ?? row.similarity ?? 0;
      return mapRowToArticle(row as unknown as Record<string, unknown>, votesMap.get(row.id), confidence);
    }),
    total: ctx.total,
    offset: ctx.offset,
    limit: ctx.limit,
  };
};

const listTop = async (ctx: ListContext, base: BaseQuery): Promise<FocusArticlesPage> => {
  const rows = await base
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .select([...ARTICLE_COLUMNS, 'article_embeddings.embedding'])
    .execute();

  const votesService = ctx.services.get(VotesService);
  const [focusContext, globalContext, userWeights] = await Promise.all([
    votesService.loadVoteContext(ctx.userId, ctx.focusId),
    votesService.loadVoteContext(ctx.userId, null),
    votesService.loadUserScoringWeights(ctx.userId),
  ]);
  const voteContext = mergeVoteContexts(globalContext, focusContext);

  const sourceWeights = new Map<string, number>();
  for (const src of ctx.focus.sources) {
    sourceWeights.set(src.sourceId, src.weight);
  }

  const candidates = rows.map((row) => {
    const embeddingBuf = row.embedding as Buffer | null;
    const embedding = embeddingBuf
      ? new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)
      : null;
    return {
      ...row,
      embedding,
      articleId: row.id,
      publishedAt: row.published_at,
    };
  });

  const scored = candidates.map((c) => ({
    item: c,
    score: computeScore(c, voteContext, userWeights.focus) * (sourceWeights.get(c.source_id) ?? 1),
  }));
  scored.sort((a, b) => b.score - a.score);

  const page = scored.slice(ctx.offset, ctx.offset + ctx.limit);
  const articleIds = page.map((s) => s.item.id);
  const votesMap = await votesService.getVotesByArticleIds(ctx.userId, articleIds, ctx.focusId);

  return {
    articles: page.map((s) => {
      const c = s.item;
      return mapRowToArticle(c as unknown as Record<string, unknown>, votesMap.get(c.id), s.score);
    }),
    total: ctx.total,
    offset: ctx.offset,
    limit: ctx.limit,
  };
};

// --- Public entry point ---

type ListFocusArticlesParams = {
  services: Services;
  focus: Focus;
  userId: string;
  focusId: string;
  opts?: ListArticlesOptions;
};

const listFocusArticles = async (params: ListFocusArticlesParams): Promise<FocusArticlesPage> => {
  const { services, focus, userId, focusId, opts = {} } = params;
  const { offset = 0, limit = 20, sort = 'top', from, to, status = 'all' } = opts;
  const { DatabaseService } = await import('../database/database.ts');
  const db = await services.get(DatabaseService).getInstance();

  const queryParams: BaseQueryParams = { db, focusId, userId, focus, filters: { from, to, status } };
  const countResult = await buildBaseQuery(queryParams).select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
  const total = Number(countResult.count);

  const ctx: ListContext = { services, focus, userId, focusId, offset, limit, total };
  const freshBase = buildBaseQuery(queryParams);

  if (sort === 'recent') {
    return listRecent(ctx, freshBase);
  }

  return listTop(ctx, freshBase);
};

export type { FocusArticle, FocusArticlesPage, ListArticlesOptions };
export { listFocusArticles };
