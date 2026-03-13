import { homedir } from 'node:os';
import path from 'node:path';
import { parentPort } from 'node:worker_threads';

import { pipeline, env } from '@huggingface/transformers';
import type { FeatureExtractionPipeline, ZeroShotClassificationPipeline } from '@huggingface/transformers';

// --- Guard ---

if (!parentPort) {
  throw new Error('reconciler.worker must be run as a worker thread');
}

const port = parentPort;

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const DEFAULT_CLASSIFIER_MODEL = 'Xenova/bart-large-mnli';

// --- Types ---

type EmbedRequest = {
  id: string;
  type: 'embed';
  text: string;
};

type ClassifyRequest = {
  id: string;
  type: 'classify';
  text: string;
  labels: string[];
};

type EmbedBatchRequest = {
  id: string;
  type: 'embed_batch';
  texts: string[];
};

type ClassifyBatchRequest = {
  id: string;
  type: 'classify_batch';
  items: { text: string; labels: string[] }[];
};

type ShutdownRequest = {
  type: 'shutdown';
};

type WorkerRequest = EmbedRequest | ClassifyRequest | EmbedBatchRequest | ClassifyBatchRequest | ShutdownRequest;

type EmbedResponse = {
  id: string;
  type: 'embed';
  embedding: Float32Array;
};

type ClassifyResponse = {
  id: string;
  type: 'classify';
  results: { label: string; score: number }[];
};

type ErrorResponse = {
  id: string;
  type: 'error';
  error: string;
};

type EmbedBatchResponse = {
  id: string;
  type: 'embed_batch';
  embeddings: Float32Array[];
};

type ClassifyBatchResponse = {
  id: string;
  type: 'classify_batch';
  results: { label: string; score: number }[][];
};

type WorkerResponse = EmbedResponse | ClassifyResponse | EmbedBatchResponse | ClassifyBatchResponse | ErrorResponse;

// --- Lazy model loading ---

env.allowLocalModels = true;
env.cacheDir = process.env.HF_HOME ?? path.join(homedir(), '.cache', 'huggingface');

let embeddingPipeline: Promise<FeatureExtractionPipeline> | null = null;
let classifierPipeline: Promise<ZeroShotClassificationPipeline> | null = null;

const getEmbeddingPipeline = (): Promise<FeatureExtractionPipeline> => {
  if (!embeddingPipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transformers.js overloaded pipeline() typing
    embeddingPipeline = (pipeline as any)('feature-extraction', DEFAULT_EMBEDDING_MODEL, {
      dtype: 'fp32',
    }) as Promise<FeatureExtractionPipeline>;
  }
  return embeddingPipeline;
};

const getClassifierPipeline = (): Promise<ZeroShotClassificationPipeline> => {
  if (!classifierPipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transformers.js overloaded pipeline() typing
    classifierPipeline = (pipeline as any)(
      'zero-shot-classification',
      DEFAULT_CLASSIFIER_MODEL,
    ) as Promise<ZeroShotClassificationPipeline>;
  }
  return classifierPipeline;
};

// --- Message handler ---

const parseClassifyOutput = (result: unknown): { labels: string[]; scores: number[] } =>
  (Array.isArray(result) ? result[0] : result) as {
    labels: string[];
    scores: number[];
  };

const toClassifyResults = (output: { labels: string[]; scores: number[] }): { label: string; score: number }[] =>
  output.labels.map((label: string, i: number) => ({
    label,
    score: output.scores[i] ?? 0,
  }));

const handleEmbed = async (msg: EmbedRequest): Promise<void> => {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(msg.text, { pooling: 'mean', normalize: true });
  const embedding = output.data as Float32Array;
  const response: EmbedResponse = { id: msg.id, type: 'embed', embedding };
  port.postMessage(response, [embedding.buffer as ArrayBuffer]);
};

const handleClassify = async (msg: ClassifyRequest): Promise<void> => {
  if (msg.labels.length === 0) {
    port.postMessage({ id: msg.id, type: 'classify', results: [] } as ClassifyResponse);
    return;
  }
  const classifier = await getClassifierPipeline();
  const result = await classifier(msg.text, msg.labels, { multi_label: true });
  const output = parseClassifyOutput(result);
  const response: ClassifyResponse = { id: msg.id, type: 'classify', results: toClassifyResults(output) };
  port.postMessage(response);
};

const handleEmbedBatch = async (msg: EmbedBatchRequest): Promise<void> => {
  const extractor = await getEmbeddingPipeline();
  const embeddings: Float32Array[] = [];
  const transferables: ArrayBuffer[] = [];
  for (const text of msg.texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = output.data as Float32Array;
    embeddings.push(embedding);
    transferables.push(embedding.buffer as ArrayBuffer);
  }
  const response: EmbedBatchResponse = { id: msg.id, type: 'embed_batch', embeddings };
  port.postMessage(response, transferables);
};

const handleClassifyBatch = async (msg: ClassifyBatchRequest): Promise<void> => {
  const classifier = await getClassifierPipeline();
  const results: { label: string; score: number }[][] = [];
  for (const item of msg.items) {
    if (item.labels.length === 0) {
      results.push([]);
      continue;
    }
    const result = await classifier(item.text, item.labels, { multi_label: true });
    results.push(toClassifyResults(parseClassifyOutput(result)));
  }
  const response: ClassifyBatchResponse = { id: msg.id, type: 'classify_batch', results };
  port.postMessage(response);
};

const handleMessage = async (msg: WorkerRequest): Promise<void> => {
  if (msg.type === 'shutdown') {
    embeddingPipeline = null;
    classifierPipeline = null;
    process.exit(0);
  }

  try {
    if (msg.type === 'embed') {
      return await handleEmbed(msg);
    }
    if (msg.type === 'classify') {
      return await handleClassify(msg);
    }
    if (msg.type === 'embed_batch') {
      return await handleEmbedBatch(msg);
    }
    if (msg.type === 'classify_batch') {
      return await handleClassifyBatch(msg);
    }
  } catch (err) {
    const response: ErrorResponse = {
      id: msg.id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
    port.postMessage(response);
  }
};

port.on('message', (msg: WorkerRequest) => {
  void handleMessage(msg);
});

export type { WorkerRequest, WorkerResponse, EmbedResponse, ClassifyResponse, ErrorResponse };
