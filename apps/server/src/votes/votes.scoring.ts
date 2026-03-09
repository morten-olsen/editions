// --- Scoring weights ---

const ALPHA = 0.5; // confidence weight
const BETA = 0.4; // vote propagation weight
const GAMMA = 0.1; // recency decay weight

const RECENCY_HALF_LIFE_DAYS = 3;
const MAX_VOTE_CONTEXT_SIZE = 200;

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
  confidence: number;
  publishedAt: string | null;
  embedding: Float32Array | null;
};

// --- Private helpers ---

const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
  }
  // Embeddings from all-MiniLM-L6-v2 are L2-normalized, so dot product = cosine similarity
  return dot;
};

const recencyDecay = (publishedAt: string | null): number => {
  if (!publishedAt) return 0.5;
  const daysSince =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, daysSince / RECENCY_HALF_LIFE_DAYS);
};

// --- Public functions ---

const computeScore = (candidate: ScoringCandidate, context: VoteContext): number => {
  const directVote = context.votes.get(candidate.articleId);

  let voteSignal: number;
  if (directVote !== undefined) {
    // Direct vote replaces propagated score — no double-counting
    voteSignal = directVote;
  } else if (candidate.embedding && context.votedArticles.length > 0) {
    // Propagate from similar voted articles
    let sum = 0;
    for (const voted of context.votedArticles) {
      sum += voted.value * cosineSimilarity(candidate.embedding, voted.embedding);
    }
    voteSignal = sum / context.votedArticles.length;
  } else {
    voteSignal = 0;
  }

  const recency = recencyDecay(candidate.publishedAt);

  return ALPHA * candidate.confidence + BETA * voteSignal + GAMMA * recency;
};

const rankArticles = <T extends ScoringCandidate>(
  candidates: T[],
  context: VoteContext,
): T[] => {
  const scored = candidates.map((c) => ({
    item: c,
    score: computeScore(c, context),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
};

const mergeVoteContexts = (
  global: VoteContext,
  focusScoped: VoteContext,
): VoteContext => {
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

export type { VoteContext, VotedArticle, ScoringCandidate };
export {
  computeScore,
  rankArticles,
  mergeVoteContexts,
  emptyVoteContext,
  MAX_VOTE_CONTEXT_SIZE,
};
