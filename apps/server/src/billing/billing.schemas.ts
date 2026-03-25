import { z } from 'zod/v4';

const accessState = z.enum(['active', 'trial', 'expired', 'unlimited']);

type AccessState = z.infer<typeof accessState>;

const accessStatusSchema = z.object({
  state: accessState,
  expiresAt: z.string().nullable(),
  daysRemaining: z.number().nullable(),
});

type AccessStatus = z.infer<typeof accessStatusSchema>;

const paymentSettingsSchema = z.object({
  enabled: z.boolean(),
  trialDays: z.number(),
  monthlyPriceCents: z.number(),
  yearlyPriceCents: z.number(),
  monthlyStripePriceId: z.string(),
  yearlyStripePriceId: z.string(),
  stripeProductId: z.string(),
});

type PaymentSettings = z.infer<typeof paymentSettingsSchema>;

const updatePaymentSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  trialDays: z.number().min(0).optional(),
  monthlyPriceCents: z.number().min(0).optional(),
  yearlyPriceCents: z.number().min(0).optional(),
});

type UpdatePaymentSettings = z.infer<typeof updatePaymentSettingsSchema>;

const checkoutRequestSchema = z.object({
  interval: z.enum(['monthly', 'yearly']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const checkoutResponseSchema = z.object({
  url: z.string(),
});

const portalRequestSchema = z.object({
  returnUrl: z.string().url(),
});

const portalResponseSchema = z.object({
  url: z.string(),
});

const adminUserAccessSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  accessExpiresAt: z.string().nullable(),
  state: accessState,
  subscription: z
    .object({
      status: z.string(),
      interval: z.string(),
      currentPeriodEnd: z.string(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
});

const adminSetAccessSchema = z.object({
  expiresAt: z.string().nullable(),
});

const subscriptionInfoSchema = z.object({
  status: z.string(),
  interval: z.string(),
  currentPeriodEnd: z.string(),
  cancelAtPeriodEnd: z.boolean(),
  stripePriceId: z.string(),
});

const pricingInfoSchema = z.object({
  monthlyPriceCents: z.number(),
  yearlyPriceCents: z.number(),
  trialDays: z.number(),
});

const userSubscriptionSchema = z.object({
  access: accessStatusSchema,
  subscription: subscriptionInfoSchema.nullable(),
  paymentEnabled: z.boolean(),
  pricing: pricingInfoSchema.nullable(),
});

export type { AccessState, AccessStatus, PaymentSettings, UpdatePaymentSettings };
export {
  accessState,
  accessStatusSchema,
  paymentSettingsSchema,
  updatePaymentSettingsSchema,
  checkoutRequestSchema,
  checkoutResponseSchema,
  portalRequestSchema,
  portalResponseSchema,
  adminUserAccessSchema,
  adminSetAccessSchema,
  subscriptionInfoSchema,
  userSubscriptionSchema,
};
