import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAccessHook } from '../auth/access.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import { DiscoveryService, DiscoveryItemNotFoundError } from '../discovery/discovery.ts';
import type { Services } from '../services/services.ts';

// --- Schemas ---

const discoverySourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  coverImage: z.string().nullable(),
  adopted: z.boolean(),
});

const discoveryFocusSourceSchema = z.object({
  sourceId: z.string(),
  weight: z.number(),
});

const discoveryFocusSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  coverImage: z.string().nullable(),
  minConfidence: z.number(),
  sources: z.array(discoveryFocusSourceSchema),
  adopted: z.boolean(),
});

const discoveryEditionFocusSchema = z.object({
  focusId: z.string(),
  position: z.number(),
  budgetType: z.enum(['time', 'count']),
  budgetValue: z.number(),
  weight: z.number(),
});

const discoveryEditionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  coverImage: z.string().nullable(),
  schedule: z.string(),
  lookbackHours: z.number(),
  focuses: z.array(discoveryEditionFocusSchema),
  adopted: z.boolean(),
});

const adoptSourceResultSchema = z.object({
  sourceId: z.string(),
  created: z.boolean(),
});

const adoptFocusResultSchema = z.object({
  focusId: z.string(),
  created: z.boolean(),
  sourcesCreated: z.number(),
});

const adoptEditionConfigResultSchema = z.object({
  editionConfigId: z.string(),
  created: z.boolean(),
  focusesCreated: z.number(),
  sourcesCreated: z.number(),
});

const discoveryQuerySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const discoverySourcePageSchema = z.object({
  items: z.array(discoverySourceSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const discoveryFocusPageSchema = z.object({
  items: z.array(discoveryFocusSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const discoveryEditionConfigPageSchema = z.object({
  items: z.array(discoveryEditionConfigSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// --- Route helpers ---

type RouteArgs = {
  fastify: Parameters<FastifyPluginAsyncZod>[0];
  services: Services;
  authenticate: ReturnType<typeof createAuthHook>;
  requireAccess: ReturnType<typeof createAccessHook>;
};

const registerBrowseRoutes = ({ fastify, services, authenticate }: RouteArgs): void => {
  const discovery = services.get(DiscoveryService);

  fastify.route({
    method: 'GET',
    url: '/discovery/tags',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: { 200: z.array(z.string()) },
    },
    handler: async (_req, _reply) => {
      return discovery.listTags();
    },
  });

  fastify.route({
    method: 'GET',
    url: '/discovery/sources',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: discoveryQuerySchema,
      response: { 200: discoverySourcePageSchema },
    },
    handler: async (req, _reply) => {
      const status = await discovery.getAdoptionStatus(req.user.sub);
      const page = discovery.listSources(req.query);
      return {
        ...page,
        items: page.items.map((s) => ({
          ...s,
          adopted: status.adoptedSourceUrls.has(s.url),
        })),
      };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/discovery/focuses',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: discoveryQuerySchema,
      response: { 200: discoveryFocusPageSchema },
    },
    handler: async (req, _reply) => {
      const status = await discovery.getAdoptionStatus(req.user.sub);
      const page = discovery.listFocuses(req.query);
      return {
        ...page,
        items: page.items.map((f) => ({
          ...f,
          adopted: status.adoptedFocusOrigins.has(f.id),
        })),
      };
    },
  });

  fastify.route({
    method: 'GET',
    url: '/discovery/edition-configs',
    onRequest: authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: discoveryQuerySchema,
      response: { 200: discoveryEditionConfigPageSchema },
    },
    handler: async (req, _reply) => {
      const status = await discovery.getAdoptionStatus(req.user.sub);
      const page = discovery.listEditionConfigs(req.query);
      return {
        ...page,
        items: page.items.map((e) => ({
          ...e,
          adopted: status.adoptedEditionOrigins.has(e.id),
        })),
      };
    },
  });
};

const registerAdoptRoutes = ({ fastify, services, authenticate, requireAccess }: RouteArgs): void => {
  const discovery = services.get(DiscoveryService);

  fastify.route({
    method: 'POST',
    url: '/discovery/sources/:id/adopt',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: adoptSourceResultSchema,
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      try {
        return await discovery.adoptSource(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof DiscoveryItemNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  fastify.route({
    method: 'POST',
    url: '/discovery/focuses/:id/adopt',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: adoptFocusResultSchema,
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      try {
        return await discovery.adoptFocus(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof DiscoveryItemNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });

  fastify.route({
    method: 'POST',
    url: '/discovery/edition-configs/:id/adopt',
    onRequest: [authenticate, requireAccess],
    schema: {
      security: [{ bearerAuth: [] }],
      params: z.object({ id: z.string() }),
      response: {
        200: adoptEditionConfigResultSchema,
        404: errorResponseSchema,
      },
    },
    handler: async (req, reply) => {
      try {
        return await discovery.adoptEditionConfig(req.user.sub, req.params.id);
      } catch (err) {
        if (err instanceof DiscoveryItemNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  });
};

// --- Plugin factory ---

const createDiscoveryRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const requireAccess = createAccessHook(services);
    const args = { fastify, services, authenticate, requireAccess };

    registerBrowseRoutes(args);
    registerAdoptRoutes(args);
  };

export { createDiscoveryRoutes };
