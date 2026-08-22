import { scoreAndRank, emptyVoteContext, defaultUserScoringWeights } from '@editions/server/src/ranking/ranking.ts';
import type {
  RankingCandidate,
  VoteContext,
  VotedArticle,
  ScoringWeights,
} from '@editions/server/src/ranking/ranking.ts';
import { prepareText } from '@editions/server/src/reconciler/reconciler.utils.ts';

import { EMBEDDING_MODELS } from '../eval.config.ts';
import { loadFeedFixture, loadLabelSet, listFixtures } from '../eval.db.ts';
import { createInferenceEngine } from '../eval.inference.ts';
import type { InferenceEngine } from '../eval.inference.ts';
import { createRunId, saveResults } from '../eval.results.ts';
import { computeNDCG, computeMRR, formatTable, pct } from '../eval.ts';
import type { FeedFixture, LabelSet, RankBenchResult } from '../eval.ts';

// --- Config ---

const WEIGHT_CONFIGS: { name: string; weights: ScoringWeights }[] = [
  { name: 'default-focus', weights: defaultUserScoringWeights.focus },
  { name: 'confidence-only', weights: { alpha: 1, beta: 0, gamma: 0 } },
  { name: 'vote-heavy', weights: { alpha: 0.2, beta: 0.7, gamma: 0.1 } },
  { name: 'balanced', weights: { alpha: 0.33, beta: 0.34, gamma: 0.33 } },
];

// --- Types ---

type RankBenchResultWithModel = RankBenchResult & { model: string };

type Embeddings = Map<string, Float32Array>;

type ArticleMeta = Map<string, { publishedAt: string | null }>;

// --- Helpers ---

// Embed all articles
const embedArticles = async (params: {
  engine: InferenceEngine;
  fixture: FeedFixture;
  labelSet: LabelSet;
}): Promise<{ articleEmbeddings: Embeddings; articleMeta: ArticleMeta }> => {
  const { engine, fixture, labelSet } = params;
  const articleEmbeddings: Embeddings = new Map();
  const articleMeta: ArticleMeta = new Map();

  for (const article of fixture.articles) {
    if (!labelSet.labels[article.id]) {
      continue;
    }

    const text = prepareText({
      title: article.title,
      content: article.content,
      summary: article.summary,
      sourceType: 'rss',
    });
    if (!text) {
      continue;
    }

    articleEmbeddings.set(article.id, await engine.embed(text));
    articleMeta.set(article.id, { publishedAt: article.publishedAt });
  }

  return { articleEmbeddings, articleMeta };
};

// Compute similarity scores for each focus
const computeFocusSimilarities = async (params: {
  engine: InferenceEngine;
  labelSet: LabelSet;
  articleEmbeddings: Embeddings;
}): Promise<Map<string, Map<string, number>>> => {
  const { engine, labelSet, articleEmbeddings } = params;
  const focusSimilarities = new Map<string, Map<string, number>>();

  for (const focus of labelSet.focuses) {
    const focusLabel = focus.description ? `${focus.name}: ${focus.description}` : focus.name;
    const focusEmbedding = await engine.embed(focusLabel);
    const similarities = new Map<string, number>();

    for (const [articleId, embedding] of articleEmbeddings) {
      let dot = 0;
      for (let i = 0; i < embedding.length; i++) {
        dot += (embedding[i] as number) * (focusEmbedding[i] as number);
      }
      similarities.set(articleId, dot);
    }
    focusSimilarities.set(focus.name, similarities);
  }

  return focusSimilarities;
};

// No votes baseline
const evaluateNoVotes = (params: {
  modelName: string;
  focusName: string;
  candidates: RankingCandidate[];
  relevantIds: Set<string>;
}): RankBenchResultWithModel[] => {
  const { modelName, focusName, candidates, relevantIds } = params;
  const results: RankBenchResultWithModel[] = [];

  for (const config of WEIGHT_CONFIGS) {
    const ranked = scoreAndRank({
      candidates: [...candidates],
      voteContext: emptyVoteContext(),
      weights: config.weights,
    });
    const rankedIds = ranked.map((r) => r.item.articleId);
    const k = Math.min(relevantIds.size, 10);

    results.push({
      model: modelName,
      scenario: `${focusName}/no-votes/${config.name}`,
      ndcg: computeNDCG(rankedIds, relevantIds, k),
      mrr: computeMRR(rankedIds, relevantIds),
      topKAccuracy: rankedIds.slice(0, k).filter((id) => relevantIds.has(id)).length / k,
      weights: config.weights,
    });
  }

  return results;
};

