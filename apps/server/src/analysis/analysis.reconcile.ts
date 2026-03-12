import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

import { createExtractStep } from './analysis.reconcile.extract.ts';
import { createEmbedStep } from './analysis.reconcile.embed.ts';
import { createSimilarityStep } from './analysis.reconcile.similarity.ts';
import { createNliStep } from './analysis.reconcile.nli.ts';
import { createMarkAnalysedStep } from './analysis.reconcile.mark-analysed.ts';

// --- Dependency function types ---

type EmbedFn = (text: string) => Promise<Float32Array>;

type ClassifyFn = (text: string, labels: string[]) => Promise<{ label: string; score: number }[]>;

// --- Step abstraction ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReconcileStep<T = any> = {
  name: string;
  fetchBatch: () => AsyncGenerator<T[]>;
  processBatch: (batch: T[]) => Promise<void>;
};

type ReconcileProgress = { phase: string; completed: number; total: number };
type ProgressCallback = (progress: ReconcileProgress) => void;

type ScopeFilter = {
  sourceIds?: string[];
  focusIds?: string[];
};

// --- Text preparation ---

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const prepareText = (article: {
  title: string;
  content: string | null;
  summary: string | null;
  sourceType: string;
}): string | null => {
  const raw = article.content ?? (article.sourceType === 'podcast' ? article.summary : null);
  if (!raw) {
    return null;
  }
  return `${article.title}. ${stripHtml(raw)}`.slice(0, 2000);
};

// --- Math ---

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
};

// --- Persistence helpers ---

const upsertSimilarity = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  similarity: number,
): Promise<void> => {
  const rounded = Math.round(similarity * 1000) / 1000;
  await db
    .insertInto('article_focuses')
    .values({
      article_id: articleId,
      focus_id: focusId,
      similarity: rounded,
    })
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        similarity: rounded,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

const upsertNli = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  nli: number,
): Promise<void> => {
  const rounded = Math.round(nli * 1000) / 1000;
  await db
    .insertInto('article_focuses')
    .values({
      article_id: articleId,
      focus_id: focusId,
      nli: rounded,
    })
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        nli: rounded,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

// --- Step runner ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runReconcileSteps = async (steps: ReconcileStep<any>[], onProgress?: ProgressCallback): Promise<void> => {
  for (const step of steps) {
    let completed = 0;
    for await (const batch of step.fetchBatch()) {
      await step.processBatch(batch);
      completed += batch.length;
      onProgress?.({ phase: step.name, completed, total: 0 });
    }
  }
};

// --- Factory: build all steps based on config ---

type ReconcileStepConfig = {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  classifyFn?: ClassifyFn;
  embeddingModel: string;
  classifier: 'nli' | 'similarity' | 'hybrid';
  scopeFilter?: ScopeFilter;
  skipExtract?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createReconcileSteps = (params: ReconcileStepConfig): ReconcileStep<any>[] => {
  const { db, embedFn, classifyFn, embeddingModel, classifier, scopeFilter, skipExtract } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: ReconcileStep<any>[] = [];

  if (!skipExtract) {
    steps.push(createExtractStep({ db, scopeFilter }));
  }

  steps.push(createEmbedStep({ db, embedFn, embeddingModel, scopeFilter }));
  steps.push(createSimilarityStep({ db, embedFn, scopeFilter }));

  if ((classifier === 'nli' || classifier === 'hybrid') && classifyFn) {
    steps.push(createNliStep({ db, classifyFn, scopeFilter }));
  }

  steps.push(createMarkAnalysedStep({ db, scopeFilter }));

  return steps;
};

// --- Exports ---

export type {
  EmbedFn,
  ClassifyFn,
  ReconcileStep,
  ReconcileProgress,
  ProgressCallback,
  ScopeFilter,
  ReconcileStepConfig,
};
export {
  prepareText,
  dotProduct,
  upsertSimilarity,
  upsertNli,
  runReconcileSteps,
  createReconcileSteps,
  createExtractStep,
  createEmbedStep,
  createSimilarityStep,
  createNliStep,
  createMarkAnalysedStep,
};
