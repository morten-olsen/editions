import { sql } from 'kysely';
import type { Kysely } from 'kysely';

import type { DatabaseSchema, EditionBudgetType } from '../database/database.types.ts';
import type { FocusesService } from '../focuses/focuses.ts';
import { mergeVoteContexts, minConfidenceFilterSql, scoreAndRank } from '../ranking/ranking.ts';
import type { ScoringWeights, VoteContext } from '../ranking/ranking.ts';
import type { VotesService } from '../votes/votes.ts';

// --- Types ---

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type FocusDetail = {
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sourceWeights: Map<string, number>;
  sourceMinConfidence: Map<string, number>;
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

// Everything the (pure) generation algorithm needs for one focus,
// fully loaded and resolved — no service or DB handles.
type FocusGenerationInput = {
  focusId: string;
  budgetType: EditionBudgetType;
  budgetValue: number;
  weight: number;
  excludePriorEditions: boolean;
  sourceWeights: Map<string, number>;
  candidates: CandidateRow[];
  voteContext: VoteContext;
};

type GenerateInputs = {
  focuses: FocusGenerationInput[];
  excludedArticleIds: Set<string>;
  editionWeights: ScoringWeights;
  rng?: () => number;
  now?: number;
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

type LoadGenerationInputsParams = {
  db: Kysely<DatabaseSchema>;
  focusesService: FocusesService;
  votesService: VotesService;
  userId: string;
  configId: string;
  defaultLookbackHours: number;
  defaultExcludePriorEditions: boolean;
  focuses: FocusConfig[];
};

// --- Loading (all I/O lives here) ---

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
  const focuses = await Promise.all(sortedFocuses.map((fc) => focusesService.get(userId, fc.focusId)));

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

  const confidenceFilter = minConfidenceFilterSql({
    minConfidence: focusInfo.minConfidence,
    perSource: focusInfo.sourceMinConfidence,
  });
  if (confidenceFilter) {
    query = query.where(confidenceFilter);
  }

  if (focusInfo.minConsumptionTimeSeconds !== null) {
    query = query.where('articles.consumption_time_seconds', '>=', focusInfo.minConsumptionTimeSeconds);
  }

  if (focusInfo.maxConsumptionTimeSeconds !== null) {
    query = query.where('articles.consumption_time_seconds', '<=', focusInfo.maxConsumptionTimeSeconds);
  }

  return query.execute();
};

const loadGenerationInputs = async (params: LoadGenerationInputsParams): Promise<GenerateInputs> => {
  const {
    db,
    focusesService,
    votesService,
    userId,
    configId,
    defaultLookbackHours,
    defaultExcludePriorEditions,
    focuses,
  } = params;

  const sortedFocuses = [...focuses]
    .sort((a, b) => a.position - b.position)
    .map((fc) => ({
      ...fc,
      excludePriorEditions: fc.excludePriorEditions ?? defaultExcludePriorEditions,
    }));
  const needsExcludedSet = sortedFocuses.some((fc) => fc.excludePriorEditions);

  const [excludedArticleIds, focusDetails, globalContext, editionContext, userWeights] = await Promise.all([
    loadExcludedArticleIds(db, configId, needsExcludedSet),
    loadFocusDetails(focusesService, userId, sortedFocuses),
    votesService.loadVoteContext(userId, null),
    votesService.loadEditionVoteContext(userId, configId),
    votesService.loadUserScoringWeights(userId),
  ]);

  const focusInputs = await Promise.all(
    sortedFocuses.map(async (fc): Promise<FocusGenerationInput | null> => {
      const detail = focusDetails.get(fc.focusId);
      if (!detail) {
        return null;
      }

      const lookbackHours = fc.lookbackHours ?? defaultLookbackHours;
      const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

      const [candidates, focusContext] = await Promise.all([
        queryCandidates({ db, userId, focusId: fc.focusId, cutoff, focusInfo: detail }),
        votesService.loadVoteContext(userId, fc.focusId),
      ]);

      return {
        focusId: fc.focusId,
        budgetType: fc.budgetType,
        budgetValue: fc.budgetValue,
        weight: fc.weight,
        excludePriorEditions: fc.excludePriorEditions,
        sourceWeights: detail.sourceWeights,
        candidates,
        voteContext: mergeVoteContexts(mergeVoteContexts(globalContext, focusContext), editionContext),
      };
    }),
  );

  return {
    focuses: focusInputs.filter((f): f is FocusGenerationInput => f !== null),
    excludedArticleIds,
    editionWeights: userWeights.edition,
  };
};

// --- Generation (pure) ---

type ScoredCandidate = CandidateRow & {
  articleId: string;
  sourceId: string;
  publishedAt: string | null;
};

const pickWeightedSource = (
  activeSources: Set<string>,
  sourceWeights: Map<string, number>,
  rng: () => number,
): string => {
  let totalWeight = 0;
  const pool: { sourceId: string; weight: number }[] = [];
  for (const sourceId of activeSources) {
    const w = sourceWeights.get(sourceId) ?? 1;
    pool.push({ sourceId, weight: w });
    totalWeight += w;
  }

  let roll = rng() * totalWeight;
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

const selectArticlesByBudget = (params: {
  eligible: ScoredCandidate[];
  sourceWeights: Map<string, number>;
  budgetType: EditionBudgetType;
  budgetValue: number;
  rng: () => number;
}): { selected: { id: string; consumptionTimeSeconds: number | null }[]; budgetUsed: number } => {
  const { eligible, sourceWeights, budgetType, budgetValue, rng } = params;

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

  while (activeSources.size > 0 && budgetUsed < budgetValue) {
    const picked = pickWeightedSource(activeSources, sourceWeights, rng);

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

    if (budgetType === 'count') {
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

const generateEdition = (inputs: GenerateInputs): GenerateResult => {
  const { focuses, excludedArticleIds, editionWeights, rng = Math.random, now } = inputs;

  const claimedArticleIds = new Set<string>();
  const articles: CollectedArticle[] = [];
  let globalPosition = 0;
  let totalReadingSeconds = 0;

  for (const focus of focuses) {
    const candidates = focus.candidates.map((c) => ({
      ...c,
      articleId: c.id,
      sourceId: c.source_id,
      publishedAt: c.published_at,
    }));

    const scored = scoreAndRank({
      candidates,
      voteContext: focus.voteContext,
      weights: editionWeights,
      sourceWeights: focus.sourceWeights,
      focusWeight: focus.weight,
      now,
    }).map((s) => s.item);

    // Filter out already claimed articles and, if applicable, articles from prior editions
    const eligible = scored.filter(
      (c) => !claimedArticleIds.has(c.id) && (!focus.excludePriorEditions || !excludedArticleIds.has(c.id)),
    );

    const { selected } = selectArticlesByBudget({
      eligible,
      sourceWeights: focus.sourceWeights,
      budgetType: focus.budgetType,
      budgetValue: focus.budgetValue,
      rng,
    });

    for (const article of selected) {
      claimedArticleIds.add(article.id);
      articles.push({
        articleId: article.id,
        focusId: focus.focusId,
        position: globalPosition++,
      });
      totalReadingSeconds += article.consumptionTimeSeconds ?? 0;
    }
  }

  return { articles, totalReadingSeconds };
};

export type { FocusConfig, FocusGenerationInput, GenerateInputs, CandidateRow, CollectedArticle, GenerateResult };
export { loadGenerationInputs, generateEdition };
