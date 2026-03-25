import crypto from 'node:crypto';

import Stripe from 'stripe';

import { ConfigService } from '../config/config.ts';
import { DatabaseService } from '../database/database.ts';
import { Services } from '../services/services.ts';

import type { AccessState, AccessStatus, PaymentSettings, UpdatePaymentSettings } from './billing.schemas.ts';

// --- Constants ---

const PAYMENT_SETTINGS_KEY = 'payment';

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  enabled: false,
  trialDays: 14,
  monthlyPriceCents: 0,
  yearlyPriceCents: 0,
  monthlyStripePriceId: '',
  yearlyStripePriceId: '',
  stripeProductId: '',
};

// --- Errors ---

class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured — Stripe keys are missing');
    this.name = 'BillingNotConfiguredError';
  }
}

class AccessExpiredError extends Error {
  constructor() {
    super('Access expired — subscription or trial required');
    this.name = 'AccessExpiredError';
  }
}

type AdminUserView = {
  id: string;
  username: string;
  role: string;
  accessExpiresAt: string | null;
  state: AccessState;
  subscription: { status: string; interval: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
};

// --- Service ---

class BillingService {
  #services: Services;
  #stripe: Stripe | null = null;
  #paymentEnabledCache: boolean | null = null;

  constructor(services: Services) {
    this.#services = services;
  }

  #getStripe = (): Stripe => {
    if (this.#stripe) return this.#stripe;
    const config = this.#services.get(ConfigService).config.stripe;
    if (!config.secretKey) {
      throw new BillingNotConfiguredError();
    }
    this.#stripe = new Stripe(config.secretKey);
    return this.#stripe;
  };

  isStripeConfigured = (): boolean => {
    const config = this.#services.get(ConfigService).config.stripe;
    return Boolean(config.secretKey);
  };

  isPaymentEnabled = async (): Promise<boolean> => {
    if (!this.isStripeConfigured()) return false;
    if (this.#paymentEnabledCache !== null) return this.#paymentEnabledCache;
    const settings = await this.getSettings();
    this.#paymentEnabledCache = settings.enabled;
    return this.#paymentEnabledCache;
  };

  // --- Access assertion ---

  assertAccess = async (userId: string): Promise<void> => {
    if (!(await this.isPaymentEnabled())) return;
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db.selectFrom('users').select('access_expires_at').where('id', '=', userId).executeTakeFirst();
    if (!user) throw new AccessExpiredError();
    if (user.access_expires_at === null) return; // unlimited
    if (new Date(user.access_expires_at).getTime() > Date.now()) return; // still active
    throw new AccessExpiredError();
  };

  // --- Settings ---

  getSettings = async (): Promise<PaymentSettings> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const row = await db.selectFrom('settings').select('value').where('key', '=', PAYMENT_SETTINGS_KEY).executeTakeFirst();
    if (!row) return { ...DEFAULT_PAYMENT_SETTINGS };
    return { ...DEFAULT_PAYMENT_SETTINGS, ...(JSON.parse(row.value) as Partial<PaymentSettings>) };
  };

  updateSettings = async (patch: UpdatePaymentSettings): Promise<PaymentSettings> => {
    const current = await this.getSettings();

    const hasPriceChanges =
      (patch.monthlyPriceCents !== undefined && patch.monthlyPriceCents !== current.monthlyPriceCents) ||
      (patch.yearlyPriceCents !== undefined && patch.yearlyPriceCents !== current.yearlyPriceCents);

    let productId = current.stripeProductId;
    let monthlyPriceId = current.monthlyStripePriceId;
    let yearlyPriceId = current.yearlyStripePriceId;

    // Only touch Stripe when prices actually change
    if (hasPriceChanges) {
      const stripe = this.#getStripe();

      // Ensure we have a Stripe product
      if (!productId) {
        const product = await stripe.products.create({ name: 'Editions Subscription' });
        productId = product.id;
      }

      // Handle monthly price change
      if (patch.monthlyPriceCents !== undefined && patch.monthlyPriceCents !== current.monthlyPriceCents) {
        if (patch.monthlyPriceCents > 0) {
          const price = await stripe.prices.create({
            product: productId,
            unit_amount: patch.monthlyPriceCents,
            currency: 'usd',
            recurring: { interval: 'month' },
          });
          monthlyPriceId = price.id;
        } else {
          monthlyPriceId = '';
        }
        if (current.monthlyStripePriceId) {
          await stripe.prices.update(current.monthlyStripePriceId, { active: false });
        }
      }

      // Handle yearly price change
      if (patch.yearlyPriceCents !== undefined && patch.yearlyPriceCents !== current.yearlyPriceCents) {
        if (patch.yearlyPriceCents > 0) {
          const price = await stripe.prices.create({
            product: productId,
            unit_amount: patch.yearlyPriceCents,
            currency: 'usd',
            recurring: { interval: 'year' },
          });
          yearlyPriceId = price.id;
        } else {
          yearlyPriceId = '';
        }
        if (current.yearlyStripePriceId) {
          await stripe.prices.update(current.yearlyStripePriceId, { active: false });
        }
      }
    }

    const updated: PaymentSettings = {
      enabled: patch.enabled ?? current.enabled,
      trialDays: patch.trialDays ?? current.trialDays,
      monthlyPriceCents: patch.monthlyPriceCents ?? current.monthlyPriceCents,
      yearlyPriceCents: patch.yearlyPriceCents ?? current.yearlyPriceCents,
      monthlyStripePriceId: monthlyPriceId,
      yearlyStripePriceId: yearlyPriceId,
      stripeProductId: productId,
    };

    const db = await this.#services.get(DatabaseService).getInstance();
    const value = JSON.stringify(updated);
    await db
      .insertInto('settings')
      .values({ key: PAYMENT_SETTINGS_KEY, value, updated_at: new Date().toISOString() })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: new Date().toISOString() }))
      .execute();

    this.#paymentEnabledCache = updated.enabled;
    return updated;
  };

  // --- Access status ---

  getAccessStatus = async (userId: string): Promise<AccessStatus> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db.selectFrom('users').select('access_expires_at').where('id', '=', userId).executeTakeFirst();
    if (!user) return { state: 'expired', expiresAt: null, daysRemaining: null };
    return this.#computeAccessStatus(user.access_expires_at);
  };

  #computeAccessStatus = (expiresAt: string | null): AccessStatus => {
    if (expiresAt === null) {
      return { state: 'unlimited', expiresAt: null, daysRemaining: null };
    }

    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expires - now) / (1000 * 60 * 60 * 24)));

    if (expires <= now) {
      return { state: 'expired', expiresAt, daysRemaining: 0 };
    }

    // Check if user has an active subscription to distinguish trial from active
    // For simplicity, we return 'active' or 'trial' based on whether a subscription exists
    // This is refined in getAccessStatusWithSubscription
    return { state: 'active', expiresAt, daysRemaining };
  };

  getAccessStatusWithSubscription = async (userId: string): Promise<{ access: AccessStatus; hasSubscription: boolean }> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db.selectFrom('users').select('access_expires_at').where('id', '=', userId).executeTakeFirst();
    if (!user) return { access: { state: 'expired', expiresAt: null, daysRemaining: null }, hasSubscription: false };

    const sub = await db
      .selectFrom('subscriptions')
      .select('status')
      .where('user_id', '=', userId)
      .where('status', 'in', ['active', 'past_due'])
      .executeTakeFirst();

    const access = this.#computeAccessStatus(user.access_expires_at);
    if (!sub && access.state === 'active') {
      // Active access without subscription = trial
      return { access: { ...access, state: 'trial' }, hasSubscription: false };
    }
    return { access, hasSubscription: Boolean(sub) };
  };

  // --- Stripe customer ---

  getOrCreateCustomer = async (userId: string): Promise<string> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db
      .selectFrom('users')
      .select(['stripe_customer_id', 'username'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();

    if (user.stripe_customer_id) return user.stripe_customer_id;

    const stripe = this.#getStripe();
    const customer = await stripe.customers.create({
      metadata: { editions_user_id: userId, username: user.username },
    });

    await db.updateTable('users').set({ stripe_customer_id: customer.id }).where('id', '=', userId).execute();
    return customer.id;
  };

  // --- Checkout ---

  createCheckoutSession = async ({
    userId,
    interval,
    successUrl,
    cancelUrl,
  }: {
    userId: string;
    interval: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> => {
    const stripe = this.#getStripe();
    const settings = await this.getSettings();
    const priceId = interval === 'monthly' ? settings.monthlyStripePriceId : settings.yearlyStripePriceId;

    if (!priceId) {
      throw new Error(`No ${interval} price configured`);
    }

    const customerId = await this.getOrCreateCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { editions_user_id: userId },
    });

    if (!session.url) throw new Error('Failed to create checkout session');
    return session.url;
  };

  // --- Customer Portal ---

  createPortalSession = async ({ userId, returnUrl }: { userId: string; returnUrl: string }): Promise<string> => {
    const stripe = this.#getStripe();
    const customerId = await this.getOrCreateCustomer(userId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  };

  // --- Webhooks ---

  handleWebhookEvent = async (rawBody: string | Buffer, signature: string): Promise<void> => {
    const stripe = this.#getStripe();
    const webhookSecret = this.#services.get(ConfigService).config.stripe.webhookSecret;

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.#handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await this.#handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.#handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.#handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.#handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  };

  #handleCheckoutCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
    const userId = session.metadata?.['editions_user_id'];
    if (!userId || !session.subscription) return;

    const stripe = this.#getStripe();
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) return;

    await this.#upsertSubscription(userId, sub, item);
  };

  #getSubscriptionIdFromInvoice = (invoice: Stripe.Invoice): string | null => {
    const subDetails = invoice.parent?.subscription_details;
    if (!subDetails) return null;
    return typeof subDetails.subscription === 'string' ? subDetails.subscription : subDetails.subscription.id;
  };

  #handleInvoicePaid = async (invoice: Stripe.Invoice): Promise<void> => {
    const subscriptionId = this.#getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;

    const stripe = this.#getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) return;

    const db = await this.#services.get(DatabaseService).getInstance();
    const existing = await db
      .selectFrom('subscriptions')
      .select('user_id')
      .where('stripe_subscription_id', '=', subscriptionId)
      .executeTakeFirst();

    if (existing) {
      await this.#upsertSubscription(existing.user_id, sub, item);
    }
  };

  #handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
    const subscriptionId = this.#getSubscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;

    const db = await this.#services.get(DatabaseService).getInstance();
    await db
      .updateTable('subscriptions')
      .set({ status: 'past_due', updated_at: new Date().toISOString() })
      .where('stripe_subscription_id', '=', subscriptionId)
      .execute();
  };

  #handleSubscriptionUpdated = async (sub: Stripe.Subscription): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const existing = await db
      .selectFrom('subscriptions')
      .select('user_id')
      .where('stripe_subscription_id', '=', sub.id)
      .executeTakeFirst();

    if (!existing) return;

    const item = sub.items.data[0];
    if (!item) return;

    await this.#upsertSubscription(existing.user_id, sub, item);
  };

  #handleSubscriptionDeleted = async (sub: Stripe.Subscription): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await db
      .updateTable('subscriptions')
      .set({ status: 'cancelled', updated_at: new Date().toISOString() })
      .where('stripe_subscription_id', '=', sub.id)
      .execute();
    // access_expires_at stays at current_period_end — runs out naturally
  };

  #upsertSubscription = async (userId: string, sub: Stripe.Subscription, item: Stripe.SubscriptionItem): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const now = new Date().toISOString();
    const periodEnd = new Date(item.current_period_end * 1000).toISOString();
    const periodStart = new Date(item.current_period_start * 1000).toISOString();
    const interval = item.price.recurring?.interval === 'year' ? 'yearly' : 'monthly';
    const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'active';

    await db
      .insertInto('subscriptions')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: item.price.id,
        status,
        interval,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          stripe_subscription_id: sub.id,
          stripe_price_id: item.price.id,
          status,
          interval,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
          updated_at: now,
        }),
      )
      .execute();

    // Extend access — only if this would extend it, never shorten
    await db
      .updateTable('users')
      .set({ access_expires_at: periodEnd })
      .where('id', '=', userId)
      .where((eb) => eb.or([eb('access_expires_at', 'is', null), eb('access_expires_at', '<', periodEnd)]))
      .execute();
  };

  // --- Admin: user access management ---

  adminSetAccess = async (userId: string, expiresAt: string | null): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    await db.updateTable('users').set({ access_expires_at: expiresAt }).where('id', '=', userId).execute();
  };

  adminCancelSubscription = async (userId: string): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const sub = await db
      .selectFrom('subscriptions')
      .select('stripe_subscription_id')
      .where('user_id', '=', userId)
      .where('status', 'in', ['active', 'past_due'])
      .executeTakeFirst();

    if (!sub) return;

    const stripe = this.#getStripe();
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);

    await db
      .updateTable('subscriptions')
      .set({ status: 'cancelled', updated_at: new Date().toISOString() })
      .where('user_id', '=', userId)
      .execute();
  };

  #formatUserAccess = (
    u: { id: string; username: string; role: string; access_expires_at: string | null },
    sub: { status: string; interval: string; current_period_end: string; cancel_at_period_end: number } | undefined,
  ): AdminUserView => {
    const access = this.#computeAccessStatus(u.access_expires_at);
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      accessExpiresAt: u.access_expires_at,
      state: (!sub && access.state === 'active' ? 'trial' : access.state) as AccessState,
      subscription: sub
        ? {
            status: sub.status,
            interval: sub.interval,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          }
        : null,
    };
  };

  adminListUsers = async (): Promise<AdminUserView[]> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const users = await db.selectFrom('users').select(['id', 'username', 'role', 'access_expires_at']).execute();
    const subs = await db.selectFrom('subscriptions').selectAll().execute();
    const subsByUser = new Map(subs.map((s) => [s.user_id, s]));
    return users.map((u) => this.#formatUserAccess(u, subsByUser.get(u.id)));
  };

  adminGetUser = async (userId: string): Promise<AdminUserView | null> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db
      .selectFrom('users')
      .select(['id', 'username', 'role', 'access_expires_at'])
      .where('id', '=', userId)
      .executeTakeFirst();
    if (!user) return null;
    const sub = await db.selectFrom('subscriptions').selectAll().where('user_id', '=', userId).executeTakeFirst();
    return this.#formatUserAccess(user, sub);
  };

  // --- Trial setup ---

  applyTrial = async (userId: string): Promise<void> => {
    if (!(await this.isPaymentEnabled())) return;
    const settings = await this.getSettings();
    if (settings.trialDays <= 0) return;

    const expiresAt = new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000).toISOString();
    const db = await this.#services.get(DatabaseService).getInstance();
    await db.updateTable('users').set({ access_expires_at: expiresAt }).where('id', '=', userId).execute();
  };
}

export { BillingService, BillingNotConfiguredError, AccessExpiredError };
