import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { BillingService } from '../billing/billing.ts';
import { ConfigService } from '../config/config.ts';
import type { Services } from '../services/services.ts';

const publicConfigSchema = z.object({
  allowSignups: z.boolean(),
  paymentEnabled: z.boolean(),
  stripePublishableKey: z.string(),
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
        const paymentEnabled = await services.get(BillingService).isPaymentEnabled();
        return {
          allowSignups: config.auth.allowSignups,
          paymentEnabled,
          stripePublishableKey: config.stripe.publishableKey,
        };
      },
    });
  };

export { createConfigRoutes };
