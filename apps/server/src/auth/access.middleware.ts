import type { FastifyReply, FastifyRequest } from 'fastify';

import { BillingService } from '../billing/billing.ts';
import type { Services } from '../services/services.ts';

const createAccessHook =
  (services: Services) =>
  async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Throws AccessExpiredError if expired — caught by the global error handler (402)
    await services.get(BillingService).assertAccess(req.user.sub);
  };

export { createAccessHook };
