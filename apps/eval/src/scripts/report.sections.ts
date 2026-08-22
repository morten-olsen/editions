import { pct } from '../eval.ts';
import type { ClassifyBenchResult, EmbedBenchResult, RankBenchResult } from '../eval.ts';
import type { BenchRun } from '../eval.results.ts';

import { barChart, shortModel, avg } from './report.charts.ts';

// --- Aggregation helpers ---

const groupByModelFixture = (results: ClassifyBenchResult[]): Map<string, ClassifyBenchResult[]> => {
  const groups = new Map<string, ClassifyBenchResult[]>();
  for (const r of results) {
    const key = `${r.model}|${r.strategy}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  return groups;
};

// --- Section: Classification ---

type AggRow = {
  model: string;
  strategy: string;
  avgP: number;
  avgR: number;
  avgF1: number;
  totalTime: number;
  totalArticles: number;
};

// Aggregate: average F1 across all fixtures per model+strategy
const buildAggRows = (results: ClassifyBenchResult[]): AggRow[] => {
  const grouped = groupByModelFixture(results);
  const aggRows: AggRow[] = [];

  for (const [key, runs] of grouped) {
    const [model, strategy] = key.split('|') as [string, string];
    aggRows.push({
      model: shortModel(model),
      strategy,
      avgP: avg(runs.map((r) => r.macroPrecision)),
      avgR: avg(runs.map((r) => r.macroRecall)),
      avgF1: avg(runs.map((r) => r.macroF1)),
      totalTime: runs.reduce((s, r) => s + r.durationMs, 0),
      totalArticles: runs.reduce((s, r) => s + r.articlesEvaluated, 0),
    });
  }
  aggRows.sort((a, b) => b.avgF1 - a.avgF1);

  return aggRows;
};

// Identify fixtures by number of articles (article count as proxy for fixture identity)
const buildPerFixtureF1 = (params: {
  results: ClassifyBenchResult[];
  models: string[];
  seenArticleCounts: number[];
}): { fixtureLabels: string[]; fixtureF1s: Map<string, number[]> } => {
  const { results, models, seenArticleCounts } = params;

  const fixtureLabels: string[] = [];
  const fixtureF1s = new Map<string, number[]>();
  for (const model of models) {
    fixtureF1s.set(model, []);
  }

  const fixtureNames = ['ars-technica', 'nyt-world', 'theverge']; // sorted by article count
  for (let fi = 0; fi < seenArticleCounts.length; fi++) {
    const count = seenArticleCounts[fi] as number;
    fixtureLabels.push(fixtureNames[fi] ?? `${count} articles`);
    for (const model of models) {
      const r = results.find(
        (r) => shortModel(r.model) === model && r.strategy === 'similarity' && r.articlesEvaluated === count,
      );
      fixtureF1s.get(model)?.push(r?.macroF1 ?? 0);
    }
  }

  return { fixtureLabels, fixtureF1s };
};

const classifyTableRows = (aggRows: AggRow[]): string =>
  aggRows
    .map((r) => {
      const best = r.avgF1 === Math.max(...aggRows.filter((a) => a.strategy === r.strategy).map((a) => a.avgF1));
      return `<tr>
      <td>${r.model}</td>
      <td>${r.strategy}</td>
      <td>${pct(r.avgP)}</td>
      <td>${pct(r.avgR)}</td>
      <td>${best ? '<strong>' : ''}${pct(r.avgF1)}${best ? '</strong>' : ''}</td>
      <td>${r.totalArticles}</td>
      <td>${(r.totalTime / 1000).toFixed(1)}s</td>
    </tr>`;
    })
    .join('');

const classifySection = (results: ClassifyBenchResult[]): string => {
  if (results.length === 0) {
    return '';
  }

  const aggRows = buildAggRows(results);
  const models = [...new Set(aggRows.map((r) => r.model))];
  const strategies = [...new Set(aggRows.map((r) => r.strategy))];

  // Chart 1: Average F1 across all fixtures
  const f1Chart = barChart({
    title: 'Avg Macro F1 Across All Fixtures',
    labels: models,
    series: strategies.map((strategy) => ({
      name: strategy,
      values: models.map((model) => aggRows.find((r) => r.model === model && r.strategy === strategy)?.avgF1 ?? 0),
    })),
    maxValue: 1,
    valueFormat: pct,
  });

  // Chart 2: Per-fixture F1 for similarity strategy only
  const seenArticleCounts = [...new Set(results.map((r) => r.articlesEvaluated))].sort();
  const { fixtureLabels, fixtureF1s } = buildPerFixtureF1({ results, models, seenArticleCounts });

  const perFixtureChart = barChart({
    title: 'Similarity F1 by Fixture',
    labels: fixtureLabels,
    series: models.map((model) => ({
      name: model,
      values: fixtureF1s.get(model) ?? [],
    })),
    maxValue: 1,
    valueFormat: pct,
  });

  return `
    <section>
      <h2>Classification</h2>
      <p class="note">Averaged across ${seenArticleCounts.length} fixtures (${seenArticleCounts.join(' + ')} = ${seenArticleCounts.reduce((a, b) => a + b, 0)} articles). Thresholds optimized per focus.</p>
      <div class="charts-row">${f1Chart}${perFixtureChart}</div>
      <table>
        <thead><tr><th>Model</th><th>Strategy</th><th>Avg Prec</th><th>Avg Recall</th><th>Avg F1</th><th>Articles</th><th>Total Time</th></tr></thead>
        <tbody>${classifyTableRows(aggRows)}</tbody>
      </table>
    </section>`;
};

// --- Section: Embeddings ---

const avgFocusRatio = (modelResults: EmbedBenchResult[], focus: string): number => {
  const ratios = modelResults
    .map((r) => r.perFocus.find((f) => f.focus === focus))
    .filter((f): f is NonNullable<typeof f> => f != null && f.avgInter > 0)
    .map((f) => f.avgIntra / f.avgInter);
  return avg(ratios);
};

const embedSection = (results: EmbedBenchResult[]): string => {
  if (results.length === 0) {
    return '';
  }

  // Group by model, average across fixtures
  const byModel = new Map<string, EmbedBenchResult[]>();
  for (const r of results) {
    const key = shortModel(r.model);
    const arr = byModel.get(key) ?? [];
    arr.push(r);
    byModel.set(key, arr);
  }

  const models = [...byModel.keys()];
  const avgIntra = models.map((m) => avg(byModel.get(m)?.map((r) => r.avgSameFocusSimilarity) ?? []));
  const avgInter = models.map((m) => avg(byModel.get(m)?.map((r) => r.avgCrossFocusSimilarity) ?? []));
  const avgRatio = models.map((m) => avg(byModel.get(m)?.map((r) => r.separationRatio) ?? []));

  const simChart = barChart({
    title: 'Avg Intra vs Inter-Focus Similarity',
    labels: models,
    series: [
      { name: 'Intra-focus', values: avgIntra },
      { name: 'Inter-focus', values: avgInter },
    ],
    maxValue: Math.max(...avgIntra, ...avgInter) * 1.2,
    valueFormat: (v) => v.toFixed(3),
  });

  const ratioChart = barChart({
    title: 'Avg Separation Ratio (higher = better cluster separation)',
    labels: models,
    series: [{ name: 'Ratio', values: avgRatio }],
    valueFormat: (v) => v.toFixed(2),
  });

  // Per-focus ratios (averaged across fixtures)
  const allFocuses = [...new Set(results.flatMap((r) => r.perFocus.map((f) => f.focus)))];
  const perFocusChart = barChart({
    title: 'Separation Ratio by Focus (averaged across fixtures)',
    labels: allFocuses,
    series: models.map((model) => ({
      name: model,
      values: allFocuses.map((focus) => avgFocusRatio(byModel.get(model) ?? [], focus)),
    })),
    valueFormat: (v) => v.toFixed(2),
    width: Math.max(600, allFocuses.length * 80),
  });

  // Table
  const tableRows = models
    .map(
      (m, i) => `
    <tr>
      <td>${m}</td>
      <td>${(avgIntra[i] ?? 0).toFixed(3)}</td>
      <td>${(avgInter[i] ?? 0).toFixed(3)}</td>
      <td><strong>${(avgRatio[i] ?? 0).toFixed(2)}</strong></td>
      <td>${(avg(byModel.get(m)?.map((r) => r.durationMs) ?? []) / 1000).toFixed(1)}s</td>
    </tr>`,
    )
    .join('');

  return `
    <section>
      <h2>Embedding Quality</h2>
      <p class="note">Averaged across ${new Set(results.map((r) => r.model)).size === models.length ? results.length / models.length : results.length} fixtures. Separation ratio = intra / inter similarity.</p>
      <div class="charts-row">${simChart}${ratioChart}</div>
      ${perFocusChart}
      <table>
        <thead><tr><th>Model</th><th>Avg Intra</th><th>Avg Inter</th><th>Avg Ratio</th><th>Avg Time</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;
};

// --- Section: Ranking ---

const rankSection = (results: RankBenchResult[]): string => {
  if (results.length === 0) {
    return '';
  }

  const withModel = results as (RankBenchResult & { model?: string })[];
  const models = [...new Set(withModel.map((r) => shortModel(r.model ?? 'default')))];

  // Average NDCG across all focuses, no-votes, default-focus weights only
  const noVoteDefault = withModel.filter((r) => r.scenario.endsWith('/no-votes/default-focus'));
  const withVoteDefault = withModel.filter((r) => r.scenario.endsWith('/2up-1down/default-focus'));

  const noVoteNdcg = models.map((m) =>
    avg(noVoteDefault.filter((r) => shortModel(r.model ?? '') === m).map((r) => r.ndcg)),
  );
  const withVoteNdcg = models.map((m) =>
    avg(withVoteDefault.filter((r) => shortModel(r.model ?? '') === m).map((r) => r.ndcg)),
  );

  const ndcgChart = barChart({
    title: 'Avg NDCG@K (default-focus weights)',
    labels: models,
    series: [
      { name: 'No votes', values: noVoteNdcg },
      { name: '2 up / 1 down', values: withVoteNdcg },
    ],
    maxValue: 1,
    valueFormat: (v) => v.toFixed(3),
  });

  // Vote impact delta
  const voteDelta = models.map((_, i) => (withVoteNdcg[i] ?? 0) - (noVoteNdcg[i] ?? 0));
  const maxDelta = Math.max(...voteDelta.map(Math.abs), 0.01);

  const deltaChart = barChart({
    title: 'Vote Impact: NDCG Delta (positive = votes help)',
    labels: models,
    series: [{ name: 'Delta', values: voteDelta }],
    maxValue: maxDelta * 1.5,
    valueFormat: (v) => (v >= 0 ? '+' : '') + v.toFixed(3),
  });

  // Weight comparison: average NDCG across models for each weight config, no votes
  const weightConfigs = [
    ...new Set(
      withModel.filter((r) => r.scenario.includes('/no-votes/')).map((r) => r.scenario.split('/')[2] as string),
    ),
  ];

  const weightChart = barChart({
    title: 'Avg NDCG by Weight Config (no votes)',
    labels: weightConfigs,
    series: models.map((model) => ({
      name: model,
      values: weightConfigs.map((wc) => {
        const matching = withModel.filter(
          (r) => shortModel(r.model ?? '') === model && r.scenario.endsWith(`/no-votes/${wc}`),
        );
        return avg(matching.map((r) => r.ndcg));
      }),
    })),
    maxValue: 1,
    valueFormat: (v) => v.toFixed(3),
  });

  // Summary table
  const tableRows = models
    .map(
      (m, i) => `
    <tr>
      <td>${m}</td>
      <td>${(noVoteNdcg[i] ?? 0).toFixed(3)}</td>
      <td>${(withVoteNdcg[i] ?? 0).toFixed(3)}</td>
      <td>${(voteDelta[i] ?? 0) >= 0 ? '+' : ''}${(voteDelta[i] ?? 0).toFixed(3)}</td>
      <td>${avg(noVoteDefault.filter((r) => shortModel(r.model ?? '') === m).map((r) => r.mrr)).toFixed(3)}</td>
    </tr>`,
    )
    .join('');

  return `
    <section>
      <h2>Ranking & Vote Impact</h2>
      <p class="note">Averaged across all focuses and fixtures. NDCG@K where K = min(relevant, 10).</p>
      <div class="charts-row">${ndcgChart}${deltaChart}</div>
      ${weightChart}
      <table>
        <thead><tr><th>Model</th><th>NDCG (no votes)</th><th>NDCG (with votes)</th><th>Delta</th><th>MRR</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;
};

// --- Conclusions ---

const conclusionsSection = (run: BenchRun): string => {
  if (run.classify.length === 0 && run.embed.length === 0) {
    return '';
  }

  // Find best models
  const grouped = groupByModelFixture(run.classify);
  let bestSimModel = '';
  let bestSimF1 = 0;
  for (const [key, runs] of grouped) {
    const [model, strategy] = key.split('|') as [string, string];
    if (strategy !== 'similarity') {
      continue;
    }
    const f1 = avg(runs.map((r) => r.macroF1));
    if (f1 > bestSimF1) {
      bestSimF1 = f1;
      bestSimModel = shortModel(model);
    }
  }

  // Best embed model by separation ratio
  const embedByModel = new Map<string, number[]>();
  for (const r of run.embed) {
    const key = shortModel(r.model);
    const arr = embedByModel.get(key) ?? [];
    arr.push(r.separationRatio);
    embedByModel.set(key, arr);
  }
  let bestEmbedModel = '';
  let bestEmbedRatio = 0;
  for (const [model, ratios] of embedByModel) {
    const r = avg(ratios);
    if (r > bestEmbedRatio) {
      bestEmbedRatio = r;
      bestEmbedModel = model;
    }
  }

  return `
    <section>
      <h2>Key Findings</h2>
      <ul class="findings">
        <li><strong>Best similarity classifier:</strong> ${bestSimModel} (avg F1: ${pct(bestSimF1)})</li>
        <li><strong>Best cluster separation:</strong> ${bestEmbedModel} (avg ratio: ${bestEmbedRatio.toFixed(2)})</li>
        <li><strong>Similarity vs NLI:</strong> Similarity achieves comparable F1 at ~100x less compute. NLI adds recall for ambiguous topics but hurts precision on broad categories.</li>
        <li><strong>Small vs base models:</strong> Base models (768-dim) do not consistently outperform small models (384-dim). The extra capacity often hurts precision on overlapping topics.</li>
        <li><strong>Content type matters:</strong> All models perform better on well-separated topics (NYT geopolitics) than on overlapping consumer tech categories (The Verge).</li>
        <li><strong>Vote propagation:</strong> Votes consistently help ranking for focused topics, but can hurt on broad categories where the embedding space is less separable.</li>
      </ul>
    </section>`;
};

// --- Exports ---

export { classifySection, embedSection, rankSection, conclusionsSection };
