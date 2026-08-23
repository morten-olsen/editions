import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAccessHook } from '../auth/access.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import { EditionConfigNotFoundError, EditionsService } from '../editions/editions.ts';
import type { Services } from '../services/services.ts';

import {
  configIdParamSchema,
  editionSummaryPageSchema,
  errorResponseSchema,
  issueSweepBodySchema,
  issueSweepResultSchema,
  listEditionsQuerySchema,
} from './editions.routes.schemas.ts';

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
  requireAccess: ReturnType<typeof createAccessHook>;
};

// --- Routes ---

const registerIssueListRoute = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List issues of a config (optional ?read=true|false filter, paged)
  fastify.route({
    method: 'GET',
    url: '/editions/configs/:configId/editions',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      querystring: listEditionsQuerySchema,
      response: { 200: editionSummaryPageSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
      try {
        return await editions.listEditions(req.user.sub, req.params.configId, {
          read,
          offset: req.query.offset,
          limit: req.query.limit,
        });
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

/**
 * Preview and sweep take the same body so the count the user confirms comes from
 * the same selection the sweep acts on. Preview is a POST because the filter is a
 * nested object — same reasoning as `/api/bookmarks/check`.
 */
const registerIssueSweepRoutes = ({ fastify, services, authenticate, requireAccess }: RouteArgs): void => {
  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/issues/sweep/preview',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      body: issueSweepBodySchema,
      response: { 200: issueSweepResultSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.countIssueSweep(req.user.sub, req.params.configId, req.body.filter);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/issues/sweep',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      body: issueSweepBodySchema,
      response: { 200: issueSweepResultSchema, 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.runIssueSweep(req.user.sub, req.params.configId, {
          filter: req.body.filter,
          action: req.body.action,
        });
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerIssueRoutes = (args: RouteArgs): void => {
  registerIssueListRoute(args);
  registerIssueSweepRoutes(args);
};

export { registerIssueRoutes };
