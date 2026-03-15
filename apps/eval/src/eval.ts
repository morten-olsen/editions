// --- Fixture types ---

type FixtureArticle = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  url: string | null;
  author: string | null;
  publishedAt: string | null;
};

type FeedFixture = {
  source: {
    name: string;
    url: string;
    fetchedAt: string;
  };
  articles: FixtureArticle[];
};

type LabelSet = {
  fixture: string;
  focuses: { name: string; description: string | null }[];
  labels: Record<string, Record<string, boolean>>;
};

// --- Metric types ---

type ClassificationResult = {
  articleId: string;
  focusName: string;
  score: number;
  method: 'similarity' | 'nli';
};

type PerFocusMetrics = {
  focus: string;
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  threshold: number;
};

type ClassifyBenchResult = {
  model: string;
  strategy: string;
  threshold: number;
  perFocus: PerFocusMetrics[];
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  articlesEvaluated: number;
  durationMs: number;
};

type EmbedBenchResult = {
  model: string;
  avgSameFocusSimilarity: number;
  avgCrossFocusSimilarity: number;
  separationRatio: number;
  perFocus: { focus: string; avgIntra: number; avgInter: number }[];
  durationMs: number;
};

type VoteScenario = {
  name: string;
  votes: { articleId: string; value: 1 | -1 }[];
  expectedTopArticleIds: string[];
};

type RankBenchResult = {
  scenario: string;
  ndcg: number;
  mrr: number;
  topKAccuracy: number;
  weights: { alpha: number; beta: number; gamma: number };
};

// --- Metric helpers ---

const computePrecisionRecallF1 = (params: {
  predictions: Map<string, number>;
  groundTruth: Map<string, boolean>;
  threshold: number;
}): { precision: number; recall: number; f1: number; tp: number; fp: number; fn: number } => {
  const { predictions, groundTruth, threshold } = params;
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const [articleId, isRelevant] of groundTruth) {
    const score = predictions.get(articleId) ?? 0;
    const predicted = score >= threshold;

    if (predicted && isRelevant) {
      tp++;
    } else if (predicted && !isRelevant) {
      fp++;
    } else if (!predicted && isRelevant) {
      fn++;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1, tp, fp, fn };
};

const findOptimalThreshold = (params: {
  predictions: Map<string, number>;
  groundTruth: Map<string, boolean>;
  steps?: number;
}): { threshold: number; f1: number } => {
  const { predictions, groundTruth, steps = 100 } = params;
  let bestThreshold = 0.5;
  let bestF1 = 0;

  for (let i = 0; i <= steps; i++) {
    const threshold = i / steps;
    const { f1 } = computePrecisionRecallF1({ predictions, groundTruth, threshold });
    if (f1 > bestF1) {
      bestF1 = f1;
      bestThreshold = threshold;
    }
  }

  return { threshold: bestThreshold, f1: bestF1 };
};

const computeNDCG = (rankedIds: string[], relevantIds: Set<string>, k?: number): number => {
  const n = k ?? rankedIds.length;
  let dcg = 0;
  let idcg = 0;

  for (let i = 0; i < n && i < rankedIds.length; i++) {
    const rel = relevantIds.has(rankedIds[i] as string) ? 1 : 0;
    dcg += rel / Math.log2(i + 2);
  }

  const idealCount = Math.min(relevantIds.size, n);
  for (let i = 0; i < idealCount; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : 0;
};

const computeMRR = (rankedIds: string[], relevantIds: Set<string>): number => {
  for (let i = 0; i < rankedIds.length; i++) {
    if (relevantIds.has(rankedIds[i] as string)) {
      return 1 / (i + 1);
    }
  }
  return 0;
};

// --- Formatting ---

const formatTable = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));

  const separator = widths.map((w) => '-'.repeat(w + 2)).join('+');
  const formatRow = (cells: string[]): string => cells.map((c, i) => ` ${c.padEnd(widths[i] as number)} `).join('|');

  return [formatRow(headers), separator, ...rows.map(formatRow)].join('\n');
};

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

// --- Exports ---

export type {
  FixtureArticle,
  FeedFixture,
  LabelSet,
  ClassificationResult,
  PerFocusMetrics,
  ClassifyBenchResult,
  EmbedBenchResult,
  VoteScenario,
  RankBenchResult,
};
export { computePrecisionRecallF1, findOptimalThreshold, computeNDCG, computeMRR, formatTable, pct };
