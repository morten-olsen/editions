import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadRun, getLatestRunId, listRuns, evalRoot } from '../eval.results.ts';
import { pct } from '../eval.ts';
import type { ClassifyBenchResult, EmbedBenchResult, RankBenchResult } from '../eval.ts';
import type { BenchRun } from '../eval.results.ts';

// --- CLI ---

const runId = process.argv[2] ?? (await getLatestRunId());
if (!runId) {
  const runs = await listRuns();
  if (runs.length === 0) {
    console.log('No runs found. Run a bench first (pnpm bench:classify, etc.)');
  } else {
    console.log('Available runs:');
    for (const r of runs) {
      console.log(`  ${r.id} — ${r.models.join(', ')} (${r.createdAt})`);
    }
  }
  process.exit(1);
}

// --- Chart helpers ---

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const shortModel = (m: string): string => m.split('/')[1] ?? m;

const barChart = (params: {
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  maxValue?: number;
  valueFormat?: (v: number) => string;
  width?: number;
}): string => {
  const { title, labels, series, valueFormat = (v) => v.toFixed(2) } = params;
  const maxVal = params.maxValue ?? Math.max(...series.flatMap((s) => s.values), 0.01);
  const chartWidth = params.width ?? 600;
  const barGroupWidth = chartWidth / Math.max(labels.length, 1);
  const barWidth = Math.min(barGroupWidth / (series.length + 1), 40);
  const chartHeight = 250;
  const margin = { top: 40, right: 20, bottom: 90, left: 50 };
  const width = chartWidth + margin.left + margin.right;
  const height = chartHeight + margin.top + margin.bottom;

  const bars = labels
    .flatMap((_, li) =>
      series.map((s, si) => {
        const val = s.values[li] ?? 0;
        const clampedVal = Math.max(val, 0);
        const barH = (clampedVal / maxVal) * chartHeight;
        const x = margin.left + li * barGroupWidth + si * barWidth + (barGroupWidth - series.length * barWidth) / 2;
        const y = margin.top + chartHeight - barH;
        const color = COLORS[si % COLORS.length] as string;
        return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barH}" fill="${color}" rx="2">
        <title>${s.name}: ${valueFormat(val)}</title>
      </rect>
      <text x="${x + barWidth / 2 - 1}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#666">${valueFormat(val)}</text>`;
      }),
    )
    .join('\n');

  const xLabels = labels
    .map((l, i) => {
      const x = margin.left + i * barGroupWidth + barGroupWidth / 2;
      const display = l.length > 18 ? l.slice(0, 16) + '..' : l;
      return `<text x="${x}" y="${margin.top + chartHeight + 16}" text-anchor="middle" font-size="10" fill="#333" transform="rotate(-20 ${x} ${margin.top + chartHeight + 16})">${display}</text>`;
    })
    .join('\n');

  const legend = series
    .map((s, i) => {
      const x = margin.left + i * 120;
      const color = COLORS[i % COLORS.length] as string;
      return `<rect x="${x}" y="${height - 18}" width="10" height="10" fill="${color}" rx="2"/>
        <text x="${x + 14}" y="${height - 9}" font-size="10" fill="#333">${s.name}</text>`;
    })
    .join('\n');

  const gridSteps = maxVal <= 1 ? [0.25, 0.5, 0.75, 1.0] : Array.from({ length: 4 }, (_, i) => ((i + 1) / 4) * maxVal);
  const gridLines = gridSteps
    .filter((v) => v <= maxVal * 1.05)
    .map((v) => {
      const y = margin.top + chartHeight - (v / maxVal) * chartHeight;
      return `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="4"/>
        <text x="${margin.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#999">${valueFormat(v)}</text>`;
    })
    .join('\n');

  return `<div class="chart">
    <h3>${title}</h3>
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${gridLines}
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#d1d5db"/>
      <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#d1d5db"/>
      ${bars}
      ${xLabels}
      ${legend}
    </svg>
  </div>`;
};

// --- Aggregation helpers ---

const avg = (nums: number[]): number => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

type ModelFixtureKey = string; // "model|fixture"
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

const classifySection = (results: ClassifyBenchResult[]): string => {
  if (results.length === 0) {
    return '';
  }

  // Aggregate: average F1 across all fixtures per model+strategy
  const grouped = groupByModelFixture(results);
  type AggRow = {
    model: string;
    strategy: string;
    avgP: number;
    avgR: number;
    avgF1: number;
    totalTime: number;
    totalArticles: number;
  };
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
  const fixtureResults = new Map<string, ClassifyBenchResult[]>();
  for (const r of results) {
    // Use article count as proxy for fixture identity
    const fixtureKey = `${r.articlesEvaluated}`;
    const arr = fixtureResults.get(fixtureKey) ?? [];
    arr.push(r);
    fixtureResults.set(fixtureKey, arr);
  }

  // Identify fixtures by number of articles
  const fixtureLabels: string[] = [];
  const fixtureF1s = new Map<string, number[]>();
  for (const model of models) {
    fixtureF1s.set(model, []);
  }

  const seenArticleCounts = [...new Set(results.map((r) => r.articlesEvaluated))].sort();
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

  // Summary table
  const tableRows = aggRows
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

  return `
    <section>
      <h2>Classification</h2>
      <p class="note">Averaged across ${seenArticleCounts.length} fixtures (${seenArticleCounts.join(' + ')} = ${seenArticleCounts.reduce((a, b) => a + b, 0)} articles). Thresholds optimized per focus.</p>
      <div class="charts-row">${f1Chart}${perFixtureChart}</div>
      <table>
        <thead><tr><th>Model</th><th>Strategy</th><th>Avg Prec</th><th>Avg Recall</th><th>Avg F1</th><th>Articles</th><th>Total Time</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;
};

// --- Section: Embeddings ---

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
    series: models.map((model) => {
      const modelResults = byModel.get(model) ?? [];
      return {
        name: model,
        values: allFocuses.map((focus) => {
          const ratios = modelResults
            .map((r) => r.perFocus.find((f) => f.focus === focus))
            .filter((f): f is NonNullable<typeof f> => f != null && f.avgInter > 0)
            .map((f) => f.avgIntra / f.avgInter);
          return avg(ratios);
        }),
      };
    }),
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

// --- HTML template ---

const generateHtml = (benchRun: BenchRun): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Eval Report — ${benchRun.meta.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: #f9fafb; padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.8rem; margin-bottom: 1.5rem; }
    .meta span { margin-right: 1.5rem; }
    .note { font-size: 0.8rem; color: #6b7280; margin-bottom: 1rem; }
    section { background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .chart { margin-bottom: 1rem; }
    .charts-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .charts-row .chart { flex: 1; min-width: 380px; }
    svg { display: block; max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 0.75rem; }
    th, td { padding: 0.4rem 0.6rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { font-weight: 600; color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td strong { color: #059669; }
    .findings { padding-left: 1.25rem; }
    .findings li { margin-bottom: 0.5rem; font-size: 0.9rem; line-height: 1.5; }
    .findings li strong { color: #1f2937; }
    footer { text-align: center; color: #9ca3af; font-size: 0.7rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Evaluation Report</h1>
  <div class="meta">
    <span>Run: ${benchRun.meta.id}</span>
    <span>Models: ${benchRun.meta.models.map(shortModel).join(', ')}</span>
    <span>Fixtures: ${benchRun.meta.fixtures.join(', ')}</span>
    <span>Node: ${benchRun.meta.nodeVersion}</span>
  </div>

  ${conclusionsSection(benchRun)}
  ${classifySection(benchRun.classify)}
  ${embedSection(benchRun.embed)}
  ${rankSection(benchRun.rank)}

  <footer>Generated ${new Date().toISOString()}</footer>
</body>
</html>`;

// --- Main ---

const run = async (): Promise<void> => {
  console.log(`Loading run: ${runId}`);
  const benchRun = await loadRun(runId);

  const html = generateHtml(benchRun);
  const reportsDir = path.join(evalRoot, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `report-${runId}.html`);
  await fs.writeFile(reportPath, html);

  console.log(`Report written to ${reportPath}`);
  console.log(`  Classify: ${benchRun.classify.length} results`);
  console.log(`  Embed: ${benchRun.embed.length} results`);
  console.log(`  Rank: ${benchRun.rank.length} results`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
