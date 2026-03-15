import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { DatabaseSchema, EditionBudgetType } from '../database/database.types.ts';
import type { FocusesService } from '../focuses/focuses.ts';
import type { VoteContext, ScoringCandidate, UserScoringWeights, VotesService } from '../votes/votes.ts';
import { mergeVoteContexts } from '../votes/votes.ts';
import { computeScore } from '../votes/votes.scoring.ts';

// --- Types ---

type FocusDetail = {
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sourceWeights: Map<string, number>;
  sourceMinConfidence: Map<string, number>;
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type GenerateContext = {
  db: Kysely<DatabaseSchema>;
  userId: string;
  configId: string;
  defaultLookbackHours: number;
  defaultExcludePriorEditions: boolean;
  sortedFocuses: FocusConfig[];
  focusDetails: Map<string, FocusDetail>;
  excludedArticleIds: Set<string>;
  voteContext: {
    global: VoteContext;
    edition: VoteContext;
  };
  votesService: VotesService;
  editionWeights: UserScoringWeights['edition'];
};

type CollectedArticle = {
  articleId: string;
  focusId: string;
  position: number;
};

type GenerateResult = {
  articles: CollectedArticle[];
  totalReadingSeconds: number;
};

// --- Helpers ---

const loadExcludedArticleIds = async (
  db: Kysely<DatabaseSchema>,
  configId: string,
  needsExcludedSet: boolean,
): Promise<Set<string>> => {
  const excluded = new Set<string>();
  if (!needsExcludedSet) {
    return excluded;
  }

  const priorArticles = await db
    .selectFrom('edition_articles')
    .innerJoin('editions', 'editions.id', 'edition_articles.edition_id')
    .select('edition_articles.article_id')
    .where('editions.edition_config_id', '=', configId)
    .execute();

  for (const row of priorArticles) {
    excluded.add(row.article_id);
  }
  return excluded;
};

const loadFocusDetails = async (
  focusesService: FocusesService,
  userId: string,
  sortedFocuses: FocusConfig[],
): Promise<Map<string, FocusDetail>> => {
  const focuses = await Promise.all(
    sortedFocuses.map((fc) => focusesService.get(userId, fc.focusId)),
  );

  const details = new Map<string, FocusDetail>();
  for (let i = 0; i < sortedFocuses.length; i++) {
    const fc = sortedFocuses[i] as FocusConfig;
    const focus = focuses[i] as Awaited<ReturnType<FocusesService['get']>>;
    const sourceWeights = new Map<string, number>();
    const sourceMinConfidence = new Map<string, number>();
    for (const src of focus.sources) {
      sourceWeights.set(src.sourceId, src.weight);
      if (src.minConfidence !== null) {
        sourceMinConfidence.set(src.sourceId, src.minConfidence);
      }
    }
    details.set(fc.focusId, {
      minConfidence: focus.minConfidence,
      minConsumptionTimeSeconds: focus.minConsumptionTimeSeconds,
      maxConsumptionTimeSeconds: focus.maxConsumptionTimeSeconds,
      sourceWeights,
      sourceMinConfidence,
    });
  }
  return details;
};

const queryCandidates = async ({
  db,
  userId,
  focusId,
  cutoff,
  focusInfo,
}: {
  db: Kysely<DatabaseSchema>;
  userId: string;
  focusId: string;
  cutoff: string;
  focusInfo: FocusDetail;
}): Promise<CandidateRow[]> => {
  // Only consider articles from sources linked to this focus
  const linkedSourceIds = [...focusInfo.sourceWeights.keys()];

  let query = db
    .selectFrom('article_focuses')
    .innerJoin('articles', 'articles.id', 'article_focuses.article_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .select([
      'articles.id',
      'articles.source_id',
      'articles.published_at',
      'articles.consumption_time_seconds',
      'article_focuses.similarity',
      'article_focuses.nli',
      'article_embeddings.embedding',
    ])
    .where('article_focuses.focus_id', '=', focusId)
    .where('sources.user_id', '=', userId)
    .where('articles.read_at', 'is', null)
    .where('articles.published_at', '>=', cutoff);

  if (linkedSourceIds.length > 0) {
    query = query.where('articles.source_id', 'in', linkedSourceIds);
  } else {
    query = query.where(sql`0`, '=', sql`1`);
  }

  const hasSourceOverrides = focusInfo.sourceMinConfidence.size > 0;
  if (focusInfo.minConfidence > 0 || hasSourceOverrides) {
    if (hasSourceOverrides) {
      // Build threshold from in-memory config (same as focuses.articles.ts)
      const cases = [...focusInfo.sourceMinConfidence.entries()].map(
        ([sourceId, minConf]) => sql`WHEN articles.source_id = ${sourceId} THEN ${minConf}`,
      );
      const thresholdExpr = cases.length > 0
        ? sql`CASE ${sql.join(cases, sql` `)} ELSE ${focusInfo.minConfidence} END`
        : sql`${focusInfo.minConfidence}`;
      query = query.where(sql`COALESCE(article_focuses.nli, article_focuses.similarity)`, '>=', thresholdExpr);
    } else {
      query = query.where(sql`COALESCE(article_focuses.nli, article_focuses.similarity)`, '>=', focusInfo.minConfidence);
    }
  }

  if (focusInfo.minConsumptionTimeSeconds !== null) {
    query = query.where('articles.consumption_time_seconds', '>=', focusInfo.minConsumptionTimeSeconds);
  }

  if (focusInfo.maxConsumptionTimeSeconds !== null) {
    query = query.where('articles.consumption_time_seconds', '<=', focusInfo.maxConsumptionTimeSeconds);
  }

  return query.execute();
};

