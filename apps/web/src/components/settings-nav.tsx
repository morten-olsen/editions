import { EntityIcon } from './entity-icon.tsx';

/* ── Types ───────────────────────────────────────────────────────── */

type SettingsTab = {
  key: string;
  label: string;
  icon?: string;
  badge?: string;
};

type SettingsNavProps = {
  tabs: SettingsTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
};

/* ── Link styles ─────────────────────────────────────────────────── */

const tocLinkClass = (active: boolean): string =>
  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-fast ease-gentle cursor-pointer ${
    active ? 'bg-accent-subtle text-accent font-medium' : 'text-ink-secondary hover:text-ink hover:bg-surface-sunken'
  }`;

const chipClass = (active: boolean): string =>
  `shrink-0 font-mono text-xs tracking-wide uppercase px-2 py-1 rounded-md transition-colors duration-fast cursor-pointer ${
    active ? 'bg-accent-subtle text-accent' : 'text-ink-faint hover:text-ink-tertiary'
  }`;

/* ── Icon map ────────────────────────────────────────────────────── */

const tabIcons: Record<string, string> = {
  jobs: 'activity',
  votes: 'thumbs-up',
  scoring: 'sliders-horizontal',
  data: 'database',
  assistant: 'bot',
  subscription: 'credit-card',
  access: 'shield',
};

/* ── Desktop sidebar ─────────────────────────────────────────────── */

const SettingsSidebar = ({ tabs, activeTab, onTabChange }: SettingsNavProps): React.ReactElement => (
  <nav className="w-48 shrink-0" data-ai-id="settings-sidebar" data-ai-role="nav" data-ai-label="Settings sections">
    <div className="sticky top-16">
      <div className="font-mono text-xs tracking-wide text-ink-faint uppercase px-3 mb-3">Settings</div>
      <div className="flex flex-col gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={tocLinkClass(activeTab === tab.key)}
            data-ai-id={`settings-section-${tab.key}`}
            data-ai-role="button"
            data-ai-label={tab.label}
            data-ai-state={activeTab === tab.key ? 'selected' : 'idle'}
          >
            <EntityIcon icon={tabIcons[tab.key] ?? 'settings'} size={14} className="shrink-0" />
            <span className="truncate">{tab.label}</span>
            {tab.badge && (
              <span className="ml-auto text-[10px] font-medium text-accent/60 uppercase tracking-wider">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  </nav>
);

/* ── Mobile horizontal nav ───────────────────────────────────────── */

const SettingsMobileNav = ({ tabs, activeTab, onTabChange }: SettingsNavProps): React.ReactElement => (
  <nav
    className="shrink-0 border-b border-border bg-surface lg:hidden"
    data-ai-id="settings-mobile-nav"
    data-ai-role="nav"
    data-ai-label="Settings navigation (mobile)"
  >
    <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={chipClass(activeTab === tab.key)}
          data-ai-id={`mobile-settings-${tab.key}`}
          data-ai-role="button"
          data-ai-label={tab.label}
          data-ai-state={activeTab === tab.key ? 'selected' : 'idle'}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </nav>
);

export type { SettingsTab };
export { SettingsSidebar, SettingsMobileNav };