const buildVoteContext = (params: {
  relevantArray: string[];
  irrelevantArray: string[];
  articleEmbeddings: Embeddings;
}): VoteContext => {
  const { relevantArray, irrelevantArray, articleEmbeddings } = params;
  const votedArticles: VotedArticle[] = [];
  const votes = new Map<string, 1 | -1>();

  for (const id of relevantArray.slice(0, 2)) {
    const emb = articleEmbeddings.get(id);
    if (emb) {
      votedArticles.push({ embedding: emb, value: 1 });
      votes.set(id, 1);
    }
  }
  for (const id of irrelevantArray.slice(0, 1)) {
    const emb = articleEmbeddings.get(id);
    if (emb) {
      votedArticles.push({ embedding: emb, value: -1 });
      votes.set(id, -1);
    }
  }

  return { votes, votedArticles };
};

// With votes
const evaluateWithVotes = (params: {
  modelName: string;
  focusName: string;
  candidates: RankingCandidate[];
  relevantIds: Set<string>;
  articleEmbeddings: Embeddings;
}): RankBenchResultWithModel[] => {
  const { modelName, focusName, candidates, relevantIds, articleEmbeddings } = params;

  const relevantArray = [...relevantIds];
  const irrelevantArray = [...articleEmbeddings.keys()].filter((id) => !relevantIds.has(id));

  if (relevantArray.length < 2 || irrelevantArray.length < 1) {
    return [];
  }

  const voteContext = buildVoteContext({ relevantArray, irrelevantArray, articleEmbeddings });
  const unvotedCandidates = candidates.filter((c) => !voteContext.votes.has(c.articleId));
  const unvotedRelevant = new Set([...relevantIds].filter((id) => !voteContext.votes.has(id)));

  const results: RankBenchResultWithModel[] = [];
  for (const config of WEIGHT_CONFIGS) {
    const ranked = scoreAndRank({
      candidates: [...unvotedCandidates],
      voteContext,
      weights: config.weights,
    });
    const rankedIds = ranked.map((r) => r.item.articleId);
    const k = Math.min(unvotedRelevant.size, 10);

    if (k === 0) {
      continue;
    }

    results.push({
      model: modelName,
      scenario: `${focusName}/2up-1down/${config.name}`,
      ndcg: computeNDCG(rankedIds, unvotedRelevant, k),
      mrr: computeMRR(rankedIds, unvotedRelevant),
      topKAccuracy: rankedIds.slice(0, k).filter((id) => unvotedRelevant.has(id)).length / k,
      weights: config.weights,
    });
  }

  return results;
};

// Evaluate ranking per focus
const evaluateFocus = (params: {
  modelName: string;
  focusName: string;
  similarities: Map<string, number>;
  labelSet: LabelSet;
  labeledArticleIds: string[];
  articleEmbeddings: Embeddings;
  articleMeta: ArticleMeta;
}): RankBenchResultWithModel[] => {
  const { modelName, focusName, similarities, labelSet, labeledArticleIds, articleEmbeddings, articleMeta } = params;

  const relevantIds = new Set<string>();
  for (const [articleId, labels] of Object.entries(labelSet.labels)) {
    if (labels[focusName]) {
      relevantIds.add(articleId);
    }
  }

  if (relevantIds.size === 0 || relevantIds.size === labeledArticleIds.length) {
    return [];
  }

  const candidates: RankingCandidate[] = [...articleEmbeddings.keys()].map((articleId) => ({
    articleId,
    similarity: similarities.get(articleId) ?? null,
    nli: null,
    publishedAt: articleMeta.get(articleId)?.publishedAt ?? null,
    embedding: articleEmbeddings.get(articleId) ?? null,
  }));

  return [
    ...evaluateNoVotes({ modelName, focusName, candidates, relevantIds }),
    ...evaluateWithVotes({ modelName, focusName, candidates, relevantIds, articleEmbeddings }),
  ];
};

