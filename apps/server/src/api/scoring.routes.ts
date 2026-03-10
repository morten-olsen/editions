import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import { DatabaseService } from "../database/database.ts";
import { VotesService, defaultUserScoringWeights } from "../votes/votes.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const weightsSchema = z.object({
  alpha: z.number().min(0).max(1),
  beta: z.number().min(0).max(1),
  gamma: z.number().min(0).max(1),
});

const userScoringWeightsSchema = z.object({
  global: weightsSchema,
  focus: weightsSchema,
  edition: weightsSchema,
});

const scoringResponseSchema = z.object({
  weights: userScoringWeightsSchema,
  defaults: userScoringWeightsSchema,
  isCustom: z.boolean(),
});

// --- Routes ---

const createScoringRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    fastify.route({
      method: "GET",
      url: "/settings/scoring",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: scoringResponseSchema,
        },
      },
      handler: async (req, _reply) => {
        const db = await services.get(DatabaseService).getInstance();
        const row = await db
          .selectFrom("users")
          .select("scoring_weights")
          .where("id", "=", req.user.sub)
          .executeTakeFirst();

        const votesService = services.get(VotesService);
        const weights = await votesService.loadUserScoringWeights(req.user.sub);

        return {
          weights,
          defaults: defaultUserScoringWeights,
          isCustom: row?.scoring_weights != null,
        };
      },
    });

    fastify.route({
      method: "PUT",
      url: "/settings/scoring",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: userScoringWeightsSchema,
        response: {
          200: scoringResponseSchema,
        },
      },
      handler: async (req, _reply) => {
        const votesService = services.get(VotesService);
        await votesService.saveUserScoringWeights(req.user.sub, req.body);
        return {
          weights: req.body,
          defaults: defaultUserScoringWeights,
          isCustom: true,
        };
      },
    });

    fastify.route({
      method: "DELETE",
      url: "/settings/scoring",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: scoringResponseSchema,
        },
      },
      handler: async (req, _reply) => {
        const votesService = services.get(VotesService);
        await votesService.resetUserScoringWeights(req.user.sub);
        return {
          weights: defaultUserScoringWeights,
          defaults: defaultUserScoringWeights,
          isCustom: false,
        };
      },
    });
  };

export { createScoringRoutes };
