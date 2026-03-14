import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { FocusNotFoundError, FocusesService } from '../focuses/focuses.ts';
import type { Services } from '../services/services.ts';
import { ArticleNotFoundForVoteError, VotesService } from '../votes/votes.ts';

// --- Schemas ---

const focusSourceSchema = z.object({
  sourceId: z.string(),
  mode: z.enum(['always', 'match']),
  weight: z.number(),
  minConfidence: z.number().nullable(),
});

const focusSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  minConfidence: z.number(),
  minConsumptionTimeSeconds: z.number().nullable(),
  maxConsumptionTimeSeconds: z.number().nullable(),
  sources: z.array(focusSourceSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createFocusSourceSchema = z.object({
  sourceId: z.string(),
  mode: z.enum(['always', 'match']),
  weight: z.number().min(0).default(1),
  minConfidence: z.number().min(0).max(1).nullable().optional().default(null),
});

const createFocusSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(1024).optional(),
  icon: z.string().max(64).nullable().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  minConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
  maxConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
  sources: z.array(createFocusSourceSchema).optional(),
});

const updateFocusSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(1024).nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  minConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
  maxConsumptionTimeSeconds: z.number().int().min(0).nullable().optional(),
});

const setFocusSourcesSchema = z.object({
  sources: z.array(createFocusSourceSchema),
});

const focusArticleSchema = z.object({
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
  consumptionTimeSeconds: z.number().nullable(),
  readAt: z.string().nullable(),
  confidence: z.number(),
  score: z.number(),
  vote: z.union([z.literal(1), z.literal(-1)]).nullable(),
  globalVote: z.union([z.literal(1), z.literal(-1)]).nullable(),
  sourceName: z.string(),
  sourceType: z.string(),
});

const focusArticlesPageSchema = z.object({
  articles: z.array(focusArticleSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const focusArticlesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['top', 'recent']).default('top'),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['unread', 'read', 'all']).default('all'),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const idParamSchema = z.object({
  id: z.string(),
});

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
};

// --- Route registration helpers ---

const registerFocusReadRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List focuses
  fastify.route({
    method: 'GET',
    url: '/focuses',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 200: z.array(focusSchema) },
    },
    handler: async (req, _reply) => {
      const focuses = services.get(FocusesService);
      return focuses.list(req.user.sub);
    },
  });

  // Get focus
  fastify.route({
    method: 'GET',
    url: '/focuses/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 200: focusSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      try {
        return await focuses.get(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerFocusWriteRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Create focus
  fastify.route({
    method: 'POST',
    url: '/focuses',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: createFocusSchema,
      response: { 201: focusSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      const focus = await focuses.create({
        userId: req.user.sub,
        name: req.body.name,
        description: req.body.description,
        icon: req.body.icon,
        minConfidence: req.body.minConfidence,
        minConsumptionTimeSeconds: req.body.minConsumptionTimeSeconds,
        maxConsumptionTimeSeconds: req.body.maxConsumptionTimeSeconds,
        sources: req.body.sources,
      });
      return reply.code(201).send(focus);
    },
  });

  // Update focus
  fastify.route({
    method: 'PATCH',
    url: '/focuses/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateFocusSchema,
      response: { 200: focusSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      try {
        return await focuses.update(req.user.sub, req.params.id, req.body);
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Delete focus
  fastify.route({
    method: 'DELETE',
    url: '/focuses/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 204: z.undefined(), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      try {
        await focuses.delete(req.user.sub, req.params.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerFocusArticleRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List articles in a focus
  fastify.route({
    method: 'GET',
    url: '/focuses/:id/articles',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      querystring: focusArticlesQuerySchema,
      response: { 200: focusArticlesPageSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      try {
        return await focuses.listArticles(req.user.sub, req.params.id, {
          offset: req.query.offset,
          limit: req.query.limit,
          sort: req.query.sort,
          from: req.query.from,
          to: req.query.to,
          status: req.query.status,
        });
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Set sources for a focus (replace all)
  fastify.route({
    method: 'PUT',
    url: '/focuses/:id/sources',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: setFocusSourcesSchema,
      response: { 200: focusSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const focuses = services.get(FocusesService);
      try {
        return await focuses.setSources(req.user.sub, req.params.id, req.body.sources);
      } catch (err) {
        if (err instanceof FocusNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerFocusVoteRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Upsert focus-scoped vote on an article
  fastify.route({
    method: 'PUT',
    url: '/focuses/:id/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string(), articleId: z.string() }),
      body: z.object({ value: z.union([z.literal(1), z.literal(-1)]) }),
      response: {
        200: z.object({
          id: z.string(),
          userId: z.string(),
          articleId: z.string(),
          focusId: z.string().nullable(),
          editionId: z.string().nullable(),
          value: z.union([z.literal(1), z.literal(-1)]),
          createdAt: z.string(),
        }),
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      const votesService = services.get(VotesService);
      try {
        return await votesService.upsert({
          userId: req.user.sub,
          articleId: req.params.articleId,
          focusId: req.params.id,
          editionId: null,
          value: req.body.value,
        });
      } catch (err) {
        if (err instanceof ArticleNotFoundForVoteError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Remove focus-scoped vote on an article
  fastify.route({
    method: 'DELETE',
    url: '/focuses/:id/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string(), articleId: z.string() }),
      response: { 204: z.undefined() },
    },
    handler: async (req, reply) => {
      const votesService = services.get(VotesService);
      await votesService.remove(req.user.sub, req.params.articleId, req.params.id);
      return reply.code(204).send();
    },
  });
};

// --- Main plugin ---

const createFocusesRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const args = { fastify, services, authenticate };

    registerFocusReadRoutes(args);
    registerFocusWriteRoutes(args);
    registerFocusArticleRoutes(args);
    registerFocusVoteRoutes(args);
  };

export { createFocusesRoutes };
