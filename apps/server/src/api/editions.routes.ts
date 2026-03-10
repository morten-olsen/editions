import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import {
  EditionConfigNotFoundError,
  EditionError,
  EditionNotFoundError,
  EditionsService,
} from "../editions/editions.ts";
import {
  ArticleNotFoundForVoteError,
  VotesService,
} from "../votes/votes.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const editionConfigFocusSchema = z.object({
  focusId: z.string(),
  focusName: z.string(),
  position: z.number(),
  budgetType: z.enum(["time", "count"]),
  budgetValue: z.number(),
  lookbackHours: z.number().nullable(),
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
  budgetType: z.enum(["time", "count"]),
  budgetValue: z.number().int().min(1),
  lookbackHours: z.number().int().min(1).nullable().optional(),
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
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  sourceType: z.string(),
  readAt: z.string().nullable(),
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

const errorResponseSchema = z.object({
  error: z.string(),
});

const configIdParamSchema = z.object({
  configId: z.string(),
});

const editionIdParamSchema = z.object({
  editionId: z.string(),
});

const configEditionIdParamSchema = z.object({
  configId: z.string(),
  editionId: z.string(),
});

const editionArticleIdParamSchema = z.object({
  editionId: z.string(),
  articleId: z.string(),
});

const updateProgressSchema = z.object({
  currentPosition: z.number().int().min(0),
});

// --- Routes ---

const createEditionsRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // --- Edition Config CRUD ---

    // List edition configs
    fastify.route({
      method: "GET",
      url: "/editions/configs",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(editionConfigSchema),
        },
      },
      handler: async (req, _reply) => {
        const editions = services.get(EditionsService);
        return editions.listConfigs(req.user.sub);
      },
    });

    // Get edition config
    fastify.route({
      method: "GET",
      url: "/editions/configs/:configId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: configIdParamSchema,
        response: {
          200: editionConfigSchema,
          404: errorResponseSchema,
        },
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

    // Create edition config
    fastify.route({
      method: "POST",
      url: "/editions/configs",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: createEditionConfigSchema,
        response: {
          201: editionConfigSchema,
        },
      },
      handler: async (req, reply) => {
        const editions = services.get(EditionsService);
        const config = await editions.createConfig({
          userId: req.user.sub,
          ...req.body,
        });
        return reply.code(201).send(config);
      },
    });

    // Update edition config
    fastify.route({
      method: "PATCH",
      url: "/editions/configs/:configId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: configIdParamSchema,
        body: updateEditionConfigSchema,
        response: {
          200: editionConfigSchema,
          404: errorResponseSchema,
        },
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
      method: "DELETE",
      url: "/editions/configs/:configId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: configIdParamSchema,
        response: {
          204: z.undefined(),
          404: errorResponseSchema,
        },
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

    // --- Generate Edition ---

    fastify.route({
      method: "POST",
      url: "/editions/configs/:configId/generate",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: configIdParamSchema,
        response: {
          201: editionDetailSchema,
          404: errorResponseSchema,
          400: errorResponseSchema,
        },
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

    // --- Generated Editions ---

    // List editions for a config
    fastify.route({
      method: "GET",
      url: "/editions/configs/:configId/editions",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: configIdParamSchema,
        response: {
          200: z.array(editionSummarySchema),
          404: errorResponseSchema,
        },
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

    // Get a generated edition
    fastify.route({
      method: "GET",
      url: "/editions/:editionId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionIdParamSchema,
        response: {
          200: editionDetailSchema,
          404: errorResponseSchema,
        },
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
      method: "DELETE",
      url: "/editions/:editionId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionIdParamSchema,
        response: {
          204: z.undefined(),
          404: errorResponseSchema,
        },
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

    // Update reading progress
    fastify.route({
      method: "PATCH",
      url: "/editions/:editionId/progress",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionIdParamSchema,
        body: updateProgressSchema,
        response: {
          200: editionSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const editions = services.get(EditionsService);
        try {
          return await editions.updateEditionProgress(
            req.user.sub,
            req.params.editionId,
            req.body.currentPosition,
          );
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
      method: "PUT",
      url: "/editions/:editionId/read",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionIdParamSchema,
        body: z.object({ read: z.boolean() }),
        response: {
          200: editionSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const editions = services.get(EditionsService);
        try {
          return await editions.setEditionReadStatus(
            req.user.sub,
            req.params.editionId,
            req.body.read,
          );
        } catch (err) {
          if (err instanceof EditionNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // --- Edition-scoped votes ---

    // Upsert edition-scoped vote on an article
    fastify.route({
      method: "PUT",
      url: "/editions/:editionId/articles/:articleId/vote",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionArticleIdParamSchema,
        body: z.object({
          value: z.union([z.literal(1), z.literal(-1)]),
        }),
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
      method: "DELETE",
      url: "/editions/:editionId/articles/:articleId/vote",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: editionArticleIdParamSchema,
        response: {
          204: z.undefined(),
        },
      },
      handler: async (req, reply) => {
        const votesService = services.get(VotesService);
        await votesService.remove(
          req.user.sub,
          req.params.articleId,
          null,
          req.params.editionId,
        );
        return reply.code(204).send();
      },
    });
  };

export { createEditionsRoutes };
