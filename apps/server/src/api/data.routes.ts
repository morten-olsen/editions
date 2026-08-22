import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAccessHook } from '../auth/access.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import {
  DataPortabilityService,
  UnsupportedExportVersionError,
  dataExportSchema,
  dataImportResultSchema,
} from '../data-portability/data-portability.ts';
import type { Services } from '../services/services.ts';

const errorResponseSchema = z.object({ error: z.string() });

const createDataRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const requireAccess = createAccessHook(services);
    const dataPortability = services.get(DataPortabilityService);

    // Export all user data. Deliberately NOT gated behind requireAccess —
    // users can always take their data with them, even with expired access.
    fastify.route({
      method: 'GET',
      url: '/data/export',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: dataExportSchema },
      },
      handler: async (req, _reply) => {
        return dataPortability.export(req.user.sub);
      },
    });

    // Import user data (replaces all existing data). Access-gated: it enqueues
    // a re-analysis job per imported focus.
    fastify.route({
      method: 'POST',
      url: '/data/import',
      bodyLimit: 50 * 1024 * 1024, // 50 MB — exports with embeddings can be large
      onRequest: [authenticate, requireAccess],
      schema: {
        security: [{ bearerAuth: [] }],
        body: dataExportSchema,
        response: { 200: dataImportResultSchema, 400: errorResponseSchema },
      },
      handler: async (req, reply) => {
        try {
          return await dataPortability.import(req.user.sub, req.body);
        } catch (err) {
          if (err instanceof UnsupportedExportVersionError) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
      },
    });
  };

export { createDataRoutes };
