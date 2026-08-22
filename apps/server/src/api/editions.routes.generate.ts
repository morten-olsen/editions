import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAccessHook } from '../auth/access.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import { EditionConfigNotFoundError, EditionError, EditionsService } from '../editions/editions.ts';
import type { Services } from '../services/services.ts';

import {
  editionDetailSchema,
  editionSummarySchema,
  errorResponseSchema,
  configIdParamSchema,
  listEditionsQuerySchema,
} from './editions.routes.schemas.ts';

// --- Types ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
  requireAccess: ReturnType<typeof createAccessHook>;
};

// --- Schemas ---

const previewBodySchema = z
  .object({
    lookbackHours: z.number().int().min(1).optional(),
    excludePriorEditions: z.boolean().optional(),
    focuses: z
      .array(
        z.object({
          focusId: z.string(),
          focusName: z.string(),
          position: z.number(),
          budgetType: z.enum(['time', 'count']).default('count'),
          budgetValue: z.number().default(10),
          lookbackHours: z.number().nullable().default(null),
          excludePriorEditions: z.boolean().nullable().default(null),
          weight: z.number().default(1),
        }),
      )
      .optional(),
  })
  .optional();

const previewResponseSchema = z.object({
  sections: z.array(
    z.object({
      focusName: z.string(),
      articles: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          sourceName: z.string(),
          consumptionTimeSeconds: z.number().nullable(),
        }),
      ),
    }),
  ),
  totalArticles: z.number(),
  totalReadingMinutes: z.number(),
});

// --- Route registration ---

const registerGenerateAndPreviewRoutes = ({ fastify, services, authenticate, requireAccess }: RouteArgs): void => {
  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/generate',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      response: { 201: editionDetailSchema, 404: errorResponseSchema, 400: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        const edition = await editions.generate(req.user.sub, req.params.configId);
        return reply.code(201).send(edition);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        if (err instanceof EditionError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  // Preview what a generated edition would look like (dry-run)
  fastify.route({
    method: 'POST',
    url: '/editions/configs/:configId/preview',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      body: previewBodySchema,
      response: {
        200: previewResponseSchema,
        400: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      try {
        return await editions.previewGenerate(req.user.sub, req.params.configId, req.body ?? undefined);
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        if (err instanceof EditionError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerEditionListRoute = ({ fastify, services, authenticate }: RouteArgs): void => {
  // List editions for a config (optional ?read=true|false filter)
  fastify.route({
    method: 'GET',
    url: '/editions/configs/:configId/editions',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: configIdParamSchema,
      querystring: listEditionsQuerySchema,
      response: { 200: z.array(editionSummarySchema), 404: errorResponseSchema },
    },
    handler: async (req, reply) => {
      const editions = services.get(EditionsService);
      const read = req.query.read === 'true' ? true : req.query.read === 'false' ? false : undefined;
      try {
        return await editions.listEditions(req.user.sub, req.params.configId, { read });
      } catch (err) {
        if (err instanceof EditionConfigNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

const registerGenerateRoutes = (args: RouteArgs): void => {
  registerGenerateAndPreviewRoutes(args);
  registerEditionListRoute(args);
};

export { registerGenerateRoutes };
