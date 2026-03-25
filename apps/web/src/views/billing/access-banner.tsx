import { useNavigate } from '@tanstack/react-router';

import { useUserSubscription } from '../../hooks/billing/billing.hooks.ts';
import { Button } from '../../components/button.tsx';

const AccessBanner = (): React.ReactNode => {
  const navigate = useNavigate();
  const { data } = useUserSubscription();

  if (!data || !data.paymentEnabled) return null;

  const { access } = data;

  if (access.state === 'unlimited' || access.state === 'active') return null;

  if (access.state === 'trial' && access.daysRemaining !== null && access.daysRemaining > 7) return null;

  const isTrial = access.state === 'trial';
  const isExpired = access.state === 'expired';

  return (
    <div
      className={`mx-4 mb-4 rounded-lg px-4 py-3 text-sm ${isExpired ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning-ink'}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p>
          {isExpired && 'Your access has expired. Subscribe to continue creating and editing content.'}
          {isTrial && access.daysRemaining !== null && `Your trial ends in ${access.daysRemaining} day${access.daysRemaining === 1 ? '' : 's'}.`}
        </p>
        <Button size="sm" variant="primary" onClick={() => navigate({ to: '/settings', search: { tab: 'subscription' } })}>
          Subscribe
        </Button>
      </div>
    </div>
  );
};

export { AccessBanner };
