import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { ConfigService } from '../config/config.ts';
import type { Services } from '../services/services.ts';

const publicConfigSchema = z.object({
  allowSignups: z.boolean(),
});

const createConfigRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    fastify.route({
      method: 'GET',
      url: '/config',
      schema: {
        response: {
          200: publicConfigSchema,
        },
      },
      handler: async (_req, _reply) => {
        const config = services.get(ConfigService).config;
        return {
          allowSignups: config.auth.allowSignups,
        };
      },
    });
  };

export { createConfigRoutes };
