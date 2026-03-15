import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';

/* ── Types ───────────────────────────────────────────────────────── */

type BuilderTab = 'sources' | 'focuses' | 'editions';

type BuilderNavProps = {
  activeTab: BuilderTab | null;
};

/* ── Tab metadata ────────────────────────────────────────────────── */

const tabs: { id: BuilderTab; label: string; to: string }[] = [
  { id: 'sources', label: 'Sources', to: '/sources' },
  { id: 'focuses', label: 'Focuses', to: '/focuses' },
  { id: 'editions', label: 'Editions', to: '/editions' },
];

/* ── Route → Tab mapping ─────────────────────────────────────────── */

const tabForPath = (pathname: string): BuilderTab | null => {
  if (pathname.startsWith('/sources')) return 'sources';
  if (pathname.startsWith('/focuses')) return 'focuses';
  if (pathname.startsWith('/editions')) return 'editions';
  return null;
};

/* ── BuilderNav ──────────────────────────────────────────────────── */

const BuilderNav = ({ activeTab }: BuilderNavProps): React.ReactElement => (
  <nav
    className="shrink-0 border-b border-border bg-surface"
    data-ai-id="builder-nav"
    data-ai-role="nav"
    data-ai-label="Builder section navigation"
  >
    <div className="max-w-prose mx-auto px-4 md:px-8 flex gap-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={`relative px-3 py-2.5 font-mono text-xs tracking-wide uppercase transition-colors duration-fast ease-gentle ${
              isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-tertiary'
            }`}
            data-ai-id={`builder-tab-${tab.id}`}
            data-ai-role="link"
            data-ai-label={tab.label}
            data-ai-state={isActive ? 'selected' : 'idle'}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId="builder-tab-indicator"
                className="absolute inset-x-3 bottom-0 h-px bg-ink"
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              />
            )}
          </Link>
        );
      })}
    </div>
  </nav>
);

export type { BuilderTab, BuilderNavProps };
export { BuilderNav, tabForPath };
