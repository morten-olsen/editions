import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { Kysely } from 'kysely';

import { ConfigService } from '../config/config.ts';
import { DatabaseService } from '../database/database.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import { destroySymbol } from '../services/services.ts';
import type { Services } from '../services/services.ts';

import { runReconcileSteps } from './reconciler.runner.ts';
import type { ProgressCallback, ReconcileStep } from './reconciler.runner.ts';
import { createExtractStep } from './reconciler.extract.ts';
import { createEmbedStep } from './reconciler.embed.ts';
import type { EmbedFn } from './reconciler.embed.ts';
import { createSimilarityStep } from './reconciler.similarity.ts';
import { createNliStep } from './reconciler.nli.ts';
import type { ClassifyFn } from './reconciler.nli.ts';
import { createMarkAnalysedStep } from './reconciler.mark-analysed.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import type { WorkerResponse } from './reconciler.worker.ts';

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const DEFAULT_CLASSIFIER_MODEL = 'Xenova/bart-large-mnli';

const WORKER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'reconciler.worker.ts');

// --- Types ---

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

// How much analysis state to clear before reconciling:
// - 'scores'  — classifications (and analysed_at outside focus scope), keeping content
// - 'content' — everything derived: classifications, embeddings, extracted content
//   (podcast articles keep their content; their "extraction" is the feed itself)
type ResetLevel = 'scores' | 'content';

type ReconcileOptions = {
  scopeFilter?: ScopeFilter;
  skipExtract?: boolean;
  reset?: ResetLevel;
  // Mark content-bearing articles as extracted before resetting, so articles
  // ingested before extraction tracking existed re-enter the pipeline
  backfillExtractedAt?: boolean;
  onProgress?: ProgressCallback;
};

type ClassifierStrategy = 'similarity' | 'nli' | 'hybrid';

type BuildReconcileStepsParams = {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  classifyFn: ClassifyFn;
  classifier: ClassifierStrategy;
  scopeFilter?: ScopeFilter;
  skipExtract?: boolean;
  embeddingModel?: string;
  classifierModel?: string;
};

// --- Pipeline composition ---

// The single definition of the pipeline's shape, including how the configured
// classifier strategy maps onto steps. Tests compose the real pipeline through
// this — never a copy.
const buildReconcileSteps = (params: BuildReconcileStepsParams): ReconcileStep[] => {
  const {
    db,
    embedFn,
    classifyFn,
    classifier,
    scopeFilter,
    skipExtract,
    embeddingModel = DEFAULT_EMBEDDING_MODEL,
    classifierModel = DEFAULT_CLASSIFIER_MODEL,
  } = params;

  const useNli = classifier === 'nli' || classifier === 'hybrid';

  return [
    ...(skipExtract ? [] : [createExtractStep({ db, scopeFilter })]),
    createEmbedStep({ db, embedFn, embeddingModel, scopeFilter }),
    createSimilarityStep({ db, embedFn, embeddingModel, scopeFilter }),
    ...(useNli ? [createNliStep({ db, classifyFn, classifierModel, scopeFilter })] : []),
    createMarkAnalysedStep({ db, scopeFilter }),
  ];
};

// Clears derived analysis state within the scope so the pipeline redoes it.
// This module owns the tables the steps write, so their reset lives here too.
const applyAnalysisReset = async (
  db: Kysely<DatabaseSchema>,
  options: Pick<ReconcileOptions, 'scopeFilter' | 'reset' | 'backfillExtractedAt'>,
): Promise<void> => {
  const { scopeFilter, reset, backfillExtractedAt } = options;

  if (backfillExtractedAt) {
    let backfill = db
      .updateTable('articles')
      .set({ extracted_at: new Date().toISOString() })
      .where('extracted_at', 'is', null)
      .where((eb) => eb.or([eb('content', 'is not', null), eb('summary', 'is not', null)]));
    if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
      backfill = backfill.where('source_id', 'in', scopeFilter.sourceIds);
    }
    await backfill.execute();
  }

  if (!reset) {
    return;
  }

  // Focus scope: only that focus's classifications are stale
  if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
    await db.deleteFrom('article_focuses').where('focus_id', 'in', scopeFilter.focusIds).execute();
    return;
  }

  let query = db.selectFrom('articles').select('articles.id').where('articles.extracted_at', 'is not', null);
  if (reset === 'content') {
    query = query.innerJoin('sources', 'sources.id', 'articles.source_id').where('sources.type', '!=', 'podcast');
  }
  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    query = query.where('articles.source_id', 'in', scopeFilter.sourceIds);
  }

  const ids = (await query.execute()).map((row) => row.id);
  if (ids.length === 0) {
    return;
  }

  await db.deleteFrom('article_focuses').where('article_id', 'in', ids).execute();
  if (reset === 'content') {
    await db.deleteFrom('article_embeddings').where('article_id', 'in', ids).execute();
    await db
      .updateTable('articles')
      .set({ content: null, extracted_at: null, analysed_at: null })
      .where('id', 'in', ids)
      .execute();
  } else {
    await db.updateTable('articles').set({ analysed_at: null }).where('id', 'in', ids).execute();
  }
};

