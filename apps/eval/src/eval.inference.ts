import { homedir } from 'node:os';
import path from 'node:path';

import { pipeline, env } from '@huggingface/transformers';
import type { FeatureExtractionPipeline, ZeroShotClassificationPipeline } from '@huggingface/transformers';

// --- Config ---

env.allowLocalModels = true;
env.cacheDir = process.env.HF_HOME ?? path.join(homedir(), '.cache', 'huggingface');

// --- Types ---

type EmbedFn = (text: string) => Promise<Float32Array>;
type ClassifyFn = (text: string, labels: string[]) => Promise<{ label: string; score: number }[]>;

type InferenceEngine = {
  embed: EmbedFn;
  classify: ClassifyFn;
  embedBatch: (texts: string[]) => Promise<Float32Array[]>;
  embeddingModel: string;
  classifierModel: string;
  dispose: () => void;
};

// --- Engine factory ---

const createInferenceEngine = (params?: {
  embeddingModel?: string;
  classifierModel?: string;
}): InferenceEngine => {
  const embeddingModel = params?.embeddingModel ?? 'Xenova/all-MiniLM-L6-v2';
  const classifierModel = params?.classifierModel ?? 'Xenova/bart-large-mnli';

  let embedPipeline: Promise<FeatureExtractionPipeline> | null = null;
  let classifyPipeline: Promise<ZeroShotClassificationPipeline> | null = null;

  const getEmbedPipeline = (): Promise<FeatureExtractionPipeline> => {
    if (!embedPipeline) {
      console.log(`  Loading embedding model: ${embeddingModel}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embedPipeline = (pipeline as any)('feature-extraction', embeddingModel, {
        dtype: 'fp32',
      }) as Promise<FeatureExtractionPipeline>;
    }
    return embedPipeline;
  };

  const getClassifyPipeline = (): Promise<ZeroShotClassificationPipeline> => {
    if (!classifyPipeline) {
      console.log(`  Loading classifier model: ${classifierModel}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      classifyPipeline = (pipeline as any)(
        'zero-shot-classification',
        classifierModel,
      ) as Promise<ZeroShotClassificationPipeline>;
    }
    return classifyPipeline;
  };

  const parseClassifyOutput = (result: unknown): { labels: string[]; scores: number[] } =>
    (Array.isArray(result) ? result[0] : result) as { labels: string[]; scores: number[] };

  const embed: EmbedFn = async (text: string): Promise<Float32Array> => {
    const extractor = await getEmbedPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return output.data as Float32Array;
  };

  const embedBatch = async (texts: string[]): Promise<Float32Array[]> => {
    const results: Float32Array[] = [];
    for (const text of texts) {
      results.push(await embed(text));
    }
    return results;
  };

  const classify: ClassifyFn = async (
    text: string,
    labels: string[],
  ): Promise<{ label: string; score: number }[]> => {
    if (labels.length === 0) {
      return [];
    }
    const classifier = await getClassifyPipeline();
    const result = await classifier(text, labels, { multi_label: true });
    const output = parseClassifyOutput(result);
    return output.labels.map((label: string, i: number) => ({
      label,
      score: output.scores[i] ?? 0,
    }));
  };

  const dispose = (): void => {
    embedPipeline = null;
    classifyPipeline = null;
  };

  return { embed, classify, embedBatch, embeddingModel, classifierModel, dispose };
};

// --- Exports ---

export type { EmbedFn, ClassifyFn, InferenceEngine };
export { createInferenceEngine };
