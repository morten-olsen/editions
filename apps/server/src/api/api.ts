import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { Services } from '../services/services.ts';

import { createArticlesRoutes } from './articles.routes.ts';
import { createAuthRoutes } from './auth.routes.ts';
import { createBillingRoutes } from './billing.routes.ts';
import { createConfigRoutes } from './config.routes.ts';
import { createBookmarksRoutes } from './bookmarks.routes.ts';
import { createDataRoutes } from './data.routes.ts';
import { createDiscoveryRoutes } from './discovery.routes.ts';
import { createEditionsRoutes } from './editions.routes.ts';
import { createHomeRoutes } from './home.routes.ts';
import { createFeedRoutes } from './feed.routes.ts';
import { createFocusesRoutes } from './focuses.routes.ts';
import { createSourcesRoutes } from './sources.routes.ts';
import { createJobsRoutes } from './jobs.routes.ts';
import { createScoringRoutes } from './scoring.routes.ts';
import { createVotesRoutes } from './votes.routes.ts';

const healthRoute: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: 'GET',
    url: '/health',
    schema: {
      response: {
        200: z.object({
          status: z.string(),
        }),
      },
    },
    handler: async (_req, _reply) => {
      return { status: 'ok' };
    },
  });
};

const registerRoutes = async (fastify: Parameters<FastifyPluginAsyncZod>[0], services: Services): Promise<void> => {
  await fastify.register(
    async (api) => {
      await api.register(healthRoute);
      await api.register(createArticlesRoutes(services));
      await api.register(createAuthRoutes(services));
      await api.register(createConfigRoutes(services));
      await api.register(createBillingRoutes(services));
      await api.register(createBookmarksRoutes(services));
      await api.register(createDataRoutes(services));
      await api.register(createDiscoveryRoutes(services));
      await api.register(createSourcesRoutes(services));
      await api.register(createFocusesRoutes(services));
      await api.register(createEditionsRoutes(services));
      await api.register(createHomeRoutes(services));
      await api.register(createFeedRoutes(services));
      await api.register(createJobsRoutes(services));
      await api.register(createScoringRoutes(services));
      await api.register(createVotesRoutes(services));
    },
    { prefix: '/api' },
  );
};

export { registerRoutes };
