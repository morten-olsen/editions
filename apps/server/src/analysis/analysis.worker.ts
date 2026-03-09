import { parentPort } from "node:worker_threads";

import { pipeline, env } from "@huggingface/transformers";

import type {
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_CLASSIFIER_MODEL = "Xenova/bart-large-mnli";

// --- Types ---

type EmbedRequest = {
  id: string;
  type: "embed";
  text: string;
};

type ClassifyRequest = {
  id: string;
  type: "classify";
  text: string;
  labels: string[];
};

type ShutdownRequest = {
  type: "shutdown";
};

type WorkerRequest = EmbedRequest | ClassifyRequest | ShutdownRequest;

type EmbedResponse = {
  id: string;
  type: "embed";
  embedding: Float32Array;
};

type ClassifyResponse = {
  id: string;
  type: "classify";
  results: Array<{ label: string; score: number }>;
};

type ErrorResponse = {
  id: string;
  type: "error";
  error: string;
};

type WorkerResponse = EmbedResponse | ClassifyResponse | ErrorResponse;

// --- Lazy model loading ---

env.allowLocalModels = true;
if (process.env.HF_HOME) {
  env.cacheDir = process.env.HF_HOME;
}

let embeddingPipeline: Promise<FeatureExtractionPipeline> | null = null;
let classifierPipeline: Promise<ZeroShotClassificationPipeline> | null = null;

const getEmbeddingPipeline = (): Promise<FeatureExtractionPipeline> => {
  if (!embeddingPipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transformers.js overloaded pipeline() typing
    embeddingPipeline = (pipeline as any)("feature-extraction", DEFAULT_EMBEDDING_MODEL, {
      dtype: "fp32",
    }) as Promise<FeatureExtractionPipeline>;
  }
  return embeddingPipeline;
};

const getClassifierPipeline = (): Promise<ZeroShotClassificationPipeline> => {
  if (!classifierPipeline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- transformers.js overloaded pipeline() typing
    classifierPipeline = (pipeline as any)(
      "zero-shot-classification",
      DEFAULT_CLASSIFIER_MODEL,
    ) as Promise<ZeroShotClassificationPipeline>;
  }
  return classifierPipeline;
};

// --- Message handler ---

const handleMessage = async (msg: WorkerRequest): Promise<void> => {
  if (msg.type === "shutdown") {
    embeddingPipeline = null;
    classifierPipeline = null;
    process.exit(0);
  }

  try {
    if (msg.type === "embed") {
      const extractor = await getEmbeddingPipeline();
      const output = await extractor(msg.text, { pooling: "mean", normalize: true });
      const embedding = output.data as Float32Array;

      const response: EmbedResponse = {
        id: msg.id,
        type: "embed",
        embedding,
      };
      parentPort!.postMessage(response, [embedding.buffer as ArrayBuffer]);
      return;
    }

    if (msg.type === "classify") {
      if (msg.labels.length === 0) {
        const response: ClassifyResponse = { id: msg.id, type: "classify", results: [] };
        parentPort!.postMessage(response);
        return;
      }

      const classifier = await getClassifierPipeline();
      const result = await classifier(msg.text, msg.labels, { multi_label: true });

      const output = (Array.isArray(result) ? result[0] : result) as {
        labels: string[];
        scores: number[];
      };

      const response: ClassifyResponse = {
        id: msg.id,
        type: "classify",
        results: output.labels.map((label: string, i: number) => ({
          label,
          score: output.scores[i] ?? 0,
        })),
      };
      parentPort!.postMessage(response);
      return;
    }
  } catch (err) {
    const response: ErrorResponse = {
      id: msg.id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(response);
  }
};

parentPort!.on("message", (msg: WorkerRequest) => {
  void handleMessage(msg);
});

export type { WorkerRequest, WorkerResponse, EmbedResponse, ClassifyResponse, ErrorResponse };
