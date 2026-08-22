import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

import { BillingService } from './billing.ts';

// applyWebhookEvent routes verified Stripe events onto local state. The three
// events below never call the Stripe API, so JSON fixtures exercise them fully.

const subscriptionEvent = (type: string, id: string): Stripe.Event =>
  ({ type, data: { object: { id } } }) as unknown as Stripe.Event;

const invoiceEvent = (type: string, subscriptionId: string): Stripe.Event =>
  ({
    type,
    data: { object: { parent: { subscription_details: { subscription: subscriptionId } } } },
  }) as unknown as Stripe.Event;

describe('BillingService.applyWebhookEvent', () => {
  let t: TestContext;
  let billing: BillingService;

  beforeEach(async () => {
    t = await createTestApp();
    billing = t.services.get(BillingService);

    const user = await t.register();
    const db = await t.db();
    const now = new Date().toISOString();
    await db
      .insertInto('subscriptions')
      .values({
        id: 'sub-row-1',
        user_id: user.id,
        stripe_subscription_id: 'sub_stripe_1',
        stripe_price_id: 'price_1',
        status: 'active',
        interval: 'monthly',
        current_period_start: now,
        current_period_end: now,
        cancel_at_period_end: 0,
      })
      .execute();
  });

  afterEach(async () => {
    await t.stop();
  });

  const getStatus = async (): Promise<string> => {
    const db = await t.db();
    const row = await db
      .selectFrom('subscriptions')
      .select('status')
      .where('stripe_subscription_id', '=', 'sub_stripe_1')
      .executeTakeFirstOrThrow();
    return row.status;
  };

  it('marks the subscription past_due on invoice.payment_failed', async () => {
    await billing.applyWebhookEvent(invoiceEvent('invoice.payment_failed', 'sub_stripe_1'));
    expect(await getStatus()).toBe('past_due');
  });

  it('marks the subscription cancelled on customer.subscription.deleted', async () => {
    await billing.applyWebhookEvent(subscriptionEvent('customer.subscription.deleted', 'sub_stripe_1'));
    expect(await getStatus()).toBe('cancelled');
  });

  it('ignores events for unknown subscriptions', async () => {
    await billing.applyWebhookEvent(subscriptionEvent('customer.subscription.deleted', 'sub_unknown'));
    expect(await getStatus()).toBe('active');
  });

  it('ignores unhandled event types', async () => {
    await billing.applyWebhookEvent({ type: 'customer.created', data: { object: {} } } as unknown as Stripe.Event);
    expect(await getStatus()).toBe('active');
  });
});
