import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { EntityIcon } from './entity-icon.tsx';

/* ── Types ───────────────────────────────────────────────────────── */

type Mode = 'magazines' | 'feed' | 'discover' | 'builder';

type ModeBarProps = {
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  username?: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  onBookmarksClick?: () => void;
  actions?: React.ReactNode;
};

/* ── Mode metadata ───────────────────────────────────────────────── */

const modes: { id: Mode; label: string; icon: string }[] = [
  { id: 'magazines', label: 'Magazines', icon: 'book-open' },
  { id: 'feed', label: 'Feed', icon: 'layers' },
  { id: 'discover', label: 'Discover', icon: 'compass' },
  { id: 'builder', label: 'Builder', icon: 'wrench' },
];

/* ── ModeBar (desktop top bar) ───────────────────────────────────── */

type ModeBarActionsProps = Pick<
  ModeBarProps,
  'username' | 'onLogout' | 'onSettingsClick' | 'onBookmarksClick' | 'actions'
>;

const ModeBarActions = ({
  username,
  onLogout,
  onSettingsClick,
  onBookmarksClick,
  actions,
}: ModeBarActionsProps): React.ReactElement => (
  <div className="shrink-0 flex items-center gap-3">
    {actions}
    {onBookmarksClick && (
      <button
        type="button"
        onClick={onBookmarksClick}
        className="p-1 text-ink-faint hover:text-ink-tertiary transition-colors duration-fast cursor-pointer"
        aria-label="Bookmarks"
        data-ai-id="bookmarks-btn"
        data-ai-role="button"
        data-ai-label="Bookmarks"
      >
        <EntityIcon icon="bookmark" size={15} />
      </button>
    )}
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
);

const ModeBar = ({
  activeMode,
  onModeChange,
  username,
  onLogout,
  onSettingsClick,
  onBookmarksClick,
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

    <ModeBarActions
      username={username}
      onLogout={onLogout}
      onSettingsClick={onSettingsClick}
      onBookmarksClick={onBookmarksClick}
      actions={actions}
    />
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
  onBookmarksClick?: () => void;
  actions?: React.ReactNode;
};

type DrawerNavProps = Pick<MobileDrawerProps, 'activeMode' | 'onModeChange' | 'onClose'>;

const DrawerNav = ({ activeMode, onModeChange, onClose }: DrawerNavProps): React.ReactElement => (
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
);

type DrawerFooterProps = Pick<
  MobileDrawerProps,
  'onClose' | 'username' | 'onLogout' | 'onSettingsClick' | 'onBookmarksClick' | 'actions'
>;

const DrawerFooter = ({
  onClose,
  username,
  onLogout,
  onSettingsClick,
  onBookmarksClick,
  actions,
}: DrawerFooterProps): React.ReactElement => (
  <div className="mt-auto px-3 py-4 border-t border-border flex flex-col gap-2">
    {actions && <div className="px-3 mb-1">{actions}</div>}
    {onBookmarksClick && (
      <button
        type="button"
        onClick={() => {
          onBookmarksClick();
          onClose();
        }}
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-secondary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast cursor-pointer"
      >
        <EntityIcon icon="bookmark" size={16} className="shrink-0" />
        Bookmarks
      </button>
    )}
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
);

const MobileDrawer = ({
  open,
  onClose,
  activeMode,
  onModeChange,
  username,
  onLogout,
  onSettingsClick,
  onBookmarksClick,
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

            <DrawerNav activeMode={activeMode} onModeChange={onModeChange} onClose={onClose} />

            <DrawerFooter
              onClose={onClose}
              username={username}
              onLogout={onLogout}
              onSettingsClick={onSettingsClick}
              onBookmarksClick={onBookmarksClick}
              actions={actions}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ── Exports ─────────────────────────────────────────────────────── */

export type { Mode, ModeBarProps, MobileDrawerProps };
export { ModeBar, MobileDrawer, modes };
