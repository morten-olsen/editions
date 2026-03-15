import { prepareText } from '@editions/server/src/reconciler/reconciler.utils.ts';

import { EMBEDDING_MODELS, CLASSIFIER_MODEL, STRATEGIES, NLI_MODELS } from '../eval.config.ts';
import { createEvalDb, seedFromFixtures, loadFeedFixture, loadLabelSet, listFixtures } from '../eval.db.ts';
import { createInferenceEngine } from '../eval.inference.ts';
import { createRunId, saveResults } from '../eval.results.ts';
import { computePrecisionRecallF1, findOptimalThreshold, formatTable, pct } from '../eval.ts';
import type { ClassifyBenchResult, PerFocusMetrics } from '../eval.ts';

// --- Main ---

const run = async (): Promise<void> => {
  const fixtures = await listFixtures();
  if (fixtures.labels.length === 0) {
    console.log('No label sets found. Run `pnpm label <fixture.json>` first.');
    process.exit(1);
  }

  const runId = process.env.EVAL_RUN_ID ?? createRunId();
  console.log(`Run ID: ${runId}`);

  const results: ClassifyBenchResult[] = [];
  const fixtureNames: string[] = [];

  for (const labelFile of fixtures.labels) {
    const labelSet = await loadLabelSet(labelFile);
    const fixture = await loadFeedFixture(labelSet.fixture);
    fixtureNames.push(labelFile);

    const labeledArticleIds = Object.keys(labelSet.labels);
    if (labeledArticleIds.length === 0) {
      console.log(`Skipping ${labelFile}: no labels`);
      continue;
    }

    console.log(
      `\n=== ${labelFile} (${labeledArticleIds.length} labeled articles, ${labelSet.focuses.length} focuses) ===\n`,
    );

    for (const embeddingModel of EMBEDDING_MODELS) {
      for (const strategy of STRATEGIES) {
        if (strategy === 'nli' && !NLI_MODELS.has(embeddingModel)) {
          continue;
        }
        console.log(`\n--- ${embeddingModel} / ${strategy} ---\n`);

        const engine = createInferenceEngine({
          embeddingModel,
          classifierModel: strategy === 'nli' ? CLASSIFIER_MODEL : undefined,
        });

        const db = await createEvalDb();
        await seedFromFixtures(db, fixture, labelSet);

        const start = performance.now();

        // Compute scores for each article x focus
        const scoresByFocus = new Map<string, Map<string, number>>();
        for (const focusName of labelSet.focuses.map((f) => f.name)) {
          scoresByFocus.set(focusName, new Map());
        }

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

          if (strategy === 'similarity') {
            const articleEmbedding = await engine.embed(text);
            for (const focus of labelSet.focuses) {
              const focusLabel = focus.description ? `${focus.name}: ${focus.description}` : focus.name;
              const focusEmbedding = await engine.embed(focusLabel);

              let dot = 0;
              for (let i = 0; i < articleEmbedding.length; i++) {
                dot += (articleEmbedding[i] as number) * (focusEmbedding[i] as number);
              }
              scoresByFocus.get(focus.name)?.set(articleId, dot);
            }
          } else {
            const labels = labelSet.focuses.map((f) => (f.description ? `${f.name}: ${f.description}` : f.name));
            const nliResults = await engine.classify(text, labels);
            for (const result of nliResults) {
              const focusName = labelSet.focuses.find(
                (f) => result.label === (f.description ? `${f.name}: ${f.description}` : f.name),
              )?.name;
              if (focusName) {
                scoresByFocus.get(focusName)?.set(articleId, result.score);
              }
            }
          }
        }

        const durationMs = performance.now() - start;

        // Evaluate at optimal threshold
        const perFocus: PerFocusMetrics[] = [];
        for (const focus of labelSet.focuses) {
          const predictions = scoresByFocus.get(focus.name) ?? new Map();
          const groundTruth = new Map<string, boolean>();
          for (const articleId of labeledArticleIds) {
            const label = labelSet.labels[articleId]?.[focus.name];
            if (label !== undefined) {
              groundTruth.set(articleId, label);
            }
          }

          const { threshold: optThreshold } = findOptimalThreshold({ predictions, groundTruth });
          const metrics = computePrecisionRecallF1({
            predictions,
            groundTruth,
            threshold: optThreshold,
          });

          perFocus.push({
            focus: focus.name,
            precision: metrics.precision,
            recall: metrics.recall,
            f1: metrics.f1,
            truePositives: metrics.tp,
            falsePositives: metrics.fp,
            falseNegatives: metrics.fn,
            threshold: optThreshold,
          });
        }

        const macroP = perFocus.reduce((s, f) => s + f.precision, 0) / perFocus.length;
        const macroR = perFocus.reduce((s, f) => s + f.recall, 0) / perFocus.length;
        const macroF1 = macroP + macroR > 0 ? (2 * macroP * macroR) / (macroP + macroR) : 0;

        const result: ClassifyBenchResult = {
          model: embeddingModel,
          strategy,
          threshold: 0.5,
          perFocus,
          macroPrecision: macroP,
          macroRecall: macroR,
          macroF1,
          articlesEvaluated: labeledArticleIds.length,
          durationMs,
        };

        results.push(result);

        // Print
        const rows = perFocus.map((f) => [
          f.focus,
          pct(f.precision),
          pct(f.recall),
          pct(f.f1),
          f.threshold.toFixed(2),
          `${f.truePositives}/${f.truePositives + f.falsePositives}`,
          `${f.truePositives}/${f.truePositives + f.falseNegatives}`,
        ]);
        console.log(formatTable(['Focus', 'Prec', 'Recall', 'F1', 'Thresh', 'Pred+', 'Actual+'], rows));
        console.log(`\n  Macro: P=${pct(macroP)} R=${pct(macroR)} F1=${pct(macroF1)}`);
        console.log(
          `  Duration: ${(durationMs / 1000).toFixed(1)}s (${(durationMs / labeledArticleIds.length).toFixed(0)}ms/article)`,
        );

        engine.dispose();
        await db.destroy();
      }
    }
  }

  // Summary
  if (results.length > 1) {
    console.log('\n\n=== SUMMARY ===\n');
    const summaryRows = results.map((r) => [
      r.model.split('/')[1] ?? r.model,
      r.strategy,
      pct(r.macroPrecision),
      pct(r.macroRecall),
      pct(r.macroF1),
      `${(r.durationMs / 1000).toFixed(1)}s`,
    ]);
    console.log(formatTable(['Model', 'Strategy', 'Prec', 'Recall', 'F1', 'Time'], summaryRows));
  }

  // Save
  await saveResults({
    runId,
    kind: 'classify',
    results,
    models: EMBEDDING_MODELS,
    fixtures: fixtureNames,
  });
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
