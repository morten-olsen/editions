import { z } from 'zod/v4';

// --- Export format schemas (user-agnostic) ---
// All references use names/URLs instead of IDs for portability.
// Articles reference their source by URL. Focus links reference focus by name.

const exportSourceSchema = z.object({
  type: z.string(),
  name: z.string(),
  url: z.string(),
  config: z.record(z.string(), z.unknown()),
  direction: z.string(),
});

const exportArticleSchema = z.object({
  sourceUrl: z.string(),
  externalId: z.string(),
  url: z.nullable(z.string()),
  title: z.string(),
  author: z.nullable(z.string()),
  summary: z.nullable(z.string()),
  content: z.nullable(z.string()),
  consumptionTimeSeconds: z.nullable(z.number()),
  imageUrl: z.nullable(z.string()),
  mediaUrl: z.nullable(z.string()),
  mediaType: z.nullable(z.string()),
  publishedAt: z.nullable(z.string()),
  extractedAt: z.nullable(z.string()),
  analysedAt: z.nullable(z.string()),
  readAt: z.nullable(z.string()),
  progress: z.number(),
  /** Base64-encoded embedding, if available */
  embedding: z.nullable(z.object({
    data: z.string(),
    model: z.string(),
  })),
  /** Focus classification results */
  focuses: z.array(z.object({
    focusName: z.string(),
    similarity: z.nullable(z.number()),
    similarityModel: z.nullable(z.string()),
    nli: z.nullable(z.number()),
    nliModel: z.nullable(z.string()),
  })),
});

const exportFocusSchema = z.object({
  name: z.string(),
  description: z.nullable(z.string()),
  icon: z.nullable(z.string()),
  minConfidence: z.number(),
  minConsumptionTimeSeconds: z.nullable(z.number()),
  maxConsumptionTimeSeconds: z.nullable(z.number()),
  sources: z.array(
    z.object({
      url: z.string(),
      weight: z.number(),
      minConfidence: z.nullable(z.number()),
    }),
  ),
});

const exportEditionConfigSchema = z.object({
  name: z.string(),
  icon: z.nullable(z.string()),
  schedule: z.string(),
  lookbackHours: z.number(),
  excludePriorEditions: z.boolean(),
  enabled: z.boolean(),
  focuses: z.array(
    z.object({
      focusName: z.string(),
      position: z.number(),
      budgetType: z.string(),
      budgetValue: z.number(),
      lookbackHours: z.nullable(z.number()),
      excludePriorEditions: z.nullable(z.boolean()),
      weight: z.number(),
    }),
  ),
  sourceBudgets: z.array(
    z.object({
      sourceUrl: z.string(),
      maxArticles: z.nullable(z.number()),
      maxReadingMinutes: z.nullable(z.number()),
    }),
  ),
});

const exportEditionSchema = z.object({
  editionConfigName: z.string(),
  title: z.string(),
  totalReadingMinutes: z.nullable(z.number()),
  articleCount: z.number(),
  currentPosition: z.number(),
  readAt: z.nullable(z.string()),
  publishedAt: z.string(),
  articles: z.array(z.object({
    sourceUrl: z.string(),
    externalId: z.string(),
    focusName: z.string(),
    position: z.number(),
  })),
});

const exportScoringWeightsSchema = z.nullable(z.record(z.string(), z.unknown()));

const dataExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  sources: z.array(exportSourceSchema),
  articles: z.array(exportArticleSchema),
  focuses: z.array(exportFocusSchema),
  editionConfigs: z.array(exportEditionConfigSchema),
  editions: z.array(exportEditionSchema),
  scoringWeights: exportScoringWeightsSchema,
});

type DataExport = z.infer<typeof dataExportSchema>;

const dataImportResultSchema = z.object({
  sources: z.number(),
  articles: z.number(),
  focuses: z.number(),
  editionConfigs: z.number(),
  editions: z.number(),
  scoringWeightsImported: z.boolean(),
});

export type { DataExport };
export { dataExportSchema, dataImportResultSchema };
