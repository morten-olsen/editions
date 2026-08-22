import { prepareText } from '@editions/server/src/reconciler/reconciler.utils.ts';

import { EMBEDDING_MODELS } from '../eval.config.ts';
import { loadFeedFixture, loadLabelSet, listFixtures } from '../eval.db.ts';
import { createInferenceEngine } from '../eval.inference.ts';
import type { InferenceEngine } from '../eval.inference.ts';
import { createRunId, saveResults } from '../eval.results.ts';
import { formatTable } from '../eval.ts';
import type { EmbedBenchResult, FeedFixture, LabelSet } from '../eval.ts';

// --- Types ---

type Embeddings = Map<string, Float32Array>;

type PerFocusSimilarity = { focus: string; avgIntra: number; avgInter: number };

type SimilarityStats = {
  perFocus: PerFocusSimilarity[];
  totalIntra: number;
  totalInter: number;
  intraCount: number;
  interCount: number;
};

// --- Helpers ---

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] as number) * (b[i] as number);
  }
  return sum;
};

// Embed all labeled articles
const embedLabeledArticles = async (params: {
  engine: InferenceEngine;
  fixture: FeedFixture;
  labeledArticleIds: string[];
}): Promise<Embeddings> => {
  const { engine, fixture, labeledArticleIds } = params;
  const embeddings: Embeddings = new Map();

  for (const articleId of labeledArticleIds) {
    const article = fixture.articles.find((a) => a.id === articleId);
    if (!article) {
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

    embeddings.set(articleId, await engine.embed(text));
  }

  return embeddings;
};

// Build focus -> article sets
const buildFocusArticles = (params: { labelSet: LabelSet; embeddings: Embeddings }): Map<string, string[]> => {
  const { labelSet, embeddings } = params;
  const focusArticles = new Map<string, string[]>();

  for (const focus of labelSet.focuses) {
    const articles: string[] = [];
    for (const [articleId, labels] of Object.entries(labelSet.labels)) {
      if (labels[focus.name] && embeddings.has(articleId)) {
        articles.push(articleId);
      }
    }
    if (articles.length > 0) {
      focusArticles.set(focus.name, articles);
    }
  }

  return focusArticles;
};

const computeIntraSimilarity = (params: { focusIds: string[]; embeddings: Embeddings }): { sum: number; n: number } => {
  const { focusIds, embeddings } = params;
  let sum = 0;
  let n = 0;

  for (let i = 0; i < focusIds.length; i++) {
    for (let j = i + 1; j < focusIds.length; j++) {
      const a = embeddings.get(focusIds[i] as string);
      const b = embeddings.get(focusIds[j] as string);
      if (a && b) {
        sum += dotProduct(a, b);
        n++;
      }
    }
  }

  return { sum, n };
};

const computeInterSimilarity = (params: { focusIds: string[]; embeddings: Embeddings }): { sum: number; n: number } => {
  const { focusIds, embeddings } = params;
  let sum = 0;
  let n = 0;

  const focusSet = new Set(focusIds);
  const otherIds = [...embeddings.keys()].filter((id) => !focusSet.has(id));

  for (const fId of focusIds) {
    const a = embeddings.get(fId);
    if (!a) {
      continue;
    }
    for (const oId of otherIds) {
      const b = embeddings.get(oId);
      if (b) {
        sum += dotProduct(a, b);
        n++;
      }
    }
  }

  return { sum, n };
};

// Compute intra-focus and inter-focus similarity
const computeSimilarityStats = (params: {
  focusArticles: Map<string, string[]>;
  embeddings: Embeddings;
}): SimilarityStats => {
  const { focusArticles, embeddings } = params;

  const perFocus: PerFocusSimilarity[] = [];
  let totalIntra = 0;
  let totalInter = 0;
  let intraCount = 0;
  let interCount = 0;

  for (const [focusName, focusIds] of focusArticles) {
    const intra = computeIntraSimilarity({ focusIds, embeddings });
    const inter = computeInterSimilarity({ focusIds, embeddings });

    const avgIntra = intra.n > 0 ? intra.sum / intra.n : 0;
    const avgInter = inter.n > 0 ? inter.sum / inter.n : 0;

    perFocus.push({ focus: focusName, avgIntra, avgInter });
    totalIntra += intra.sum;
    totalInter += inter.sum;
    intraCount += intra.n;
    interCount += inter.n;
  }

  return { perFocus, totalIntra, totalInter, intraCount, interCount };
};

const printResult = (result: EmbedBenchResult): void => {
  const rows = result.perFocus.map((f) => [
    f.focus,
    f.avgIntra.toFixed(3),
    f.avgInter.toFixed(3),
    f.avgInter > 0 ? (f.avgIntra / f.avgInter).toFixed(2) : 'N/A',
  ]);
  console.log(formatTable(['Focus', 'Intra-sim', 'Inter-sim', 'Ratio'], rows));
  console.log(
    `\n  Overall: intra=${result.avgSameFocusSimilarity.toFixed(3)} inter=${result.avgCrossFocusSimilarity.toFixed(3)} ratio=${(result.avgSameFocusSimilarity / result.avgCrossFocusSimilarity).toFixed(2)}`,
  );
  console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
};

const benchModel = async (params: {
  modelName: string;
  fixture: FeedFixture;
  labelSet: LabelSet;
  labeledArticleIds: string[];
}): Promise<EmbedBenchResult> => {
  const { modelName, fixture, labelSet, labeledArticleIds } = params;

  const engine = createInferenceEngine({ embeddingModel: modelName });
  const start = performance.now();

  const embeddings = await embedLabeledArticles({ engine, fixture, labeledArticleIds });
  const focusArticles = buildFocusArticles({ labelSet, embeddings });
  const stats = computeSimilarityStats({ focusArticles, embeddings });

  const durationMs = performance.now() - start;
  const avgSame = stats.intraCount > 0 ? stats.totalIntra / stats.intraCount : 0;
  const avgCross = stats.interCount > 0 ? stats.totalInter / stats.interCount : 0;

  const result: EmbedBenchResult = {
    model: modelName,
    avgSameFocusSimilarity: avgSame,
    avgCrossFocusSimilarity: avgCross,
    separationRatio: avgCross > 0 ? avgSame / avgCross : 0,
    perFocus: stats.perFocus,
    durationMs,
  };

  printResult(result);

  engine.dispose();

  return result;
};

const printSummary = (results: EmbedBenchResult[]): void => {
  if (results.length <= 1) {
    return;
  }
  console.log('\n\n=== SUMMARY ===\n');
  const rows = results.map((r) => [
    r.model.split('/')[1] ?? r.model,
    r.avgSameFocusSimilarity.toFixed(3),
    r.avgCrossFocusSimilarity.toFixed(3),
    r.separationRatio.toFixed(2),
    `${(r.durationMs / 1000).toFixed(1)}s`,
  ]);
  console.log(formatTable(['Model', 'Intra', 'Inter', 'Ratio', 'Time'], rows));
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

  const results: EmbedBenchResult[] = [];
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
      console.log(`--- ${modelName} ---\n`);
      results.push(await benchModel({ modelName, fixture, labelSet, labeledArticleIds }));
    }
  }

  printSummary(results);

  await saveResults({
    runId,
    kind: 'embed',
    results,
    models: EMBEDDING_MODELS,
    fixtures: fixtureNames,
  });
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
