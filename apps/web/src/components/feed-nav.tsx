import { Link, useRouterState } from '@tanstack/react-router';

import { useFocusesList } from '../hooks/focuses/focuses.hooks.ts';
import { EntityIcon } from './entity-icon.tsx';

/* ── Active section detection ────────────────────────────────────── */

const activeSectionForPath = (pathname: string): string => {
  const match = /^\/focuses\/([^/]+)$/.exec(pathname);
  return match ? match[1]! : 'all';
};

/* ── Link styles ─────────────────────────────────────────────────── */

const tocLinkClass = (active: boolean): string =>
  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-fast ease-gentle ${
    active
      ? 'bg-accent-subtle text-accent font-medium'
      : 'text-ink-secondary hover:text-ink hover:bg-surface-sunken'
  }`;

const chipClass = (active: boolean): string =>
  `shrink-0 font-mono text-xs tracking-wide uppercase px-2 py-1 rounded-md transition-colors duration-fast ${
    active
      ? 'bg-accent-subtle text-accent'
      : 'text-ink-faint hover:text-ink-tertiary'
  }`;

/* ── FeedSidebar ─────────────────────────────────────────────────── */

const FeedSidebar = (): React.ReactElement => {
  const { focuses } = useFocusesList();
  const { location } = useRouterState();
  const activeSection = activeSectionForPath(location.pathname);

  return (
    <nav
      className="w-48 shrink-0"
      data-ai-id="feed-sidebar"
      data-ai-role="nav"
      data-ai-label="Feed sections"
    >
      <div className="sticky top-16">
        <div className="font-mono text-xs tracking-wide text-ink-faint uppercase px-3 mb-3">Browse</div>
        <div className="flex flex-col gap-0.5">
          <Link
            to="/feed"
            className={tocLinkClass(activeSection === 'all')}
            data-ai-id="feed-section-all"
            data-ai-role="link"
            data-ai-label="All articles"
            data-ai-state={activeSection === 'all' ? 'selected' : 'idle'}
          >
            <EntityIcon icon="layers" size={14} className="shrink-0" />
            <span className="truncate">All articles</span>
          </Link>
          {focuses.map((focus) => {
            const isActive = activeSection === focus.id;
            return (
              <Link
                key={focus.id}
                to="/focuses/$focusId"
                params={{ focusId: focus.id }}
                className={tocLinkClass(isActive)}
                data-ai-id={`feed-section-${focus.id}`}
                data-ai-role="link"
                data-ai-label={focus.name}
                data-ai-state={isActive ? 'selected' : 'idle'}
              >
                <EntityIcon icon={focus.icon} fallback="target" size={14} className="shrink-0" />
                <span className="truncate">{focus.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

/* ── Mobile feed select (shown below mode bar on small screens) ─── */

const FeedMobileNav = (): React.ReactElement => {
  const { focuses } = useFocusesList();
  const { location } = useRouterState();
  const activeSection = activeSectionForPath(location.pathname);

  return (
    <nav
      className="shrink-0 border-b border-border bg-surface lg:hidden"
      data-ai-id="feed-mobile-nav"
      data-ai-role="nav"
      data-ai-label="Feed section navigation (mobile)"
    >
      <div className="px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
        <Link
          to="/feed"
          className={chipClass(activeSection === 'all')}
          data-ai-id="mobile-feed-all"
          data-ai-role="link"
          data-ai-label="All articles"
          data-ai-state={activeSection === 'all' ? 'selected' : 'idle'}
        >
          All
        </Link>
        {focuses.map((focus) => (
          <Link
            key={focus.id}
            to="/focuses/$focusId"
            params={{ focusId: focus.id }}
            className={chipClass(activeSection === focus.id)}
            data-ai-id={`mobile-feed-${focus.id}`}
            data-ai-role="link"
            data-ai-label={focus.name}
            data-ai-state={activeSection === focus.id ? 'selected' : 'idle'}
          >
            {focus.name}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export { FeedSidebar, FeedMobileNav };
