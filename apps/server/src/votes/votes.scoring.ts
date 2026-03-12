// --- Scoring weights ---

const RECENCY_HALF_LIFE_DAYS = 3;
const MAX_VOTE_CONTEXT_SIZE = 200;

// Top-k propagation: only the k most similar voted articles contribute
const PROPAGATION_TOP_K = 15;
const PROPAGATION_MIN_SIMILARITY = 0.3;

// Per-feed-type weight presets
type ScoringWeights = {
  alpha: number; // confidence weight
  beta: number; // vote propagation weight
  gamma: number; // recency decay weight
};

const globalWeights: ScoringWeights = { alpha: 0, beta: 0.6, gamma: 0.4 };
const focusWeights: ScoringWeights = { alpha: 0.4, beta: 0.4, gamma: 0.2 };
const editionWeights: ScoringWeights = { alpha: 0.5, beta: 0.4, gamma: 0.1 };

// --- Types ---

type VotedArticle = {
  embedding: Float32Array;
  value: 1 | -1;
};

type VoteContext = {
  votes: Map<string, 1 | -1>;
  votedArticles: VotedArticle[];
};

type ScoringCandidate = {
  articleId: string;
  similarity: number | null;
  nli: number | null;
  publishedAt: string | null;
  embedding: Float32Array | null;
};

const effectiveConfidence = (c: { similarity: number | null; nli: number | null }): number =>
  c.nli ?? c.similarity ?? 0;

// --- Private helpers ---

const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] as number) * (b[i] as number);
  }
  // Embeddings from all-MiniLM-L6-v2 are L2-normalized, so dot product = cosine similarity
  return dot;
};

const recencyDecay = (publishedAt: string | null): number => {
  if (!publishedAt) {
    return 0.5;
  }
  const daysSince = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysSince / RECENCY_HALF_LIFE_DAYS);
};

// --- Public functions ---

const computeScore = (
  candidate: ScoringCandidate,
  context: VoteContext,
  weights: ScoringWeights = focusWeights,
): number => {
  const directVote = context.votes.get(candidate.articleId);

  let voteSignal: number;
  if (directVote !== undefined) {
    // Direct vote replaces propagated score — no double-counting
    voteSignal = directVote;
  } else if (candidate.embedding && context.votedArticles.length > 0) {
    // Top-k propagation: only the most similar voted articles contribute,
    // weighted by similarity so nearby votes matter more
    const scored: { sim: number; value: 1 | -1 }[] = [];
    for (const voted of context.votedArticles) {
      const sim = cosineSimilarity(candidate.embedding, voted.embedding);
      if (sim >= PROPAGATION_MIN_SIMILARITY) {
        scored.push({ sim, value: voted.value });
      }
    }
    if (scored.length > 0) {
      scored.sort((a, b) => b.sim - a.sim);
      const topK = scored.slice(0, PROPAGATION_TOP_K);
      let weightedSum = 0;
      let simSum = 0;
      for (const s of topK) {
        weightedSum += s.value * s.sim;
        simSum += s.sim;
      }
      voteSignal = weightedSum / simSum;
    } else {
      voteSignal = 0;
    }
  } else {
    voteSignal = 0;
  }

  const recency = recencyDecay(candidate.publishedAt);

  return weights.alpha * effectiveConfidence(candidate) + weights.beta * voteSignal + weights.gamma * recency;
};

const rankArticles = <T extends ScoringCandidate>(
  candidates: T[],
  context: VoteContext,
  weights: ScoringWeights = focusWeights,
): T[] => {
  const scored = candidates.map((c) => ({
    item: c,
    score: computeScore(c, context, weights),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
};

const mergeVoteContexts = (global: VoteContext, focusScoped: VoteContext): VoteContext => {
  // Focus-scoped votes take precedence over global for the same article
  const votes = new Map(global.votes);
  for (const [articleId, value] of focusScoped.votes) {
    votes.set(articleId, value);
  }

  // Concatenate voted articles — duplicates average out in propagation
  const votedArticles = [...global.votedArticles, ...focusScoped.votedArticles];

  return { votes, votedArticles };
};

const emptyVoteContext = (): VoteContext => ({
  votes: new Map(),
  votedArticles: [],
});

// --- User scoring weights ---

type UserScoringWeights = {
  global: ScoringWeights;
  focus: ScoringWeights;
  edition: ScoringWeights;
};

const defaultUserScoringWeights: UserScoringWeights = {
  global: globalWeights,
  focus: focusWeights,
  edition: editionWeights,
};

const parseUserScoringWeights = (json: string | null): UserScoringWeights => {
  if (!json) {
    return defaultUserScoringWeights;
  }
  try {
    const parsed = JSON.parse(json) as Partial<UserScoringWeights>;
    return {
      global: { ...globalWeights, ...parsed.global },
      focus: { ...focusWeights, ...parsed.focus },
      edition: { ...editionWeights, ...parsed.edition },
    };
  } catch {
    return defaultUserScoringWeights;
  }
};

export type { VoteContext, VotedArticle, ScoringCandidate, ScoringWeights, UserScoringWeights };
export {
  effectiveConfidence,
  computeScore,
  rankArticles,
  mergeVoteContexts,
  emptyVoteContext,
  globalWeights,
  focusWeights,
  editionWeights,
  defaultUserScoringWeights,
  parseUserScoringWeights,
  MAX_VOTE_CONTEXT_SIZE,
};
