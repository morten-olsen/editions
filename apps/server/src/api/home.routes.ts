import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAuthHook } from '../auth/auth.middleware.ts';
import { HomeService } from '../editions/editions.home.ts';
import type { Services } from '../services/services.ts';

// --- Schemas ---

const homeSectionSchema = z.object({
  focusName: z.string(),
  articleCount: z.number(),
});

const homeLeadSchema = z.object({
  title: z.string(),
  sourceName: z.string(),
  imageUrl: z.string().nullable(),
  consumptionTimeSeconds: z.number().nullable(),
});

const homeHighlightSchema = z.object({
  title: z.string(),
  sourceName: z.string(),
});

const homeConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
});

const homeEditionSchema = z.object({
  id: z.string(),
  editionConfigId: z.string(),
  title: z.string(),
  totalReadingMinutes: z.number().nullable(),
  articleCount: z.number(),
  publishedAt: z.string(),
  configName: z.string(),
  configIcon: z.string().nullable(),
  sections: z.array(homeSectionSchema),
  lead: homeLeadSchema.nullable(),
  highlights: z.array(homeHighlightSchema),
});

const homeDataSchema = z.object({
  sourcesCount: z.number(),
  focusesCount: z.number(),
  configs: z.array(homeConfigSchema),
  editions: z.array(homeEditionSchema),
});

// --- Routes ---

const createHomeRoutes = (services: Services): FastifyPluginAsyncZod => {
  const authenticate = createAuthHook(services);

  return async (fastify) => {
    fastify.route({
      method: 'GET',
      url: '/home',
      schema: {
        response: {
          200: homeDataSchema,
        },
      },
      onRequest: authenticate,
      handler: async (req, _reply) => {
        const home = services.get(HomeService);
        return home.getHomeData(req.user.sub);
      },
    });
  };
};

export { createHomeRoutes };
