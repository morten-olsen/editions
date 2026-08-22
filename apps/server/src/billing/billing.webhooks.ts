import crypto from 'node:crypto';

import type Stripe from 'stripe';

import type { DatabaseService } from '../database/database.ts';

// --- Types ---

type BillingDb = Awaited<ReturnType<DatabaseService['getInstance']>>;

// Dependencies are provided lazily: `getStripe` throws when Stripe is not
// configured, and only the handlers that talk to Stripe should trigger that.
type WebhookDeps = {
  getDb: () => Promise<BillingDb>;
  getStripe: () => Stripe;
};

// --- Private helpers ---

const getSubscriptionIdFromInvoice = (invoice: Stripe.Invoice): string | null => {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) {
    return null;
  }
  return typeof subDetails.subscription === 'string' ? subDetails.subscription : subDetails.subscription.id;
};

const upsertSubscription = async (
  deps: WebhookDeps,
  { userId, sub, item }: { userId: string; sub: Stripe.Subscription; item: Stripe.SubscriptionItem },
): Promise<void> => {
  const db = await deps.getDb();
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

const handleCheckoutCompleted = async (deps: WebhookDeps, session: Stripe.Checkout.Session): Promise<void> => {
  const userId = session.metadata?.['editions_user_id'];
  if (!userId || !session.subscription) {
    return;
  }

  const stripe = deps.getStripe();
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) {
    return;
  }

  await upsertSubscription(deps, { userId, sub, item });
};

const handleInvoicePaid = async (deps: WebhookDeps, invoice: Stripe.Invoice): Promise<void> => {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    return;
  }

  const stripe = deps.getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) {
    return;
  }

  const db = await deps.getDb();
  const existing = await db
    .selectFrom('subscriptions')
    .select('user_id')
    .where('stripe_subscription_id', '=', subscriptionId)
    .executeTakeFirst();

  if (existing) {
    await upsertSubscription(deps, { userId: existing.user_id, sub, item });
  }
};

const handleInvoicePaymentFailed = async (deps: WebhookDeps, invoice: Stripe.Invoice): Promise<void> => {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    return;
  }

  const db = await deps.getDb();
  await db
    .updateTable('subscriptions')
    .set({ status: 'past_due', updated_at: new Date().toISOString() })
    .where('stripe_subscription_id', '=', subscriptionId)
    .execute();
};

const handleSubscriptionUpdated = async (deps: WebhookDeps, sub: Stripe.Subscription): Promise<void> => {
  const db = await deps.getDb();
  const existing = await db
    .selectFrom('subscriptions')
    .select('user_id')
    .where('stripe_subscription_id', '=', sub.id)
    .executeTakeFirst();

  if (!existing) {
    return;
  }

  const item = sub.items.data[0];
  if (!item) {
    return;
  }

  await upsertSubscription(deps, { userId: existing.user_id, sub, item });
};

const handleSubscriptionDeleted = async (deps: WebhookDeps, sub: Stripe.Subscription): Promise<void> => {
  const db = await deps.getDb();
  await db
    .updateTable('subscriptions')
    .set({ status: 'cancelled', updated_at: new Date().toISOString() })
    .where('stripe_subscription_id', '=', sub.id)
    .execute();
  // access_expires_at stays at current_period_end — runs out naturally
};

// --- Public API ---

// Pure event routing — testable from a JSON fixture, no signature verification
const applyBillingWebhookEvent = async (deps: WebhookDeps, event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(deps, event.data.object as Stripe.Checkout.Session);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(deps, event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(deps, event.data.object as Stripe.Invoice);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(deps, event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(deps, event.data.object as Stripe.Subscription);
      break;
  }
};

export type { WebhookDeps };
export { applyBillingWebhookEvent };
