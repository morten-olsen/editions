import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ClassifyBenchResult, EmbedBenchResult, RankBenchResult } from './eval.ts';

// --- Types ---

type RunMeta = {
  id: string;
  createdAt: string;
  models: string[];
  fixtures: string[];
  nodeVersion: string;
};

type BenchRun = {
  meta: RunMeta;
  classify: ClassifyBenchResult[];
  embed: EmbedBenchResult[];
  rank: RankBenchResult[];
};

// --- Paths ---

const evalRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultsDir = path.join(evalRoot, 'results');

// --- Run ID ---

const createRunId = (): string => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// --- Persistence ---

const ensureRunDir = async (runId: string): Promise<string> => {
  const runDir = path.join(resultsDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
};

const saveResults = async (params: {
  runId: string;
  kind: 'classify' | 'embed' | 'rank';
  results: ClassifyBenchResult[] | EmbedBenchResult[] | RankBenchResult[];
  models: string[];
  fixtures: string[];
}): Promise<string> => {
  const { runId, kind, results, models, fixtures } = params;
  const runDir = await ensureRunDir(runId);

  // Save results
  const resultsPath = path.join(runDir, `${kind}.json`);
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

  // Upsert meta
  const metaPath = path.join(runDir, 'meta.json');
  let meta: RunMeta;
  try {
    meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    meta.models = [...new Set([...meta.models, ...models])];
    meta.fixtures = [...new Set([...meta.fixtures, ...fixtures])];
  } catch {
    meta = {
      id: runId,
      createdAt: new Date().toISOString(),
      models,
      fixtures,
      nodeVersion: process.version,
    };
  }
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

  console.log(`\nResults saved to ${resultsPath}`);
  return resultsPath;
};

const loadRun = async (runId: string): Promise<BenchRun> => {
  const runDir = path.join(resultsDir, runId);
  const meta: RunMeta = JSON.parse(await fs.readFile(path.join(runDir, 'meta.json'), 'utf-8'));

  const loadJson = async <T>(name: string): Promise<T[]> => {
    try {
      return JSON.parse(await fs.readFile(path.join(runDir, `${name}.json`), 'utf-8'));
    } catch {
      return [];
    }
  };

  return {
    meta,
    classify: await loadJson<ClassifyBenchResult>('classify'),
    embed: await loadJson<EmbedBenchResult>('embed'),
    rank: await loadJson<RankBenchResult>('rank'),
  };
};

const listRuns = async (): Promise<RunMeta[]> => {
  try {
    const entries = await fs.readdir(resultsDir);
    const runs: RunMeta[] = [];
    for (const entry of entries) {
      try {
        const meta: RunMeta = JSON.parse(await fs.readFile(path.join(resultsDir, entry, 'meta.json'), 'utf-8'));
        runs.push(meta);
      } catch {
        // skip non-run directories
      }
    }
    runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return runs;
  } catch {
    return [];
  }
};

const getLatestRunId = async (): Promise<string | null> => {
  const runs = await listRuns();
  return runs[0]?.id ?? null;
};

// --- Exports ---

export type { RunMeta, BenchRun };
export { createRunId, saveResults, loadRun, listRuns, getLatestRunId, resultsDir, evalRoot };
