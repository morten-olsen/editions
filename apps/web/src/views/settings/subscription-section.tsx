import { useState } from 'react';

import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';
import { useUserSubscription, useCreateCheckout, useCreatePortal } from '../../hooks/billing/billing.hooks.ts';

type SubscriptionData = NonNullable<ReturnType<typeof useUserSubscription>['data']>;
type AccessInfo = SubscriptionData['access'];
type SubscriptionInfo = NonNullable<SubscriptionData['subscription']>;
type PricingInfo = NonNullable<SubscriptionData['pricing']>;
type CheckoutInterval = 'monthly' | 'yearly';

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/* ── Subcomponents ─────────────────────────────────────────────────── */

const AccessStatusCard = ({ access }: { access: AccessInfo }): React.ReactElement => (
  <div>
    <h3 className="text-sm font-semibold text-ink mb-2">Access Status</h3>
    <div className="rounded-lg bg-surface-raised border border-border p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            access.state === 'active' || access.state === 'unlimited'
              ? 'bg-positive'
              : access.state === 'trial'
                ? 'bg-warning'
                : 'bg-critical'
          }`}
        />
        <span className="text-sm font-medium text-ink capitalize">{access.state}</span>
      </div>
      {access.expiresAt && (
        <p className="text-sm text-ink-secondary">
          {access.state === 'expired' ? 'Expired on' : 'Expires'} {formatDate(access.expiresAt)}
        </p>
      )}
      {access.daysRemaining !== null && access.state !== 'expired' && (
        <p className="text-sm text-ink-tertiary">
          {access.daysRemaining} day{access.daysRemaining === 1 ? '' : 's'} remaining
        </p>
      )}
    </div>
  </div>
);

type SubscriptionDetailsProps = {
  subscription: SubscriptionInfo;
  onManage: () => void;
  managePending: boolean;
};

const SubscriptionDetails = ({
  subscription,
  onManage,
  managePending,
}: SubscriptionDetailsProps): React.ReactElement => (
  <>
    <Separator />
    <div>
      <h3 className="text-sm font-semibold text-ink mb-2">Current Subscription</h3>
      <div className="rounded-lg bg-surface-raised border border-border p-4 space-y-2">
        <p className="text-sm text-ink">
          <span className="font-medium capitalize">{subscription.interval}</span> plan
          {subscription.cancelAtPeriodEnd && (
            <span className="ml-2 text-xs text-warning font-medium">Cancels at period end</span>
          )}
        </p>
        <p className="text-sm text-ink-secondary">Status: {subscription.status}</p>
        <p className="text-sm text-ink-secondary">Current period ends: {formatDate(subscription.currentPeriodEnd)}</p>
      </div>
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={onManage} disabled={managePending}>
          {managePending ? 'Opening...' : 'Manage Subscription'}
        </Button>
        <p className="text-xs text-ink-tertiary mt-1">Update payment method, view invoices, or cancel via Stripe.</p>
      </div>
    </div>
  </>
);

type SubscribeCtaProps = {
  pricing: PricingInfo;
  onCheckout: (interval: CheckoutInterval) => void;
  checkoutPending: boolean;
  checkoutError: string | null;
};

const SubscribeCta = ({
  pricing,
  onCheckout,
  checkoutPending,
  checkoutError,
}: SubscribeCtaProps): React.ReactElement => (
  <>
    <Separator />
    <div>
      <h3 className="text-sm font-semibold text-ink mb-2">Subscribe</h3>
      <div className="flex gap-3">
        {pricing.monthlyPriceCents > 0 && (
          <Button size="md" variant="primary" onClick={() => onCheckout('monthly')} disabled={checkoutPending}>
            Monthly — {formatCents(pricing.monthlyPriceCents)}/mo
          </Button>
        )}
        {pricing.yearlyPriceCents > 0 && (
          <Button size="md" variant="primary" onClick={() => onCheckout('yearly')} disabled={checkoutPending}>
            Yearly — {formatCents(pricing.yearlyPriceCents)}/yr
          </Button>
        )}
      </div>
      {checkoutError && <p className="text-sm text-critical mt-2">{checkoutError}</p>}
    </div>
  </>
);

/* ── Section ───────────────────────────────────────────────────────── */

const SubscriptionSection = (): React.ReactNode => {
  const { data, isLoading } = useUserSubscription();
  const checkout = useCreateCheckout();
  const portal = useCreatePortal();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (isLoading || !data) {
    return <p className="text-sm text-ink-tertiary">Loading subscription info...</p>;
  }

  if (!data.paymentEnabled) {
    return <p className="text-sm text-ink-tertiary">Payment is not configured on this instance.</p>;
  }

  const { access, subscription } = data;

  const handleCheckout = async (interval: CheckoutInterval): Promise<void> => {
    setCheckoutError(null);
    try {
      const result = await checkout.mutateAsync({
        interval,
        successUrl: `${window.location.origin}/settings?tab=subscription&checkout=success`,
        cancelUrl: `${window.location.origin}/settings?tab=subscription`,
      });
      window.location.href = result.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  const handleManage = async (): Promise<void> => {
    try {
      const result = await portal.mutateAsync({
        returnUrl: `${window.location.origin}/settings?tab=subscription`,
      });
      window.location.href = result.url;
    } catch {
      // Portal errors are unlikely — just log
    }
  };

  return (
    <div className="space-y-6">
      <AccessStatusCard access={access} />

      {subscription && (
        <SubscriptionDetails subscription={subscription} onManage={handleManage} managePending={portal.isPending} />
      )}

      {/* Subscribe CTA — shown when no active subscription */}
      {!subscription && access.state !== 'unlimited' && data.pricing && (
        <SubscribeCta
          pricing={data.pricing}
          onCheckout={handleCheckout}
          checkoutPending={checkout.isPending}
          checkoutError={checkoutError}
        />
      )}
    </div>
  );
};

export { SubscriptionSection, formatCents };
