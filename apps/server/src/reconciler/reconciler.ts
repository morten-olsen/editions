import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { ConfigService } from '../config/config.ts';
import { DatabaseService } from '../database/database.ts';
import { destroySymbol } from '../services/services.ts';
import type { Services } from '../services/services.ts';

import { runReconcileSteps } from './reconciler.runner.ts';
import type { ProgressCallback } from './reconciler.runner.ts';
import { createExtractStep } from './reconciler.extract.ts';
import { createEmbedStep } from './reconciler.embed.ts';
import { createSimilarityStep } from './reconciler.similarity.ts';
import { createNliStep } from './reconciler.nli.ts';
import { createMarkAnalysedStep } from './reconciler.mark-analysed.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import type { WorkerResponse } from './reconciler.worker.ts';

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

const WORKER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'reconciler.worker.ts');

// --- Types ---

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

type ReconcileOptions = {
  scopeFilter?: ScopeFilter;
  skipExtract?: boolean;
  onProgress?: ProgressCallback;
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

  // --- Batch inference primitives ---

  embedBatch = async (texts: string[]): Promise<Float32Array[]> => {
    if (texts.length === 0) {
      return [];
    }
    const response = await this.#request({ type: 'embed_batch', texts });
    if (response.type !== 'embed_batch') {
      throw new Error('Unexpected response type');
    }
    return response.embeddings;
  };

  classifyBatch = async (
    items: { text: string; labels: string[] }[],
  ): Promise<{ label: string; score: number }[][]> => {
    if (items.length === 0) {
      return [];
    }
    const response = await this.#request({ type: 'classify_batch', items });
    if (response.type !== 'classify_batch') {
      throw new Error('Unexpected response type');
    }
    return response.results;
  };

  // --- Pipeline ---

  reconcile = async (options?: ReconcileOptions): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const { config } = this.#services.get(ConfigService);
    const classifier = config.analysis.classifier;
    const useNli = (classifier === 'nli' || classifier === 'hybrid');
    const scopeFilter = options?.scopeFilter;

    const steps = [
      ...(options?.skipExtract ? [] : [createExtractStep({ db, scopeFilter })]),
      createEmbedStep({ db, embedFn: this.embed, embeddingModel: DEFAULT_EMBEDDING_MODEL, scopeFilter }),
      createSimilarityStep({ db, embedFn: this.embed, scopeFilter }),
      ...(useNli ? [createNliStep({ db, classifyFn: this.classify, scopeFilter })] : []),
      createMarkAnalysedStep({ db, scopeFilter }),
    ];

    await runReconcileSteps(steps, options?.onProgress);
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

export type { ReconcileOptions };
export { ReconcilerService, DEFAULT_EMBEDDING_MODEL };
