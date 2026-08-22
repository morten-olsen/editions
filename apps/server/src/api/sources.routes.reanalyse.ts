import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAccessHook } from '../auth/access.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import { DatabaseService } from '../database/database.ts';
import { JobService } from '../jobs/jobs.ts';
import type { Services } from '../services/services.ts';
import { SourceNotFoundError, SourcesService } from '../sources/sources.ts';

import { errorResponseSchema, idParamSchema } from './sources.routes.schemas.ts';

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
  requireAccess: ReturnType<typeof createAccessHook>;
};

// --- Helpers ---

// Count extracted articles eligible for reanalysis (optionally scoped to a source)
const countAnalysableArticles = async (services: Services, sourceId?: string): Promise<number> => {
  const db = await services.get(DatabaseService).getInstance();
  let query = db.selectFrom('articles').select(db.fn.countAll().as('count')).where('extracted_at', 'is not', null);
  if (sourceId) {
    query = query.where('source_id', '=', sourceId);
  }
  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
};

// Count extracted articles eligible for re-extraction — podcasts are excluded
// because their content comes from the media file, not the article URL
const countReExtractableArticles = async (services: Services, sourceId?: string): Promise<number> => {
  const db = await services.get(DatabaseService).getInstance();
  let query = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .select(db.fn.countAll().as('count'))
    .where('sources.type', '!=', 'podcast')
    .where('articles.extracted_at', 'is not', null);
  if (sourceId) {
    query = query.where('articles.source_id', '=', sourceId);
  }
  const result = await query.executeTakeFirstOrThrow();
  return Number(result.count);
};

// --- Route registration ---

const registerSourceReanalyseRoutes = ({ fastify, services, authenticate, requireAccess }: RouteArgs): void => {
  // Reanalyse all articles in a source
  fastify.route({
    method: 'POST',
    url: '/sources/:id/reanalyse',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 202: z.object({ enqueued: z.number() }), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const sourcesService = services.get(SourcesService);
      try {
        await sourcesService.get(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof SourceNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }

      const count = await countAnalysableArticles(services, req.params.id);
      if (count > 0) {
        services
          .get(JobService)
          .enqueue(
            'reanalyse_source',
            { sourceId: req.params.id },
            { userId: req.user.sub, affects: { sourceIds: [req.params.id] } },
          );
      }

      return reply.code(202).send({ enqueued: count });
    },
  });

  // Re-extract all articles in a source (clear content + re-fetch from source URLs)
  fastify.route({
    method: 'POST',
    url: '/sources/:id/re-extract',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 202: z.object({ enqueued: z.number() }), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const sourcesService = services.get(SourcesService);
      try {
        await sourcesService.get(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof SourceNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }

      const count = await countReExtractableArticles(services, req.params.id);
      if (count > 0) {
        services
          .get(JobService)
          .enqueue(
            're_extract_source',
            { sourceId: req.params.id },
            { userId: req.user.sub, affects: { sourceIds: [req.params.id] } },
          );
      }

      return reply.code(202).send({ enqueued: count });
    },
  });
};

const registerGlobalReanalyseRoutes = ({ fastify, services, authenticate, requireAccess }: RouteArgs): void => {
  // Reanalyse all articles across all sources
  fastify.route({
    method: 'POST',
    url: '/sources/reanalyse-all',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 202: z.object({ enqueued: z.number() }) },
    },
    handler: async (req, reply) => {
      const count = await countAnalysableArticles(services);
      if (count > 0) {
        services.get(JobService).enqueue('reanalyse_all', {}, { userId: req.user.sub });
      }

      return reply.code(202).send({ enqueued: count });
    },
  });

  // Re-extract all articles (clear content + re-fetch from source URLs)
  fastify.route({
    method: 'POST',
    url: '/sources/re-extract-all',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 202: z.object({ enqueued: z.number() }) },
    },
    handler: async (req, reply) => {
      const count = await countReExtractableArticles(services);
      if (count > 0) {
        services.get(JobService).enqueue('re_extract_all', {}, { userId: req.user.sub });
      }

      return reply.code(202).send({ enqueued: count });
    },
  });
};

const registerReanalyseRoutes = (args: RouteArgs): void => {
  registerSourceReanalyseRoutes(args);
  registerGlobalReanalyseRoutes(args);
};

export { registerReanalyseRoutes };
