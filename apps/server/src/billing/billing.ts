import Stripe from 'stripe';

import { ConfigService } from '../config/config.ts';
import { DatabaseService } from '../database/database.ts';
import { Services } from '../services/services.ts';

import type { AccessState, AccessStatus, PaymentSettings, UpdatePaymentSettings } from './billing.schemas.ts';
import { applyBillingWebhookEvent } from './billing.webhooks.ts';
import type { WebhookDeps } from './billing.webhooks.ts';

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

// --- Private helpers ---

// Create a new Stripe price for one billing interval when the configured
// amount changed, deactivating the previous price. Returns the price id to
// store ('' when the interval is disabled or was just disabled).
const syncIntervalPrice = async ({
  stripe,
  productId,
  interval,
  newCents,
  currentCents,
  currentPriceId,
}: {
  stripe: Stripe;
  productId: string;
  interval: 'month' | 'year';
  newCents: number | undefined;
  currentCents: number;
  currentPriceId: string;
}): Promise<string> => {
  if (newCents === undefined || newCents === currentCents) {
    return currentPriceId;
  }

  let priceId = '';
  if (newCents > 0) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: newCents,
      currency: 'usd',
      recurring: { interval },
    });
    priceId = price.id;
  }
  if (currentPriceId) {
    await stripe.prices.update(currentPriceId, { active: false });
  }
  return priceId;
};

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
    if (this.#stripe) {
      return this.#stripe;
    }
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
    if (!this.isStripeConfigured()) {
      return false;
    }
    if (this.#paymentEnabledCache !== null) {
      return this.#paymentEnabledCache;
    }
    const settings = await this.getSettings();
    this.#paymentEnabledCache = settings.enabled;
    return this.#paymentEnabledCache;
  };

  // --- Access assertion ---

  assertAccess = async (userId: string): Promise<void> => {
    if (!(await this.isPaymentEnabled())) {
      return;
    }
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db.selectFrom('users').select('access_expires_at').where('id', '=', userId).executeTakeFirst();
    if (!user) {
      throw new AccessExpiredError();
    }
    if (user.access_expires_at === null) {
      return;
    } // unlimited
    if (new Date(user.access_expires_at).getTime() > Date.now()) {
      return;
    } // still active
    throw new AccessExpiredError();
  };

  // --- Settings ---

  getSettings = async (): Promise<PaymentSettings> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const row = await db
      .selectFrom('settings')
      .select('value')
      .where('key', '=', PAYMENT_SETTINGS_KEY)
      .executeTakeFirst();
    if (!row) {
      return { ...DEFAULT_PAYMENT_SETTINGS };
    }
    return { ...DEFAULT_PAYMENT_SETTINGS, ...(JSON.parse(row.value) as Partial<PaymentSettings>) };
  };

  // Only touch Stripe when prices actually change
  #syncStripePrices = async (
    patch: UpdatePaymentSettings,
    current: PaymentSettings,
  ): Promise<{ productId: string; monthlyPriceId: string; yearlyPriceId: string }> => {
    const hasPriceChanges =
      (patch.monthlyPriceCents !== undefined && patch.monthlyPriceCents !== current.monthlyPriceCents) ||
      (patch.yearlyPriceCents !== undefined && patch.yearlyPriceCents !== current.yearlyPriceCents);

    if (!hasPriceChanges) {
      return {
        productId: current.stripeProductId,
        monthlyPriceId: current.monthlyStripePriceId,
        yearlyPriceId: current.yearlyStripePriceId,
      };
    }

    const stripe = this.#getStripe();

    // Ensure we have a Stripe product
    let productId = current.stripeProductId;
    if (!productId) {
      const product = await stripe.products.create({ name: 'Editions Subscription' });
      productId = product.id;
    }

    const monthlyPriceId = await syncIntervalPrice({
      stripe,
      productId,
      interval: 'month',
      newCents: patch.monthlyPriceCents,
      currentCents: current.monthlyPriceCents,
      currentPriceId: current.monthlyStripePriceId,
    });
    const yearlyPriceId = await syncIntervalPrice({
      stripe,
      productId,
      interval: 'year',
      newCents: patch.yearlyPriceCents,
      currentCents: current.yearlyPriceCents,
      currentPriceId: current.yearlyStripePriceId,
    });

    return { productId, monthlyPriceId, yearlyPriceId };
  };

  updateSettings = async (patch: UpdatePaymentSettings): Promise<PaymentSettings> => {
    const current = await this.getSettings();
    const { productId, monthlyPriceId, yearlyPriceId } = await this.#syncStripePrices(patch, current);

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
    if (!user) {
      return { state: 'expired', expiresAt: null, daysRemaining: null };
    }
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

  getAccessStatusWithSubscription = async (
    userId: string,
  ): Promise<{ access: AccessStatus; hasSubscription: boolean }> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const user = await db.selectFrom('users').select('access_expires_at').where('id', '=', userId).executeTakeFirst();
    if (!user) {
      return { access: { state: 'expired', expiresAt: null, daysRemaining: null }, hasSubscription: false };
    }

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

    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

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

    if (!session.url) {
      throw new Error('Failed to create checkout session');
    }
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

  // Verify half: signature check needs Stripe + the webhook secret
  handleWebhookEvent = async (rawBody: string | Buffer, signature: string): Promise<void> => {
    const stripe = this.#getStripe();
    const webhookSecret = this.#services.get(ConfigService).config.stripe.webhookSecret;

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    await this.applyWebhookEvent(event);
  };

  // Apply half: pure event routing — testable from a JSON fixture, no signature.
  // Event handling lives in billing.webhooks.ts.
  applyWebhookEvent = async (event: Stripe.Event): Promise<void> => {
    await applyBillingWebhookEvent(this.#webhookDeps(), event);
  };

  #webhookDeps = (): WebhookDeps => ({
    getDb: () => this.#services.get(DatabaseService).getInstance(),
    getStripe: this.#getStripe,
  });

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

    if (!sub) {
      return;
    }

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
    if (!user) {
      return null;
    }
    const sub = await db.selectFrom('subscriptions').selectAll().where('user_id', '=', userId).executeTakeFirst();
    return this.#formatUserAccess(user, sub);
  };

  // --- Trial setup ---

  applyTrial = async (userId: string): Promise<void> => {
    if (!(await this.isPaymentEnabled())) {
      return;
    }
    const settings = await this.getSettings();
    if (settings.trialDays <= 0) {
      return;
    }

    const expiresAt = new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000).toISOString();
    const db = await this.#services.get(DatabaseService).getInstance();
    await db.updateTable('users').set({ access_expires_at: expiresAt }).where('id', '=', userId).execute();
  };
}

export { BillingService, BillingNotConfiguredError, AccessExpiredError };
