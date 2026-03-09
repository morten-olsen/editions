import { z } from "zod/v4";

import { AnalysisService } from "../analysis/analysis.ts";
import { createAuthHook } from "../auth/auth.middleware.ts";
import { SourceNotFoundError, SourcesService } from "../sources/sources.ts";
import { TaskService } from "../tasks/tasks.ts";

import type { FetchSourcePayload } from "../sources/sources.fetch.ts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const sourceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  name: z.string(),
  url: z.string(),
  config: z.record(z.string(), z.unknown()),
  lastFetchedAt: z.string().nullable(),
  fetchError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createSourceSchema = z.object({
  name: z.string().min(1).max(256),
  url: z.url(),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  url: z.url().optional(),
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

const articlesPageSchema = z.object({
  articles: z.array(articleSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
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
  wordCount: z.number().nullable(),
  readingTimeSeconds: z.number().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  readAt: z.string().nullable(),
  extractedAt: z.string().nullable(),
  createdAt: z.string(),
});

const articleIdParamSchema = z.object({
  id: z.string(),
  articleId: z.string(),
});

const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const taskResponseSchema = z.object({
  taskId: z.string(),
  status: z.string(),
});

const taskStatusSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  result: z.unknown(),
  error: z.string().nullable(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});

const taskIdParamSchema = z.object({
  id: z.string(),
  taskId: z.string(),
});

// --- Routes ---

const createSourcesRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // List sources
    fastify.route({
      method: "GET",
      url: "/sources",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: z.array(sourceSchema),
        },
      },
      handler: async (req, _reply) => {
        const sources = services.get(SourcesService);
        return sources.list(req.user.sub);
      },
    });

    // Get source
    fastify.route({
      method: "GET",
      url: "/sources/:id",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          200: sourceSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          return await sources.get(req.user.sub, req.params.id);
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Create source
    fastify.route({
      method: "POST",
      url: "/sources",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: createSourceSchema,
        response: {
          201: sourceSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        const source = await sources.create({
          userId: req.user.sub,
          name: req.body.name,
          url: req.body.url,
        });
        return reply.code(201).send(source);
      },
    });

    // Update source
    fastify.route({
      method: "PATCH",
      url: "/sources/:id",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        body: updateSourceSchema,
        response: {
          200: sourceSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          return await sources.update(req.user.sub, req.params.id, req.body);
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Delete source
    fastify.route({
      method: "DELETE",
      url: "/sources/:id",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          204: z.undefined(),
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          const source = await sources.get(req.user.sub, req.params.id);
          if (source.type === "bookmarks") {
            return reply.code(400).send({ error: "Cannot delete the built-in bookmarks source" });
          }
          await sources.delete(req.user.sub, req.params.id);
          return reply.code(204).send();
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // List articles for a source
    fastify.route({
      method: "GET",
      url: "/sources/:id/articles",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        querystring: paginationQuerySchema,
        response: {
          200: articlesPageSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          return await sources.listArticles(req.user.sub, req.params.id, {
            offset: req.query.offset,
            limit: req.query.limit,
          });
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Get single article
    fastify.route({
      method: "GET",
      url: "/sources/:id/articles/:articleId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleIdParamSchema,
        response: {
          200: articleDetailSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          return await sources.getArticle(req.user.sub, req.params.articleId);
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Toggle article read status
    fastify.route({
      method: "PUT",
      url: "/sources/:id/articles/:articleId/read",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleIdParamSchema,
        body: z.object({ read: z.boolean() }),
        response: {
          200: articleDetailSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          return await sources.setArticleReadStatus(
            req.user.sub,
            req.params.articleId,
            req.body.read,
          );
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Fetch source (trigger RSS fetch)
    fastify.route({
      method: "POST",
      url: "/sources/:id/fetch",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          202: taskResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        let source;
        try {
          source = await sources.get(req.user.sub, req.params.id);
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }

        if (source.type === "bookmarks") {
          return reply.code(400).send({ error: "Cannot fetch a bookmarks source" });
        }

        const taskService = services.get(TaskService);
        const task = taskService.enqueue<FetchSourcePayload>("fetch_source", {
          sourceId: req.params.id,
          userId: req.user.sub,
        }, { userId: req.user.sub });

        return reply.code(202).send({ taskId: task.id, status: task.status });
      },
    });

    // Reanalyse all articles in a source
    fastify.route({
      method: "POST",
      url: "/sources/:id/reanalyse",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: idParamSchema,
        response: {
          202: z.object({ enqueued: z.number() }),
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const sources = services.get(SourcesService);
        try {
          await sources.get(req.user.sub, req.params.id);
        } catch (err) {
          if (err instanceof SourceNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }

        const analysisService = services.get(AnalysisService);
        const count = await analysisService.reanalyseSource(req.params.id, req.user.sub);
        return reply.code(202).send({ enqueued: count });
      },
    });

    // Get task status
    fastify.route({
      method: "GET",
      url: "/sources/:id/tasks/:taskId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: taskIdParamSchema,
        response: {
          200: taskStatusSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const taskService = services.get(TaskService);
        const task = taskService.get(req.params.taskId);
        if (!task) {
          return reply.code(404).send({ error: "Task not found" });
        }
        return {
          id: task.id,
          type: task.type,
          status: task.status,
          result: task.result,
          error: task.error,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
        };
      },
    });
  };

export { createSourcesRoutes };
