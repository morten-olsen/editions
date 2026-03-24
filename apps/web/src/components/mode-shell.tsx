import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { EntityIcon } from './entity-icon.tsx';

/* ── Types ───────────────────────────────────────────────────────── */

type Mode = 'magazines' | 'feed' | 'builder';

type ModeBarProps = {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  username?: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  actions?: React.ReactNode;
};

type ModeShellProps = {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  children: React.ReactNode;
  pathname: string;
  username?: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  actions?: React.ReactNode;
};

/* ── Mode metadata ───────────────────────────────────────────────── */

const modes: { id: Mode; label: string; icon: string }[] = [
  { id: 'magazines', label: 'Magazines', icon: 'book-open' },
  { id: 'feed', label: 'Feed', icon: 'layers' },
  { id: 'builder', label: 'Builder', icon: 'wrench' },
];

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
  if (pathname.startsWith('/settings')) {
    return 'builder';
  }

  // Everything else: magazines (home, edition issues, bookmarks)
  return 'magazines';
};

const defaultPathForMode: Record<Mode, string> = {
  magazines: '/',
  feed: '/feed',
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

/* ── ModeBar (desktop top bar) ───────────────────────────────────── */

const ModeBar = ({
  activeMode,
  onModeChange,
  username,
  onLogout,
  onSettingsClick,
  actions,
}: ModeBarProps): React.ReactElement => (
  <header
    className="h-12 border-b border-border bg-surface flex items-center px-5 gap-6"
    data-ai-id="mode-bar"
    data-ai-role="nav"
    data-ai-label="Mode navigation"
  >
    <span className="font-serif text-lg tracking-tight text-ink shrink-0">Editions</span>

    <nav className="flex-1 flex items-center justify-center gap-1" data-ai-id="mode-switcher" data-ai-role="nav">
      {modes.map((mode) => {
        const isActive = mode.id === activeMode;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onModeChange(mode.id)}
            className={`relative px-3 py-1.5 font-mono text-xs tracking-wide uppercase transition-colors duration-fast ease-gentle cursor-pointer ${
              isActive ? 'text-ink' : 'text-ink-faint hover:text-ink-tertiary'
            }`}
            data-ai-id={`mode-${mode.id}`}
            data-ai-role="button"
            data-ai-label={mode.label}
            data-ai-state={isActive ? 'selected' : 'idle'}
          >
            {mode.label}
            {isActive && (
              <motion.span
                layoutId="mode-indicator"
                className="absolute inset-x-3 -bottom-[0.4375rem] h-px bg-ink"
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              />
            )}
          </button>
        );
      })}
    </nav>

    <div className="shrink-0 flex items-center gap-3">
      {actions}
      {onSettingsClick && (
        <button
          type="button"
          onClick={onSettingsClick}
          className="p-1 text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
          aria-label="Settings"
          data-ai-id="settings-btn"
          data-ai-role="button"
          data-ai-label="Settings"
        >
          <EntityIcon icon="settings" size={15} />
        </button>
      )}
      {username && <span className="text-xs text-ink-tertiary">{username}</span>}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
        >
          Sign out
        </button>
      )}
    </div>
  </header>
);

/* ── Mobile drawer ───────────────────────────────────────────────── */

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  username?: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  actions?: React.ReactNode;
};

const MobileDrawer = ({
  open,
  onClose,
  activeMode,
  onModeChange,
  username,
  onLogout,
  onSettingsClick,
  actions,
}: MobileDrawerProps): React.ReactElement => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 bg-black/25 backdrop-blur-xs z-40 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.35, ease: [0, 0, 0.15, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border lg:hidden flex flex-col"
          >
            <div className="h-14 flex items-center justify-between px-5 border-b border-border">
              <span className="font-serif text-lg tracking-tight text-ink">Editions</span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
                aria-label="Close menu"
              >
                <EntityIcon icon="x" size={20} />
              </button>
            </div>

            <nav className="flex flex-col py-4 px-3 gap-1">
              <div className="px-3 mb-2">
                <span className="font-mono text-xs tracking-wide text-ink-faint uppercase">Navigate</span>
              </div>
              {modes.map((mode) => {
                const isActive = mode.id === activeMode;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      onModeChange(mode.id);
                      onClose();
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-fast ease-gentle cursor-pointer text-left ${
                      isActive
                        ? 'bg-accent-subtle text-accent font-medium'
                        : 'text-ink-secondary hover:text-ink hover:bg-surface-sunken'
                    }`}
                    data-ai-id={`mobile-mode-${mode.id}`}
                    data-ai-role="button"
                    data-ai-label={mode.label}
                    data-ai-state={isActive ? 'selected' : 'idle'}
                  >
                    <EntityIcon icon={mode.icon} size={16} className="shrink-0" />
                    {mode.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto px-3 py-4 border-t border-border flex flex-col gap-2">
              {actions && <div className="px-3 mb-1">{actions}</div>}
              {onSettingsClick && (
                <button
                  type="button"
                  onClick={() => {
                    onSettingsClick();
                    onClose();
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-secondary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
                >
                  <EntityIcon icon="settings" size={16} className="shrink-0" />
                  Settings
                </button>
              )}
              {username && (
                <div className="px-3 pt-2 border-t border-border mt-1">
                  <div className="text-xs text-ink-tertiary mb-1">{username}</div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="text-xs text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
                    >
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
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
