import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import { VotesService } from "../votes/votes.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const voteWithArticleSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  focusId: z.string().nullable(),
  value: z.union([z.literal(1), z.literal(-1)]),
  createdAt: z.string(),
  articleTitle: z.string(),
  articleUrl: z.string().nullable(),
  sourceId: z.string(),
  sourceName: z.string(),
  focusName: z.string().nullable(),
});

const votesPageSchema = z.object({
  votes: z.array(voteWithArticleSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const listVotesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  scope: z.enum(["global", "focus"]).optional(),
  value: z.coerce.number().pipe(z.union([z.literal(1), z.literal(-1)])).optional(),
});

const voteIdParamsSchema = z.object({
  voteId: z.string(),
});

// --- Routes ---

const createVotesRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // List all votes for the current user
    fastify.route({
      method: "GET",
      url: "/votes",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: listVotesQuerySchema,
        response: {
          200: votesPageSchema,
        },
      },
      handler: async (req) => {
        const votesService = services.get(VotesService);
        return await votesService.listByUser(req.user.sub, {
          offset: req.query.offset,
          limit: req.query.limit,
          scope: req.query.scope,
          value: req.query.value,
        });
      },
    });

    // Delete a vote by id
    fastify.route({
      method: "DELETE",
      url: "/votes/:voteId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: voteIdParamsSchema,
        response: {
          204: z.undefined(),
          404: z.object({ error: z.string() }),
        },
      },
      handler: async (req, reply) => {
        const votesService = services.get(VotesService);
        const deleted = await votesService.removeById(req.user.sub, req.params.voteId);
        if (!deleted) {
          return reply.code(404).send({ error: "Vote not found" });
        }
        return reply.code(204).send();
      },
    });
  };

export { createVotesRoutes };
