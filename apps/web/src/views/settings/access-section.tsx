import { useState } from 'react';

import { Button } from '../../components/button.tsx';
import { Separator } from '../../components/separator.tsx';
import {
  useAdminBillingSettings,
  useUpdateBillingSettings,
  useAdminUsers,
  useAdminSetAccess,
  useAdminCancelSubscription,
} from '../../hooks/billing/billing.hooks.ts';
import type { AdminUser } from '../../hooks/billing/billing.hooks.ts';

// --- Pricing config form ---

const PricingForm = (): React.ReactNode => {
  const { data: settings, isLoading } = useAdminBillingSettings();
  const update = useUpdateBillingSettings();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [trialDays, setTrialDays] = useState<string | null>(null);
  const [monthlyCents, setMonthlyCents] = useState<string | null>(null);
  const [yearlyCents, setYearlyCents] = useState<string | null>(null);

  if (isLoading || !settings) {
    return <p className="text-sm text-ink-tertiary">Loading settings...</p>;
  }

  const currentEnabled = enabled ?? settings.enabled;
  const currentTrialDays = trialDays ?? String(settings.trialDays);
  const currentMonthlyCents = monthlyCents ?? String(settings.monthlyPriceCents);
  const currentYearlyCents = yearlyCents ?? String(settings.yearlyPriceCents);

  const handleSave = async (): Promise<void> => {
    await update.mutateAsync({
      enabled: currentEnabled,
      trialDays: Number(currentTrialDays),
      monthlyPriceCents: Number(currentMonthlyCents),
      yearlyPriceCents: Number(currentYearlyCents),
    });
  };

  const handleToggle = async (): Promise<void> => {
    const next = !currentEnabled;
    setEnabled(next);
    await update.mutateAsync({ enabled: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Subscriptions</h3>
        <button
          type="button"
          onClick={handleToggle}
          disabled={update.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${currentEnabled ? 'bg-accent' : 'bg-surface-sunken'}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${currentEnabled ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>
      {!currentEnabled && (
        <p className="text-sm text-ink-tertiary">Subscriptions are disabled. Users have unlimited access.</p>
      )}
      <h3 className="text-sm font-semibold text-ink">Pricing</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-ink-secondary">Trial days</span>
          <input
            type="number"
            min="0"
            value={currentTrialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-secondary">Monthly price (cents)</span>
          <input
            type="number"
            min="0"
            value={currentMonthlyCents}
            onChange={(e) => setMonthlyCents(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          {Number(currentMonthlyCents) > 0 && (
            <span className="text-xs text-ink-tertiary mt-0.5">${(Number(currentMonthlyCents) / 100).toFixed(2)}/mo</span>
          )}
        </label>
        <label className="block">
          <span className="text-xs text-ink-secondary">Yearly price (cents)</span>
          <input
            type="number"
            min="0"
            value={currentYearlyCents}
            onChange={(e) => setYearlyCents(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          {Number(currentYearlyCents) > 0 && (
            <span className="text-xs text-ink-tertiary mt-0.5">${(Number(currentYearlyCents) / 100).toFixed(2)}/yr</span>
          )}
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="primary" onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? 'Saving...' : 'Save Pricing'}
        </Button>
        {update.isSuccess && <span className="text-xs text-positive">Saved</span>}
        {update.isError && <span className="text-xs text-critical">{update.error.message}</span>}
      </div>
    </div>
  );
};

// --- User access table ---

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

const UserRow = ({ user }: { user: AdminUser }): React.ReactNode => {
  const setAccess = useAdminSetAccess();
  const cancelSub = useAdminCancelSubscription();
  const [editing, setEditing] = useState(false);
  const [expiresAt, setExpiresAt] = useState(user.accessExpiresAt ?? '');

  const handleSave = async (): Promise<void> => {
    await setAccess.mutateAsync({
      userId: user.id,
      expiresAt: expiresAt || null,
    });
    setEditing(false);
  };

  const handleGrantUnlimited = async (): Promise<void> => {
    await setAccess.mutateAsync({ userId: user.id, expiresAt: null });
    setEditing(false);
  };

  const handleCancelSub = async (): Promise<void> => {
    await cancelSub.mutateAsync(user.id);
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-3 text-sm text-ink">{user.username}</td>
      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium ${
            user.state === 'active' || user.state === 'unlimited'
              ? 'text-positive'
              : user.state === 'trial'
                ? 'text-warning'
                : 'text-critical'
          }`}
        >
          {user.state}
        </span>
      </td>
      <td className="py-2 pr-3 text-xs text-ink-secondary">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={expiresAt ? expiresAt.slice(0, 16) : ''}
              onChange={(e) => setExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="rounded border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
            />
            <Button size="sm" variant="primary" onClick={handleSave} disabled={setAccess.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleGrantUnlimited} disabled={setAccess.isPending}>
              Unlimited
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="hover:text-ink cursor-pointer">
            {user.accessExpiresAt ? formatDate(user.accessExpiresAt) : 'Unlimited'}
          </button>
        )}
      </td>
      <td className="py-2 text-xs text-ink-secondary">
        {user.subscription ? (
          <div className="flex items-center gap-2">
            <span className="capitalize">{user.subscription.interval}</span>
            <span className="text-ink-tertiary">({user.subscription.status})</span>
            {user.subscription.status !== 'cancelled' && (
              <Button size="sm" variant="destructive" onClick={handleCancelSub} disabled={cancelSub.isPending}>
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <span className="text-ink-tertiary">None</span>
        )}
      </td>
    </tr>
  );
};

const UsersTable = (): React.ReactNode => {
  const { data: users, isLoading } = useAdminUsers();

  if (isLoading || !users) {
    return <p className="text-sm text-ink-tertiary">Loading users...</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink mb-2">User Access</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-3 text-xs font-medium text-ink-secondary">User</th>
              <th className="pb-2 pr-3 text-xs font-medium text-ink-secondary">Status</th>
              <th className="pb-2 pr-3 text-xs font-medium text-ink-secondary">Expires</th>
              <th className="pb-2 text-xs font-medium text-ink-secondary">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Combined section ---

const AccessSection = (): React.ReactNode => (
  <div className="space-y-6">
    <PricingForm />
    <Separator />
    <UsersTable />
  </div>
);

export { AccessSection };
