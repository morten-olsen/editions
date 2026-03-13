import { prepareText } from '@editions/server/src/reconciler/reconciler.utils.ts';

import { EMBEDDING_MODELS } from '../eval.config.ts';
import { loadFeedFixture, loadLabelSet, listFixtures } from '../eval.db.ts';
import { createInferenceEngine } from '../eval.inference.ts';
import { createRunId, saveResults } from '../eval.results.ts';
import { formatTable } from '../eval.ts';
import type { EmbedBenchResult } from '../eval.ts';

// --- Helpers ---

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] as number) * (b[i] as number);
  }
  return sum;
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

      const engine = createInferenceEngine({ embeddingModel: modelName });
      const start = performance.now();

      // Embed all labeled articles
      const embeddings = new Map<string, Float32Array>();
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

      // Build focus -> article sets
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

      // Compute intra-focus and inter-focus similarity
      const perFocus: { focus: string; avgIntra: number; avgInter: number }[] = [];
      let totalIntra = 0;
      let totalInter = 0;
      let intraCount = 0;
      let interCount = 0;

      for (const [focusName, focusIds] of focusArticles) {
        let intraSum = 0;
        let intraN = 0;

        for (let i = 0; i < focusIds.length; i++) {
          for (let j = i + 1; j < focusIds.length; j++) {
            const a = embeddings.get(focusIds[i] as string);
            const b = embeddings.get(focusIds[j] as string);
            if (a && b) {
              intraSum += dotProduct(a, b);
              intraN++;
            }
          }
        }

        let interSum = 0;
        let interN = 0;
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
              interSum += dotProduct(a, b);
              interN++;
            }
          }
        }

        const avgIntra = intraN > 0 ? intraSum / intraN : 0;
        const avgInter = interN > 0 ? interSum / interN : 0;

        perFocus.push({ focus: focusName, avgIntra, avgInter });
        totalIntra += intraSum;
        totalInter += interSum;
        intraCount += intraN;
        interCount += interN;
      }

      const durationMs = performance.now() - start;
      const avgSame = intraCount > 0 ? totalIntra / intraCount : 0;
      const avgCross = interCount > 0 ? totalInter / interCount : 0;

      const result: EmbedBenchResult = {
        model: modelName,
        avgSameFocusSimilarity: avgSame,
        avgCrossFocusSimilarity: avgCross,
        separationRatio: avgCross > 0 ? avgSame / avgCross : 0,
        perFocus,
        durationMs,
      };

      results.push(result);

      // Print
      const rows = perFocus.map((f) => [
        f.focus,
        f.avgIntra.toFixed(3),
        f.avgInter.toFixed(3),
        f.avgInter > 0 ? (f.avgIntra / f.avgInter).toFixed(2) : 'N/A',
      ]);
      console.log(formatTable(['Focus', 'Intra-sim', 'Inter-sim', 'Ratio'], rows));
      console.log(`\n  Overall: intra=${avgSame.toFixed(3)} inter=${avgCross.toFixed(3)} ratio=${(avgSame / avgCross).toFixed(2)}`);
      console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);

      engine.dispose();
    }
  }

  // Summary
  if (results.length > 1) {
    console.log('\n\n=== SUMMARY ===\n');
    const rows = results.map((r) => [
      r.model.split('/')[1] ?? r.model,
      r.avgSameFocusSimilarity.toFixed(3),
      r.avgCrossFocusSimilarity.toFixed(3),
      r.separationRatio.toFixed(2),
      `${(r.durationMs / 1000).toFixed(1)}s`,
    ]);
    console.log(formatTable(['Model', 'Intra', 'Inter', 'Ratio', 'Time'], rows));
  }

  // Save
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
