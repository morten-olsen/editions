import { z } from 'zod/v4';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { createAdminHook } from '../auth/admin.middleware.ts';
import { createAuthHook } from '../auth/auth.middleware.ts';
import { BillingService } from '../billing/billing.ts';
import { DatabaseService } from '../database/database.ts';
import {
  accessStatusSchema,
  checkoutRequestSchema,
  checkoutResponseSchema,
  portalRequestSchema,
  portalResponseSchema,
  paymentSettingsSchema,
  updatePaymentSettingsSchema,
  adminUserAccessSchema,
  adminSetAccessSchema,
  userSubscriptionSchema,
} from '../billing/billing.schemas.ts';
import type { Services } from '../services/services.ts';

const errorResponseSchema = z.object({ error: z.string() });

const createBillingRoutes =
  (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);
    const requireAdmin = createAdminHook();

    // --- User endpoints ---

    // Get current user's subscription info (access + subscription + payment status)
    fastify.route({
      method: 'GET',
      url: '/billing/subscription',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: userSubscriptionSchema },
      },
      handler: async (req, _reply) => {
        const billing = services.get(BillingService);
        const paymentEnabled = await billing.isPaymentEnabled();

        if (!paymentEnabled) {
          return {
            access: { state: 'unlimited' as const, expiresAt: null, daysRemaining: null },
            subscription: null,
            paymentEnabled: false,
            pricing: null,
          };
        }

        const { access } = await billing.getAccessStatusWithSubscription(req.user.sub);
        const settings = await billing.getSettings();
        const db = await services.get(DatabaseService).getInstance();

        const sub = await db
          .selectFrom('subscriptions')
          .selectAll()
          .where('user_id', '=', req.user.sub)
          .executeTakeFirst();

        return {
          access,
          subscription: sub
            ? {
                status: sub.status,
                interval: sub.interval,
                currentPeriodEnd: sub.current_period_end,
                cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
                stripePriceId: sub.stripe_price_id,
              }
            : null,
          paymentEnabled: true,
          pricing: {
            monthlyPriceCents: settings.monthlyPriceCents,
            yearlyPriceCents: settings.yearlyPriceCents,
            trialDays: settings.trialDays,
          },
        };
      },
    });

    // Get current user's access status
    fastify.route({
      method: 'GET',
      url: '/billing/access',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: accessStatusSchema },
      },
      handler: async (req, _reply) => {
        const billing = services.get(BillingService);
        if (!(await billing.isPaymentEnabled())) {
          return { state: 'unlimited' as const, expiresAt: null, daysRemaining: null };
        }
        const { access } = await billing.getAccessStatusWithSubscription(req.user.sub);
        return access;
      },
    });

    // Create checkout session
    fastify.route({
      method: 'POST',
      url: '/billing/checkout',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: checkoutRequestSchema,
        response: { 200: checkoutResponseSchema, 400: errorResponseSchema, 501: errorResponseSchema },
      },
      handler: async (req, reply) => {
        const billing = services.get(BillingService);
        try {
          const url = await billing.createCheckoutSession({
            userId: req.user.sub,
            interval: req.body.interval,
            successUrl: req.body.successUrl,
            cancelUrl: req.body.cancelUrl,
          });
          return { url };
        } catch (err) {
          if (err instanceof Error && err.message.includes('No ')) {
            return reply.code(400).send({ error: err.message });
          }
          throw err;
        }
      },
    });

    // Create portal session
    fastify.route({
      method: 'POST',
      url: '/billing/portal',
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        body: portalRequestSchema,
        response: { 200: portalResponseSchema, 501: errorResponseSchema },
      },
      handler: async (req, _reply) => {
        const billing = services.get(BillingService);
        const url = await billing.createPortalSession({
          userId: req.user.sub,
          returnUrl: req.body.returnUrl,
        });
        return { url };
      },
    });

    // Stripe webhook
    fastify.route({
      method: 'POST',
      url: '/billing/webhook',
      config: { rawBody: true },
      schema: {
        // No auth — Stripe signature verified in handler
        response: { 200: z.object({}), 400: errorResponseSchema },
      },
      handler: async (req, reply) => {
        const signature = req.headers['stripe-signature'];
        if (!signature || typeof signature !== 'string') {
          return reply.code(400).send({ error: 'Missing stripe-signature header' });
        }

        const billing = services.get(BillingService);
        try {
          // rawBody is available when fastify-raw-body is registered
          const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
          await billing.handleWebhookEvent(rawBody, signature);
          return {};
        } catch (err) {
          if (err instanceof Error && err.message.includes('signature')) {
            return reply.code(400).send({ error: 'Invalid webhook signature' });
          }
          throw err;
        }
      },
    });

    // --- Admin endpoints ---

    // Get billing settings
    fastify.route({
      method: 'GET',
      url: '/admin/billing/settings',
      onRequest: [authenticate, requireAdmin],
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: paymentSettingsSchema, 403: errorResponseSchema },
      },
      handler: async (_req, _reply) => {
        return services.get(BillingService).getSettings();
      },
    });

    // Update billing settings
    fastify.route({
      method: 'PUT',
      url: '/admin/billing/settings',
      onRequest: [authenticate, requireAdmin],
      schema: {
        security: [{ bearerAuth: [] }],
        body: updatePaymentSettingsSchema,
        response: { 200: paymentSettingsSchema, 403: errorResponseSchema, 501: errorResponseSchema },
      },
      handler: async (req, _reply) => {
        return services.get(BillingService).updateSettings(req.body);
      },
    });

    // List all users with access info
    fastify.route({
      method: 'GET',
      url: '/admin/billing/users',
      onRequest: [authenticate, requireAdmin],
      schema: {
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(adminUserAccessSchema), 403: errorResponseSchema },
      },
      handler: async (_req, _reply) => {
        return services.get(BillingService).adminListUsers();
      },
    });

    // Set user access expiry
    fastify.route({
      method: 'PUT',
      url: '/admin/billing/users/:userId/access',
      onRequest: [authenticate, requireAdmin],
      schema: {
        security: [{ bearerAuth: [] }],
        params: z.object({ userId: z.string() }),
        body: adminSetAccessSchema,
        response: { 200: adminUserAccessSchema, 403: errorResponseSchema, 404: errorResponseSchema },
      },
      handler: async (req, reply) => {
        const billing = services.get(BillingService);
        await billing.adminSetAccess(req.params.userId, req.body.expiresAt);
        const user = await billing.adminGetUser(req.params.userId);
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }
        return user;
      },
    });

    // Admin cancel a user's subscription
    fastify.route({
      method: 'DELETE',
      url: '/admin/billing/users/:userId/subscription',
      onRequest: [authenticate, requireAdmin],
      schema: {
        security: [{ bearerAuth: [] }],
        params: z.object({ userId: z.string() }),
        response: { 200: z.object({ success: z.boolean() }), 403: errorResponseSchema, 501: errorResponseSchema },
      },
      handler: async (req, _reply) => {
        await services.get(BillingService).adminCancelSubscription(req.params.userId);
        return { success: true };
      },
    });
  };

export { createBillingRoutes };
