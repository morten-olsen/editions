import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { DatabaseService } from '../database/database.ts';
import { SourceNotFoundError, SourcesService } from '../sources/sources.ts';
import { ArticleNotFoundForVoteError, VotesService } from '../votes/votes.ts';
import type { Services } from '../services/services.ts';

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

const updateProgressBodySchema = z.object({
  progress: z.number().min(0).max(1),
});

const progressResponseSchema = z.object({
  id: z.string(),
  progress: z.number(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const articleFocusClassificationSchema = z.object({
  focusId: z.string(),
  focusName: z.string(),
  focusIcon: z.string().nullable(),
  confidence: z.number(),
  similarity: z.number().nullable(),
  nli: z.number().nullable(),
  assignedAt: z.string(),
});

// --- Route registration helpers ---

const registerVoteRoutes = (
  fastify: Parameters<FastifyPluginAsyncZod>[0],
  services: Services,
  authenticate: ReturnType<typeof createAuthHook>,
): void => {
  // Get global vote on an article
  fastify.route({
    method: 'GET',
    url: '/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleVoteParamsSchema,
      response: { 200: voteResponseSchema, 204: z.undefined() },
    },
    handler: async (req, reply) => {
      const votesService = services.get(VotesService);
      const vote = await votesService.getForArticle(req.user.sub, req.params.articleId, null);
      if (!vote) {
        return reply.code(204).send();
      }
      return vote;
    },
  });

  // Upsert global vote on an article
  fastify.route({
    method: 'PUT',
    url: '/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleVoteParamsSchema,
      body: upsertVoteBodySchema,
      response: { 200: voteResponseSchema, 404: errorResponseSchema },
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
    method: 'DELETE',
    url: '/articles/:articleId/vote',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleVoteParamsSchema,
      response: { 204: z.undefined() },
    },
    handler: async (req, reply) => {
      const votesService = services.get(VotesService);
      await votesService.remove(req.user.sub, req.params.articleId, null);
      return reply.code(204).send();
    },
  });
};

const registerProgressRoute = (
  fastify: Parameters<FastifyPluginAsyncZod>[0],
  services: Services,
  authenticate: ReturnType<typeof createAuthHook>,
): void => {
  // Update playback / reading progress on an article (0.0-1.0)
  fastify.route({
    method: 'PATCH',
    url: '/articles/:articleId/progress',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleVoteParamsSchema,
      body: updateProgressBodySchema,
      response: { 200: progressResponseSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const sources = services.get(SourcesService);
      try {
        const article = await sources.setArticleProgress(req.user.sub, req.params.articleId, req.body.progress);
        return { id: article.id, progress: article.progress };
      } catch (err) {
        if (err instanceof SourceNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerFocusClassificationsRoute = (
  fastify: Parameters<FastifyPluginAsyncZod>[0],
  services: Services,
  authenticate: ReturnType<typeof createAuthHook>,
): void => {
  fastify.route({
    method: 'GET',
    url: '/articles/:articleId/focuses',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleVoteParamsSchema,
      response: {
        200: z.array(articleFocusClassificationSchema),
      },
    },
    handler: async (req) => {
      const db = await services.get(DatabaseService).getInstance();

      const rows = await db
        .selectFrom('article_focuses')
        .innerJoin('focuses', 'focuses.id', 'article_focuses.focus_id')
        .select([
          'focuses.id as focus_id',
          'focuses.name as focus_name',
          'focuses.icon as focus_icon',
          'article_focuses.similarity',
          'article_focuses.nli',
          'article_focuses.assigned_at',
        ])
        .where('article_focuses.article_id', '=', req.params.articleId)
        .where('focuses.user_id', '=', req.user.sub)
        .orderBy(db.fn('COALESCE', ['article_focuses.nli', 'article_focuses.similarity']), 'desc')
        .execute();

      return rows.map((row) => ({
        focusId: row.focus_id,
        focusName: row.focus_name,
        focusIcon: row.focus_icon,
        confidence: (row.nli as number | null) ?? (row.similarity as number | null) ?? 0,
        similarity: row.similarity as number | null,
        nli: row.nli as number | null,
        assignedAt: row.assigned_at,
      }));
    },
  });
};

// --- Main plugin ---

const createArticlesRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    registerVoteRoutes(fastify, services, authenticate);
    registerProgressRoute(fastify, services, authenticate);
    registerFocusClassificationsRoute(fastify, services, authenticate);
  };

export { createArticlesRoutes };
