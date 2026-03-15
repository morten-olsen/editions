import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import {
  EditionConfigNotFoundError,
  EditionError,
  EditionNotFoundError,
  EditionsService,
} from '../editions/editions.ts';
import type { Services } from '../services/services.ts';
import { ArticleNotFoundForVoteError, VotesService } from '../votes/votes.ts';

import {
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
} from './editions.routes.schemas.ts';

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
};

// --- Route registration helpers ---

const registerConfigReadRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List edition configs
  fastify.route({
    method: 'GET',
    url: '/editions/configs',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 200: z.array(editionConfigSchema) },
    },
    handler: async (req, _reply) => {
      const editions = services.get(EditionsService);
      return editions.listConfigs(req.user.sub);
    },
  });

  // Get edition config
  fastify.route({
    method: 'GET',
    url: '/editions/configs/:configId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      response: { 200: editionConfigSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.getConfig(req.user.sub, req.params.configId);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerConfigWriteRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Create edition config
  fastify.route({
    method: 'POST',
    url: '/editions/configs',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: createEditionConfigSchema,
      response: { 201: editionConfigSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      const config = await editions.createConfig({ userId: req.user.sub, ...req.body });
      return reply.code(201).send(config);
    },
  });

  // Update edition config
  fastify.route({
    method: 'PATCH',
    url: '/editions/configs/:configId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      body: updateEditionConfigSchema,
      response: { 200: editionConfigSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.updateConfig(req.user.sub, req.params.configId, req.body);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Delete edition config
  fastify.route({
    method: 'DELETE',
    url: '/editions/configs/:configId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      response: { 204: z.undefined(), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        await editions.deleteConfig(req.user.sub, req.params.configId);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerGenerateRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/generate',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      response: { 201: editionDetailSchema, 404: errorResponseSchema, 400: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        const edition = await editions.generate(req.user.sub, req.params.configId);
        return reply.code(201).send(edition);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        if (err instanceof EditionError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Preview what a generated edition would look like (dry-run)
  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/preview',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      body: z.object({
        lookbackHours: z.number().int().min(1).optional(),
        excludePriorEditions: z.boolean().optional(),
        focuses: z.array(z.object({
          focusId: z.string(),
          focusName: z.string(),
          position: z.number(),
          budgetType: z.enum(['time', 'count']).default('count'),
          budgetValue: z.number().default(10),
          lookbackHours: z.number().nullable().default(null),
          excludePriorEditions: z.boolean().nullable().default(null),
          weight: z.number().default(1),
        })).optional(),
      }).optional(),
      response: {
        200: z.object({
          sections: z.array(z.object({
            focusName: z.string(),
            articles: z.array(z.object({
              id: z.string(),
              title: z.string(),
              sourceName: z.string(),
              consumptionTimeSeconds: z.number().nullable(),
            })),
          })),
          totalArticles: z.number(),
          totalReadingMinutes: z.number(),
        }),
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.previewGenerate(req.user.sub, req.params.configId, req.body ?? undefined);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        if (err instanceof EditionError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // List editions for a config
  fastify.route({
    method: 'GET',
    url: '/editions/configs/:configId/editions',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      response: { 200: z.array(editionSummarySchema), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.listEditions(req.user.sub, req.params.configId);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerEditionReadRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Get a generated edition
  fastify.route({
    method: 'GET',
    url: '/editions/:editionId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionIdParamSchema,
      response: { 200: editionDetailSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.getEdition(req.user.sub, req.params.editionId);
      } catch (err) {
        if (err instanceof EditionNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Delete a generated edition
  fastify.route({
    method: 'DELETE',
    url: '/editions/:editionId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionIdParamSchema,
      response: { 204: z.undefined(), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        await editions.deleteEdition(req.user.sub, req.params.editionId);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof EditionNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerEditionProgressRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Update reading progress
  fastify.route({
    method: 'PATCH',
    url: '/editions/:editionId/progress',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionIdParamSchema,
      body: updateProgressSchema,
      response: { 200: editionSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.updateEditionProgress(req.user.sub, req.params.editionId, req.body.currentPosition);
      } catch (err) {
        if (err instanceof EditionNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Toggle edition read status
  fastify.route({
    method: 'PUT',
    url: '/editions/:editionId/read',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionIdParamSchema,
      body: z.object({ read: z.boolean() }),
      response: { 200: editionSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.setEditionReadStatus(req.user.sub, req.params.editionId, req.body.read);
      } catch (err) {
        if (err instanceof EditionNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerEditionVoteRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Upsert edition-scoped vote on an article
  fastify.route({
    method: 'PUT',
    url: '/editions/:editionId/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionArticleIdParamSchema,
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
          focusId: null,
          editionId: req.params.editionId,
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

  // Remove edition-scoped vote on an article
  fastify.route({
    method: 'DELETE',
    url: '/editions/:editionId/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: editionArticleIdParamSchema,
      response: { 204: z.undefined() },
    },
    handler: async (req, reply) => {
      const votesService = services.get(VotesService);
      await votesService.remove(req.user.sub, req.params.articleId, null, req.params.editionId);
      return reply.code(204).send();
    },
  });
};

// --- Main plugin ---

const createEditionsRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const args = { fastify, services, authenticate };

    registerConfigReadRoutes(args);
    registerConfigWriteRoutes(args);
    registerGenerateRoutes(args);
    registerEditionReadRoutes(args);
    registerEditionProgressRoutes(args);
    registerEditionVoteRoutes(args);
  };

export { createEditionsRoutes };
