import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadRun, getLatestRunId, listRuns, evalRoot } from '../eval.results.ts';
import type { BenchRun } from '../eval.results.ts';

import { shortModel } from './report.charts.ts';
import { classifySection, embedSection, rankSection, conclusionsSection } from './report.sections.ts';

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
