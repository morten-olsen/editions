import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { DatabaseService } from '../database/database.ts';
import type { RefreshSourcePayload, ReanalyseSourcePayload, ReanalyseAllPayload } from '../jobs/jobs.handlers.ts';
import { JobService } from '../jobs/jobs.ts';
import type { Services } from '../services/services.ts';
import { SourceNotFoundError, SourcesService } from '../sources/sources.ts';
import { buildOpml, parseOpml } from '../sources/sources.opml.ts';

import {
  sourceSchema,
  createSourceSchema,
  updateSourceSchema,
  errorResponseSchema,
  idParamSchema,
  articlesPageSchema,
  articleDetailSchema,
  articleIdParamSchema,
  paginationQuerySchema,
  jobResponseSchema,
  opmlImportResultSchema,
} from './sources.routes.schemas.ts';

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
};

// --- Route registration helpers ---

const registerSourceReadRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List sources
  fastify.route({
    method: 'GET',
    url: '/sources',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 200: z.array(sourceSchema) },
    },
    handler: async (req, _reply) => {
      const sources = services.get(SourcesService);
      return sources.list(req.user.sub);
    },
  });

  // Classification stats per source (focus distribution)
  fastify.route({
    method: 'GET',
    url: '/sources/classification-stats',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: z.array(
          z.object({
            sourceId: z.string(),
            focuses: z.array(
              z.object({
                focusId: z.string(),
                focusName: z.string(),
                articleCount: z.number(),
                avgConfidence: z.number(),
              }),
            ),
          }),
        ),
      },
    },
    handler: async (req, _reply) => {
      const sources = services.get(SourcesService);
      return sources.getClassificationStats(req.user.sub);
    },
  });

  // Get source
  fastify.route({
    method: 'GET',
    url: '/sources/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 200: sourceSchema, 404: errorResponseSchema },
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
};

const registerSourceWriteRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Create source
  fastify.route({
    method: 'POST',
    url: '/sources',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: createSourceSchema,
      response: { 201: sourceSchema },
    },
    handler: async (req, reply) => {
      const sources = services.get(SourcesService);
      const source = await sources.create({
        userId: req.user.sub,
        name: req.body.name,
        url: req.body.url,
        type: req.body.type,
        direction: req.body.direction,
      });
      return reply.code(201).send(source);
    },
  });

  // Update source
  fastify.route({
    method: 'PATCH',
    url: '/sources/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: updateSourceSchema,
      response: { 200: sourceSchema, 404: errorResponseSchema },
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
    method: 'DELETE',
    url: '/sources/:id',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 204: z.undefined(), 400: errorResponseSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const sources = services.get(SourcesService);
      try {
        const source = await sources.get(req.user.sub, req.params.id);
        if (source.type === 'bookmarks') {
          return reply.code(400).send({ error: 'Cannot delete the built-in bookmarks source' });
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
};

const registerArticleRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List articles for a source
  fastify.route({
    method: 'GET',
    url: '/sources/:id/articles',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      querystring: paginationQuerySchema,
      response: { 200: articlesPageSchema, 404: errorResponseSchema },
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
    method: 'GET',
    url: '/sources/:id/articles/:articleId',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleIdParamSchema,
      response: { 200: articleDetailSchema, 404: errorResponseSchema },
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
    method: 'PUT',
    url: '/sources/:id/articles/:articleId/read',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: articleIdParamSchema,
      body: z.object({ read: z.boolean() }),
      response: { 200: articleDetailSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const sources = services.get(SourcesService);
      try {
        return await sources.setArticleReadStatus(req.user.sub, req.params.articleId, req.body.read);
      } catch (err) {
        if (err instanceof SourceNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerFetchRoute = ({ fastify, services, authenticate }: RouteArgs): void => {
  fastify.route({
    method: 'POST',
    url: '/sources/:id/fetch',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      response: { 202: jobResponseSchema, 400: errorResponseSchema, 404: errorResponseSchema },
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

      if (source.type === 'bookmarks') {
        return reply.code(400).send({ error: 'Cannot fetch a bookmarks source' });
      }

      const jobService = services.get(JobService);
      const job = jobService.enqueue<RefreshSourcePayload>(
        'refresh_source',
        { sourceId: req.params.id, userId: req.user.sub },
        { userId: req.user.sub, affects: { sourceIds: [req.params.id] } },
      );

      return reply.code(202).send({ jobId: job.id, status: job.status });
    },
  });
};

const registerReanalyseRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Reanalyse all articles in a source
  fastify.route({
    method: 'POST',
    url: '/sources/:id/reanalyse',
    onRequest: authenticate,
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

      const db = await services.get(DatabaseService).getInstance();
      const result = await db
        .selectFrom('articles')
        .select(db.fn.countAll().as('count'))
        .where('source_id', '=', req.params.id)
        .where('extracted_at', 'is not', null)
        .executeTakeFirstOrThrow();

      const count = Number(result.count);
      if (count > 0) {
        services
          .get(JobService)
          .enqueue<ReanalyseSourcePayload>(
            'reanalyse_source',
            { sourceId: req.params.id },
            { userId: req.user.sub, affects: { sourceIds: [req.params.id] } },
          );
      }

      return reply.code(202).send({ enqueued: count });
    },
  });

  // Reanalyse all articles across all sources
  fastify.route({
    method: 'POST',
    url: '/sources/reanalyse-all',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 202: z.object({ enqueued: z.number() }) },
    },
    handler: async (req, reply) => {
      const db = await services.get(DatabaseService).getInstance();
      const result = await db
        .selectFrom('articles')
        .select(db.fn.countAll().as('count'))
        .where('extracted_at', 'is not', null)
        .executeTakeFirstOrThrow();

      const count = Number(result.count);
      if (count > 0) {
        services.get(JobService).enqueue<ReanalyseAllPayload>('reanalyse_all', {}, { userId: req.user.sub });
      }

      return reply.code(202).send({ enqueued: count });
    },
  });
};

const registerOpmlRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  // Export sources as OPML
  fastify.route({
    method: 'GET',
    url: '/sources/opml',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
    },
    handler: async (req, reply) => {
      const sources = services.get(SourcesService);
      const allSources = await sources.list(req.user.sub);
      const exportable = allSources.filter((s) => s.type !== 'bookmarks');
      const opml = buildOpml(exportable);
      return reply.type('application/xml').send(opml);
    },
  });

  // Import sources from OPML
  fastify.route({
    method: 'POST',
    url: '/sources/opml',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: z.object({ opml: z.string() }),
      response: { 200: opmlImportResultSchema, 400: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const outlines = parseOpml(req.body.opml);
      if (outlines.length === 0) {
        return reply.code(400).send({ error: 'No feeds found in the OPML file' });
      }

      const sourcesService = services.get(SourcesService);
      const existing = await sourcesService.list(req.user.sub);
      const existingUrls = new Set(existing.map((s) => normalizeUrl(s.url)));

      const results: { name: string; url: string; status: 'added' | 'skipped' }[] = [];
      let added = 0;
      let skipped = 0;

      for (const outline of outlines) {
        if (existingUrls.has(normalizeUrl(outline.xmlUrl))) {
          results.push({ name: outline.title, url: outline.xmlUrl, status: 'skipped' });
          skipped++;
          continue;
        }

        await sourcesService.create({
          userId: req.user.sub,
          name: outline.title,
          url: outline.xmlUrl,
          type: 'rss',
          direction: 'newest',
        });
        existingUrls.add(normalizeUrl(outline.xmlUrl));
        results.push({ name: outline.title, url: outline.xmlUrl, status: 'added' });
        added++;
      }

      return { added, skipped, sources: results };
    },
  });
};

const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Strip trailing slash and lowercase the host for comparison
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
};

// --- Main plugin ---

const createSourcesRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const args = { fastify, services, authenticate };

    registerOpmlRoutes(args);
    registerSourceReadRoutes(args);
    registerSourceWriteRoutes(args);
    registerArticleRoutes(args);
    registerFetchRoute(args);
    registerReanalyseRoutes(args);
  };

export { createSourcesRoutes };
