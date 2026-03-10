import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import {
  ArticleNotFoundForVoteError,
  VotesService,
} from "../votes/votes.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const articleVoteParamsSchema = z.object({
  articleId: z.string(),
});

const upsertVoteBodySchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

const voteResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  focusId: z.string().nullable(),
  editionId: z.string().nullable(),
  value: z.union([z.literal(1), z.literal(-1)]),
  createdAt: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// --- Routes ---

const createArticlesRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // Get global vote on an article
    fastify.route({
      method: "GET",
      url: "/articles/:articleId/vote",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleVoteParamsSchema,
        response: {
          200: voteResponseSchema,
          204: z.undefined(),
        },
      },
      handler: async (req, reply) => {
        const votesService = services.get(VotesService);
        const vote = await votesService.getForArticle(
          req.user.sub,
          req.params.articleId,
          null,
        );
        if (!vote) {
          return reply.code(204).send();
        }
        return vote;
      },
    });

    // Upsert global vote on an article
    fastify.route({
      method: "PUT",
      url: "/articles/:articleId/vote",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleVoteParamsSchema,
        body: upsertVoteBodySchema,
        response: {
          200: voteResponseSchema,
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

    // Remove global vote on an article
    fastify.route({
      method: "DELETE",
      url: "/articles/:articleId/vote",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: articleVoteParamsSchema,
        response: {
          204: z.undefined(),
        },
      },
      handler: async (req, reply) => {
        const votesService = services.get(VotesService);
        await votesService.remove(req.user.sub, req.params.articleId, null);
        return reply.code(204).send();
      },
    });
  };

export { createArticlesRoutes };