type CandidateRow = {
  id: string;
  source_id: string;
  published_at: string | null;
  consumption_time_seconds: number | null;
  similarity: number | null;
  nli: number | null;
  embedding: unknown;
};

const scoreCandidates = ({
  candidates,
  voteContext,
  editionWeights,
  sourceWeights,
  focusWeight,
}: {
  candidates: CandidateRow[];
  voteContext: VoteContext;
  editionWeights: UserScoringWeights['edition'];
  sourceWeights: Map<string, number>;
  focusWeight: number;
}): ScoredCandidate[] => {
  const mapped = candidates.map((c) => {
    const embeddingBuf = c.embedding as Buffer | null;
    return {
      ...c,
      articleId: c.id,
      similarity: c.similarity,
      nli: c.nli,
      publishedAt: c.published_at,
      embedding: embeddingBuf
        ? new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)
        : null,
    };
  });

  const scored = mapped.map((c) => ({
    item: c,
    score: computeScore(c, voteContext, editionWeights) * (sourceWeights.get(c.source_id) ?? 1) * focusWeight,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
};

type ScoredCandidate = ScoringCandidate &
  CandidateRow & {
    articleId: string;
    publishedAt: string | null;
    embedding: Float32Array | null;
  };

const pickWeightedSource = (activeSources: Set<string>, sourceWeights: Map<string, number>): string => {
  let totalWeight = 0;
  const pool: { sourceId: string; weight: number }[] = [];
  for (const sourceId of activeSources) {
    const w = sourceWeights.get(sourceId) ?? 1;
    pool.push({ sourceId, weight: w });
    totalWeight += w;
  }

  let roll = Math.random() * totalWeight;
  let picked = (pool[0] as (typeof pool)[number]).sourceId;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      picked = entry.sourceId;
      break;
    }
  }
  return picked;
};

const selectArticlesByBudget = (
  eligible: ScoredCandidate[],
  sourceWeights: Map<string, number>,
  focusConfig: FocusConfig,
): { selected: { id: string; consumptionTimeSeconds: number | null }[]; budgetUsed: number } => {
  // Group by source for weighted round-robin
  const bySource = new Map<string, ScoredCandidate[]>();
  for (const article of eligible) {
    const arr = bySource.get(article.source_id) ?? [];
    arr.push(article);
    bySource.set(article.source_id, arr);
  }

  const sourceIndex = new Map<string, number>();
  const activeSources = new Set<string>();
  for (const sid of bySource.keys()) {
    sourceIndex.set(sid, 0);
    activeSources.add(sid);
  }

  const selected: { id: string; consumptionTimeSeconds: number | null }[] = [];
  let budgetUsed = 0;

  while (activeSources.size > 0 && budgetUsed < focusConfig.budgetValue) {
    const picked = pickWeightedSource(activeSources, sourceWeights);

    // Take the next best article from the picked source
    const idx = sourceIndex.get(picked) ?? 0;
    const articles = bySource.get(picked) ?? [];
    const article = articles[idx];

    if (!article) {
      activeSources.delete(picked);
      continue;
    }

    sourceIndex.set(picked, idx + 1);
    selected.push({ id: article.id, consumptionTimeSeconds: article.consumption_time_seconds });

    if (focusConfig.budgetType === 'count') {
      budgetUsed++;
    } else {
      budgetUsed += Math.ceil((article.consumption_time_seconds ?? 0) / 60);
    }

    // Remove source if no more articles
    if (idx + 1 >= articles.length) {
      activeSources.delete(picked);
    }
  }

  return { selected, budgetUsed };
};

const collectArticlesForFocuses = async (ctx: GenerateContext): Promise<GenerateResult> => {
  const claimedArticleIds = new Set<string>();
  const articles: CollectedArticle[] = [];
  let globalPosition = 0;
  let totalReadingSeconds = 0;

  for (const focusConfig of ctx.sortedFocuses) {
    const focusInfo = ctx.focusDetails.get(focusConfig.focusId);
    if (!focusInfo) {
      continue;
    }

    const lookbackHours = focusConfig.lookbackHours ?? ctx.defaultLookbackHours;
    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

    const candidates = await queryCandidates({
      db: ctx.db,
      userId: ctx.userId,
      focusId: focusConfig.focusId,
      cutoff,
      focusInfo,
    });

    // Load focus-scoped vote context and merge with global + edition
    const focusVoteContext = await ctx.votesService.loadVoteContext(ctx.userId, focusConfig.focusId);
    const voteContext = mergeVoteContexts(
      mergeVoteContexts(ctx.voteContext.global, focusVoteContext),
      ctx.voteContext.edition,
    );

    const scoredCandidates = scoreCandidates({
      candidates,
      voteContext,
      editionWeights: ctx.editionWeights,
      sourceWeights: focusInfo.sourceWeights,
      focusWeight: focusConfig.weight,
    });

    // Filter out already claimed articles and, if applicable, articles from prior editions
    const effectiveExclude = focusConfig.excludePriorEditions ?? ctx.defaultExcludePriorEditions;
    const eligible = scoredCandidates.filter(
      (c) => !claimedArticleIds.has(c.id) && (!effectiveExclude || !ctx.excludedArticleIds.has(c.id)),
    );

    const { selected } = selectArticlesByBudget(eligible, focusInfo.sourceWeights, focusConfig);

    for (const article of selected) {
      claimedArticleIds.add(article.id);
      articles.push({
        articleId: article.id,
        focusId: focusConfig.focusId,
        position: globalPosition++,
      });
      totalReadingSeconds += article.consumptionTimeSeconds ?? 0;
    }
  }

  return { articles, totalReadingSeconds };
};

export type { FocusConfig, FocusDetail, GenerateContext, CollectedArticle, GenerateResult };
export { loadExcludedArticleIds, loadFocusDetails, collectArticlesForFocuses };
