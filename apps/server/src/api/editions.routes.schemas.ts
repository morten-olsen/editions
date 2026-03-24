import { z } from 'zod/v4';

// --- Edition Config Schemas ---

const editionConfigFocusSchema = z.object({
  focusId: z.string(),
  focusName: z.string(),
  position: z.number(),
  budgetType: z.enum(['time', 'count']),
  budgetValue: z.number(),
  lookbackHours: z.number().nullable(),
  excludePriorEditions: z.boolean().nullable(),
  weight: z.number(),
});

const editionConfigSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  schedule: z.string(),
  lookbackHours: z.number(),
  excludePriorEditions: z.boolean(),
  enabled: z.boolean(),
  focuses: z.array(editionConfigFocusSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createEditionConfigFocusSchema = z.object({
  focusId: z.string(),
  position: z.number().int().min(0),
  budgetType: z.enum(['time', 'count']),
  budgetValue: z.number().int().min(1),
  lookbackHours: z.number().int().min(1).nullable().optional(),
  excludePriorEditions: z.boolean().nullable().optional(),
  weight: z.number().min(0).optional(),
});

const createEditionConfigSchema = z.object({
  name: z.string().min(1).max(256),
  icon: z.string().max(64).nullable().optional(),
  schedule: z.string().min(1),
  lookbackHours: z.number().int().min(1),
  excludePriorEditions: z.boolean().optional(),
  enabled: z.boolean().optional(),
  focuses: z.array(createEditionConfigFocusSchema),
});

const updateEditionConfigSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  icon: z.string().max(64).nullable().optional(),
  schedule: z.string().min(1).optional(),
  lookbackHours: z.number().int().min(1).optional(),
  excludePriorEditions: z.boolean().optional(),
  enabled: z.boolean().optional(),
  focuses: z.array(createEditionConfigFocusSchema).optional(),
});

// --- Edition Schemas ---

const editionArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  url: z.string().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
  content: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  sourceType: z.string(),
  readAt: z.string().nullable(),
  progress: z.number(),
  sourceName: z.string(),
  focusId: z.string(),
  focusName: z.string(),
  position: z.number(),
});

const editionSchema = z.object({
  id: z.string(),
  editionConfigId: z.string(),
  title: z.string(),
  totalReadingMinutes: z.number().nullable(),
  articleCount: z.number(),
  currentPosition: z.number(),
  readAt: z.string().nullable(),
  publishedAt: z.string(),
  createdAt: z.string(),
});

const editionDetailSchema = editionSchema.extend({
  articles: z.array(editionArticleSchema),
});

const editionSummarySchema = editionSchema.extend({
  configName: z.string(),
});

// --- Shared Schemas ---

const errorResponseSchema = z.object({
  error: z.string(),
});

const configIdParamSchema = z.object({
  configId: z.string(),
});

const editionIdParamSchema = z.object({
  editionId: z.string(),
});

const editionArticleIdParamSchema = z.object({
  editionId: z.string(),
  articleId: z.string(),
});

const updateProgressSchema = z.object({
  currentPosition: z.number().int().min(0),
});

const listEditionsQuerySchema = z.object({
  read: z.enum(['true', 'false']).optional(),
});

export {
  editionConfigSchema,
  createEditionConfigSchema,
  updateEditionConfigSchema,
  editionDetailSchema,
  editionSummarySchema,
  editionSchema,
  errorResponseSchema,
  configIdParamSchema,
  editionIdParamSchema,
  editionArticleIdParamSchema,
  updateProgressSchema,
  listEditionsQuerySchema,
};
