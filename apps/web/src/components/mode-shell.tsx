import { useState, useEffect, useRef } from 'react';

import { EntityIcon } from './entity-icon.tsx';
import { ModeBar, MobileDrawer, modes } from './mode-shell.nav.tsx';
import type { Mode, ModeBarProps } from './mode-shell.nav.tsx';

/* ── Types ───────────────────────────────────────────────────────── */

type ModeShellProps = {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  children: React.ReactNode;
  pathname: string;
  username?: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  onBookmarksClick?: () => void;
  actions?: React.ReactNode;
};

/* ── Route → Mode mapping ────────────────────────────────────────── */

const modeForPath = (pathname: string): Mode => {
  // Feed mode: browsing articles
  // /focuses/:id (without /edit) is feed mode — reading focus articles
  // /focuses, /focuses/new, /focuses/:id/edit are builder mode — configuration
  // BuilderNav.tabForPath maps all /focuses paths to the "focuses" tab,
  // but that's fine since BuilderNav only renders in builder mode.
  if (pathname.startsWith('/feed')) {
    return 'feed';
  }
  if (/^\/focuses\/[^/]+$/.test(pathname)) {
    return 'feed';
  }

  // Builder mode: configuration
  if (pathname.startsWith('/sources')) {
    return 'builder';
  }
  if (pathname === '/focuses' || pathname === '/focuses/new') {
    return 'builder';
  }
  if (/^\/focuses\/[^/]+\/edit$/.test(pathname)) {
    return 'builder';
  }
  if (pathname === '/editions' || pathname === '/editions/new') {
    return 'builder';
  }
  if (/^\/editions\/[^/]+\/edit$/.test(pathname)) {
    return 'builder';
  }
  if (pathname.startsWith('/discovery')) {
    return 'discover';
  }
  if (pathname.startsWith('/settings')) {
    return 'builder';
  }

  // Everything else: magazines (home, edition issues, bookmarks)
  return 'magazines';
};

const defaultPathForMode: Record<Mode, string> = {
  magazines: '/',
  feed: '/feed',
  discover: '/discovery',
  builder: '/sources',
};

/* ── Full-screen route detection ─────────────────────────────────── */

const isFullScreenRoute = (pathname: string): boolean =>
  /\/articles\/[^/]+$/.test(pathname) || /\/issues\/[^/]+$/.test(pathname);

/* ── Scroll restoration ──────────────────────────────────────────── */

const scrollCache = new Map<string, number>();

const useScrollRestoration = (pathname: string, scrollRef: React.RefObject<HTMLElement | null>): void => {
  const lastScrollY = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    lastScrollY.current = el.scrollTop;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (): void => {
      lastScrollY.current = el.scrollTop;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        scrollCache.set(pathname, el.scrollTop);
      }, 100);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (timer) {
        clearTimeout(timer);
      }
      scrollCache.set(pathname, lastScrollY.current);
    };
  }, [pathname, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const savedY = scrollCache.get(pathname);
    if (savedY != null && savedY > 0) {
      let attempts = 0;
      const tryRestore = (): void => {
        if (el.scrollHeight > savedY || attempts >= 40) {
          el.scrollTo(0, savedY);
          return;
        }
        attempts++;
        setTimeout(tryRestore, 50);
      };
      requestAnimationFrame(tryRestore);
    } else {
      el.scrollTo(0, 0);
    }
  }, [pathname, scrollRef]);
};

/* ── ModeShell ───────────────────────────────────────────────────── */

const ModeShell = ({
  activeMode,
  onModeChange,
  children,
  pathname,
  username,
  onLogout,
  onSettingsClick,
  onBookmarksClick,
  actions,
}: ModeShellProps): React.ReactElement => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useScrollRestoration(pathname, mainRef);

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-surface">
      <div className="hidden lg:block shrink-0 z-30">
        <ModeBar
          activeMode={activeMode}
          onModeChange={onModeChange}
          username={username}
          onLogout={onLogout}
          onSettingsClick={onSettingsClick}
          onBookmarksClick={onBookmarksClick}
          actions={actions}
        />
      </div>

      <div className="shrink-0 z-30 flex items-center h-14 px-4 border-b border-border bg-surface lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 -ml-1.5 rounded-md text-ink-secondary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
          aria-label="Open navigation"
        >
          <EntityIcon icon="menu" size={20} />
        </button>
        <span className="font-serif text-lg tracking-tight text-ink ml-3">Editions</span>
        <span className="ml-auto font-mono text-xs tracking-wide text-ink-faint uppercase">{activeMode}</span>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeMode={activeMode}
        onModeChange={onModeChange}
        username={username}
        onLogout={onLogout}
        onSettingsClick={onSettingsClick}
        onBookmarksClick={onBookmarksClick}
        actions={actions}
      />

      <main ref={mainRef} className="relative flex-1 min-h-0 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export type { Mode, ModeShellProps, ModeBarProps };
export { ModeShell, ModeBar, modes, modeForPath, defaultPathForMode, isFullScreenRoute };
