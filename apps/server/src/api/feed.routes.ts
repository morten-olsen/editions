import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { listFeedArticles } from '../feed/feed.ts';
import { pagedSchema, paginationQuerySchema } from '../pagination/pagination.ts';
import type { Services } from '../services/services.ts';

// --- Schemas ---

const feedArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  url: z.string().nullable(),
  title: z.string(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  sourceType: z.string(),
  readAt: z.string().nullable(),
  progress: z.number(),
  createdAt: z.string(),
  score: z.number(),
  vote: z.union([z.literal(1), z.literal(-1)]).nullable(),
  sourceName: z.string(),
});

const feedPageSchema = pagedSchema(feedArticleSchema);

const feedQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['top', 'recent']).default('top'),
  status: z.enum(['unread', 'read', 'all']).default('all'),
  from: z.string().optional(),
  to: z.string().optional(),
});

// --- Routes ---

const createFeedRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    fastify.route({
      method: 'GET',
      url: '/feed',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: feedQuerySchema,
        response: { 200: feedPageSchema },
      },
      handler: async (req, _reply) => {
        const { offset, limit, sort, status, from, to } = req.query;
        return listFeedArticles({
          services,
          userId: req.user.sub,
          opts: { offset, limit, sort, status, from, to },
        });
      },
    });
  };

export { createFeedRoutes };
