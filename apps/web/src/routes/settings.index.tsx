import { useEffect, useState } from 'react';
import { createFileRoute, useSearch } from '@tanstack/react-router';

import { useAuth } from '../auth/auth.tsx';
import { SettingsSidebar, SettingsMobileNav } from '../components/settings-nav.tsx';
import type { SettingsTab } from '../components/settings-nav.tsx';
import { useUserSubscription } from '../hooks/billing/billing.hooks.ts';
import { JobsSection } from '../views/settings/jobs-section.tsx';
import { VotesSection } from '../views/settings/votes-section.tsx';
import { ScoringSection } from '../views/settings/scoring-section.tsx';
import { AiSection } from '../views/settings/ai-section.tsx';
import { DataSection } from '../views/settings/data-section.tsx';
import { SubscriptionSection } from '../views/settings/subscription-section.tsx';
import { AccessSection } from '../views/settings/access-section.tsx';

type SettingsTabKey = 'jobs' | 'votes' | 'scoring' | 'data' | 'assistant' | 'subscription' | 'access';

const ALWAYS_TABS: SettingsTab[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'votes', label: 'Votes' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'data', label: 'Data' },
  { key: 'assistant', label: 'Assistant', badge: 'alpha' },
];

const TAB_DESCRIPTIONS: Record<SettingsTabKey, string> = {
  jobs: 'Running and recent background jobs',
  votes: '',
  scoring: 'Customise how articles are ranked in each feed',
  data: 'Export or import your data for portability between instances',
  assistant: 'Configure an AI assistant to help you set up Editions',
  subscription: 'Manage your subscription and billing',
  access: 'Configure pricing, trials, and manage user access',
};

const SettingsPage = (): React.ReactNode => {
  const auth = useAuth();
  const search = useSearch({ from: '/settings/' });
  const { data: billing } = useUserSubscription();
  const paymentEnabled = billing?.paymentEnabled ?? false;
  const isAdmin = auth.status === 'authenticated' && auth.user.role === 'admin';

  const tabs: SettingsTab[] = [
    ...ALWAYS_TABS,
    ...(paymentEnabled ? [{ key: 'subscription', label: 'Subscription' }] : []),
    ...(isAdmin ? [{ key: 'access', label: 'Access', badge: 'admin' }] : []),
  ];

  const initialTab = (search as Record<string, unknown>).tab as SettingsTabKey | undefined;
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(
    initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : 'jobs',
  );

  useEffect(() => {
    if (initialTab && tabs.some((t) => t.key === initialTab) && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (auth.status !== 'authenticated') {
    return null;
  }

  const description = TAB_DESCRIPTIONS[activeTab];

  return (
    <>
      {/* Mobile: horizontal chip nav */}
      <SettingsMobileNav tabs={tabs} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as SettingsTabKey)} />

      {/* Desktop: sidebar + content */}
      <div className="relative max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
        <div className="absolute right-full top-6 hidden lg:block mr-4">
          <SettingsSidebar tabs={tabs} activeTab={activeTab} onTabChange={(k) => setActiveTab(k as SettingsTabKey)} />
        </div>

        {description && <p className="text-sm text-ink-secondary mb-6">{description}</p>}

        {activeTab === 'jobs' && <JobsSection token={auth.token} />}
        {activeTab === 'votes' && <VotesSection />}
        {activeTab === 'scoring' && <ScoringSection token={auth.token} />}
        {activeTab === 'data' && <DataSection token={auth.token} />}
        {activeTab === 'assistant' && <AiSection />}
        {activeTab === 'subscription' && <SubscriptionSection />}
        {activeTab === 'access' && <AccessSection />}
      </div>
    </>
  );
};

type SettingsSearch = {
  tab?: string;
  checkout?: string;
};

const Route = createFileRoute('/settings/')({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: typeof search['tab'] === 'string' ? search['tab'] : undefined,
    checkout: typeof search['checkout'] === 'string' ? search['checkout'] : undefined,
  }),
});

export { Route };
