import { z } from 'zod/v4';

import { pagedSchema, paginationQuerySchema } from '../pagination/pagination.ts';

const sourceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  name: z.string(),
  url: z.string(),
  direction: z.string(),
  lastFetchedAt: z.string().nullable(),
  fetchError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createSourceSchema = z.object({
  name: z.string().min(1).max(256),
  url: z.url(),
  type: z.enum(['rss', 'podcast', 'mastodon', 'bluesky', 'youtube', 'custom']).default('rss'),
  direction: z.enum(['newest', 'oldest']).default('newest'),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  url: z.url().optional(),
  direction: z.enum(['newest', 'oldest']).optional(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const idParamSchema = z.object({
  id: z.string(),
});

const articleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  externalId: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

const articlesPageSchema = pagedSchema(articleSchema);

const sourcesPageSchema = pagedSchema(sourceSchema);

/**
 * `limit` omitted returns every source (the builders need the full set); the list
 * view passes an explicit page size. `q` searches name and URL server-side.
 */
const listSourcesQuerySchema = paginationQuerySchema.extend({
  q: z.string().min(1).optional(),
  includeBookmarks: z.enum(['true', 'false']).optional(),
});

const articleDetailSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  externalId: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  sourceType: z.string(),
  sourceName: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  readAt: z.string().nullable(),
  extractedAt: z.string().nullable(),
  progress: z.number(),
  createdAt: z.string(),
});

const articleIdParamSchema = z.object({
  id: z.string(),
  articleId: z.string(),
});

const jobResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});

const opmlImportResultSchema = z.object({
  added: z.number(),
  skipped: z.number(),
  sources: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      status: z.enum(['added', 'skipped']),
    }),
  ),
});

export {
  sourceSchema,
  createSourceSchema,
  updateSourceSchema,
  errorResponseSchema,
  idParamSchema,
  articlesPageSchema,
  sourcesPageSchema,
  listSourcesQuerySchema,
  articleDetailSchema,
  articleIdParamSchema,
  jobResponseSchema,
  opmlImportResultSchema,
};