// --- Service ---

class ReconcilerService {
  #services: Services;
  #worker: Worker | null = null;
  #pending = new Map<string, PendingRequest>();

  constructor(services: Services) {
    this.#services = services;
  }

  // --- Worker lifecycle ---

  #getWorker = (): Worker => {
    if (!this.#worker) {
      this.#worker = new Worker(WORKER_PATH);

      this.#worker.on('message', (msg: WorkerResponse) => {
        const pending = this.#pending.get(msg.id);
        if (!pending) {
          return;
        }
        this.#pending.delete(msg.id);

        if (msg.type === 'error') {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg);
        }
      });

      this.#worker.on('error', (err: Error) => {
        for (const [id, pending] of this.#pending) {
          pending.reject(err);
          this.#pending.delete(id);
        }
        this.#worker = null;
      });

      this.#worker.on('exit', () => {
        for (const [id, pending] of this.#pending) {
          pending.reject(new Error('Reconciler worker exited unexpectedly'));
          this.#pending.delete(id);
        }
        this.#worker = null;
      });
    }

    return this.#worker;
  };

  #request = (msg: Record<string, unknown>): Promise<WorkerResponse> => {
    const id = crypto.randomUUID();

    return new Promise<WorkerResponse>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.#getWorker().postMessage({ ...msg, id });
    });
  };

  // --- Inference primitives ---

  embed = async (text: string): Promise<Float32Array> => {
    const response = await this.#request({ type: 'embed', text });
    if (response.type !== 'embed') {
      throw new Error('Unexpected response type');
    }
    return response.embedding;
  };

  classify = async (text: string, labels: string[]): Promise<{ label: string; score: number }[]> => {
    if (labels.length === 0) {
      return [];
    }

    const response = await this.#request({ type: 'classify', text, labels });
    if (response.type !== 'classify') {
      throw new Error('Unexpected response type');
    }
    return response.results;
  };

  // --- Pipeline ---

  reconcile = async (options: ReconcileOptions = {}): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const { config } = this.#services.get(ConfigService);

    await applyAnalysisReset(db, options);

    const steps = buildReconcileSteps({
      db,
      embedFn: this.embed,
      classifyFn: this.classify,
      classifier: config.analysis.classifier,
      scopeFilter: options.scopeFilter,
      skipExtract: options.skipExtract,
    });

    await runReconcileSteps(steps, options.onProgress);
  };

  // --- Cleanup ---

  [destroySymbol] = async (): Promise<void> => {
    if (this.#worker) {
      this.#worker.postMessage({ type: 'shutdown' });
      await this.#worker.terminate();
      this.#worker = null;
    }
    for (const [id, pending] of this.#pending) {
      pending.reject(new Error('Reconciler service destroyed'));
      this.#pending.delete(id);
    }
  };
}

export type { ReconcileOptions, ResetLevel, ClassifierStrategy, BuildReconcileStepsParams };
export type { ProgressCallback, ReconcileProgress } from './reconciler.runner.ts';
export type { ScopeFilter } from './reconciler.utils.ts';
export {
  ReconcilerService,
  buildReconcileSteps,
  applyAnalysisReset,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_CLASSIFIER_MODEL,
};