const benchModel = async (params: {
  modelName: string;
  fixture: FeedFixture;
  labelSet: LabelSet;
  labeledArticleIds: string[];
}): Promise<RankBenchResultWithModel[]> => {
  const { modelName, fixture, labelSet, labeledArticleIds } = params;

  console.log(`\n--- Model: ${modelName} ---`);

  const engine = createInferenceEngine({ embeddingModel: modelName });

  console.log('Embedding articles...');
  const { articleEmbeddings, articleMeta } = await embedArticles({ engine, fixture, labelSet });

  console.log('Computing focus similarities...');
  const focusSimilarities = await computeFocusSimilarities({ engine, labelSet, articleEmbeddings });

  const results: RankBenchResultWithModel[] = [];
  for (const focus of labelSet.focuses) {
    const similarities = focusSimilarities.get(focus.name);
    if (!similarities) {
      continue;
    }

    results.push(
      ...evaluateFocus({
        modelName,
        focusName: focus.name,
        similarities,
        labelSet,
        labeledArticleIds,
        articleEmbeddings,
        articleMeta,
      }),
    );
  }

  engine.dispose();

  return results;
};

const printResults = (results: RankBenchResultWithModel[]): void => {
  console.log('\n\n=== RANKING RESULTS ===\n');
  const rows = results.map((r) => [
    r.model.split('/')[1] ?? r.model,
    r.scenario,
    r.ndcg.toFixed(3),
    r.mrr.toFixed(3),
    pct(r.topKAccuracy),
  ]);
  console.log(formatTable(['Model', 'Scenario', 'NDCG', 'MRR', 'Top-K'], rows));
};

const printVoteImpact = (results: RankBenchResultWithModel[]): void => {
  console.log('\n=== VOTE IMPACT ===\n');
  const noVoteResults = results.filter((r) => r.scenario.includes('/no-votes/'));
  const voteResults = results.filter((r) => r.scenario.includes('/2up-1down/'));

  for (const vr of voteResults) {
    const parts = vr.scenario.split('/');
    const focus = parts[0];
    const weights = parts[2];
    const baseline = noVoteResults.find((r) => r.model === vr.model && r.scenario === `${focus}/no-votes/${weights}`);
    if (baseline) {
      const delta = vr.ndcg - baseline.ndcg;
      const sign = (n: number): string => (n >= 0 ? '+' : '') + n.toFixed(3);
      console.log(`  ${(vr.model.split('/')[1] ?? vr.model).padEnd(20)} ${vr.scenario.padEnd(45)} NDCG ${sign(delta)}`);
    }
  }
};

// --- Main ---

const run = async (): Promise<void> => {
  const fixtures = await listFixtures();
  if (fixtures.labels.length === 0) {
    console.log('No label sets found. Run `pnpm label <fixture.json>` first.');
    process.exit(1);
  }

  const runId = process.env.EVAL_RUN_ID ?? createRunId();
  console.log(`Run ID: ${runId}`);

  const results: RankBenchResultWithModel[] = [];
  const fixtureNames: string[] = [];

  for (const labelFile of fixtures.labels) {
    const labelSet = await loadLabelSet(labelFile);
    const fixture = await loadFeedFixture(labelSet.fixture);
    fixtureNames.push(labelFile);

    const labeledArticleIds = Object.keys(labelSet.labels);
    if (labeledArticleIds.length === 0) {
      continue;
    }

    console.log(`\n=== ${labelFile} (${labeledArticleIds.length} labeled articles) ===\n`);

    for (const modelName of EMBEDDING_MODELS) {
      results.push(...(await benchModel({ modelName, fixture, labelSet, labeledArticleIds })));
    }
  }

  printResults(results);
  printVoteImpact(results);

  await saveResults({
    runId,
    kind: 'rank',
    results,
    models: EMBEDDING_MODELS,
    fixtures: fixtureNames,
  });
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
