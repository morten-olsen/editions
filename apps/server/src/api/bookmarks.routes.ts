import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import { BookmarksService } from "../bookmarks/bookmarks.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const bookmarkResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  createdAt: z.string(),
});

const bookmarkWithArticleSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  createdAt: z.string(),
  articleTitle: z.string(),
  articleUrl: z.string().nullable(),
  author: z.string().nullable(),
  summary: z.string().nullable(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
  sourceId: z.string(),
  sourceName: z.string(),
  sourceType: z.string(),
});

const bookmarksPageSchema = z.object({
  bookmarks: z.array(bookmarkWithArticleSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const listBookmarksQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const articleIdParamsSchema = z.object({
  articleId: z.string(),
});

// --- Routes ---

const createBookmarksRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // List bookmarks
    fastify.route({
      method: "GET",
      url: "/bookmarks",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: listBookmarksQuerySchema,
        response: {
          200: bookmarksPageSchema,
        },
      },
      handler: async (req) => {
        const bookmarksService = services.get(BookmarksService);
        return await bookmarksService.listByUser(req.user.sub, {
          offset: req.query.offset,
          limit: req.query.limit,
        });
      },
    });

    // Check if an article is bookmarked
    fastify.route({
      method: "GET",
      url: "/articles/:articleId/bookmark",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleIdParamsSchema,
        response: {
          200: z.object({ bookmarked: z.boolean() }),
        },
      },
      handler: async (req) => {
        const bookmarksService = services.get(BookmarksService);
        const bookmarked = await bookmarksService.isBookmarked(
          req.user.sub,
          req.params.articleId,
        );
        return { bookmarked };
      },
    });

    // Check bookmark status for multiple articles
    fastify.route({
      method: "POST",
      url: "/bookmarks/check",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: z.object({ articleIds: z.array(z.string()) }),
        response: {
          200: z.object({ bookmarkedIds: z.array(z.string()) }),
        },
      },
      handler: async (req) => {
        const bookmarksService = services.get(BookmarksService);
        const ids = await bookmarksService.getBookmarkedArticleIds(
          req.user.sub,
          req.body.articleIds,
        );
        return { bookmarkedIds: [...ids] };
      },
    });

    // Save an article by URL (creates article + auto-bookmarks)
    fastify.route({
      method: "POST",
      url: "/bookmarks/save",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: z.object({ url: z.url() }),
        response: {
          201: z.object({
            bookmark: bookmarkResponseSchema,
            articleId: z.string(),
            sourceId: z.string(),
          }),
        },
      },
      handler: async (req, reply) => {
        const bookmarksService = services.get(BookmarksService);
        const result = await bookmarksService.saveUrl(req.user.sub, req.body.url);
        return reply.code(201).send(result);
      },
    });

    // Bookmark an article
    fastify.route({
      method: "PUT",
      url: "/articles/:articleId/bookmark",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleIdParamsSchema,
        response: {
          200: bookmarkResponseSchema,
        },
      },
      handler: async (req) => {
        const bookmarksService = services.get(BookmarksService);
        return await bookmarksService.add(req.user.sub, req.params.articleId);
      },
    });

    // Remove bookmark
    fastify.route({
      method: "DELETE",
      url: "/articles/:articleId/bookmark",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleIdParamsSchema,
        response: {
          204: z.undefined(),
        },
      },
      handler: async (req, reply) => {
        const bookmarksService = services.get(BookmarksService);
        await bookmarksService.remove(req.user.sub, req.params.articleId);
        return reply.code(204).send();
      },
    });
  };

export { createBookmarksRoutes };
