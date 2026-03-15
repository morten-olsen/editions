import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { useAuth } from '../auth/auth.tsx';
import { PageHeader } from '../components/page-header.tsx';
import { JobsSection } from '../views/settings/jobs-section.tsx';
import { VotesSection } from '../views/settings/votes-section.tsx';
import { ScoringSection } from '../views/settings/scoring-section.tsx';
import { AiSection } from '../views/settings/ai-section.tsx';

type SettingsTab = 'jobs' | 'votes' | 'scoring' | 'assistant';

const TABS: { key: SettingsTab; label: string; badge?: string }[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'votes', label: 'Votes' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'assistant', label: 'Assistant', badge: 'alpha' },
];

const TAB_DESCRIPTIONS: Record<SettingsTab, string> = {
  jobs: 'Running and recent background jobs',
  votes: '',
  scoring: 'Customise how articles are ranked in each feed',
  assistant: 'Configure an AI assistant to help you set up Editions',
};

const SettingsPage = (): React.ReactNode => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('jobs');

  if (auth.status !== 'authenticated') {
    return null;
  }

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Settings" />

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab !== 'votes' && TAB_DESCRIPTIONS[activeTab] && (
        <p className="text-sm text-ink-secondary mb-6">{TAB_DESCRIPTIONS[activeTab]}</p>
      )}

      {activeTab === 'jobs' && <JobsSection token={auth.token} />}
      {activeTab === 'votes' && <VotesSection />}
      {activeTab === 'scoring' && <ScoringSection token={auth.token} />}
      {activeTab === 'assistant' && <AiSection />}
    </div>
  );
};

const SettingsTabs = ({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}): React.ReactNode => (
  <div
    className="flex gap-1 border-b border-border mb-6"
    data-ai-id="settings-tabs"
    data-ai-role="section"
    data-ai-label="Settings tabs"
  >
    {TABS.map((tab) => (
      <button
        key={tab.key}
        type="button"
        onClick={() => onTabChange(tab.key)}
        className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${activeTab === tab.key ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
        data-ai-id={`settings-tab-${tab.key}`}
        data-ai-role="button"
        data-ai-label={tab.label}
        data-ai-state={activeTab === tab.key ? 'selected' : 'idle'}
      >
        {tab.label}
        {tab.badge && (
          <span className="ml-1.5 text-[10px] font-medium text-accent/60 uppercase tracking-wider">{tab.badge}</span>
        )}
      </button>
    ))}
  </div>
);

const Route = createFileRoute('/settings/')({
  component: SettingsPage,
});

export { Route };
