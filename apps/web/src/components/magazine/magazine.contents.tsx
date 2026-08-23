/**
 * Magazine — Contents panel
 *
 * The contents, reachable from any page. An issue has a contents *page* near
 * the front, but a reader forty pages in shouldn't have to flip back to it to
 * find out what's left — so the same listing opens as a panel over whatever
 * page they are on, and closes without moving them if they change their mind.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { List } from 'lucide-react';

import type { TocSection } from './magazine.toc.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type ContentsPanelProps = {
  sections: TocSection[];
  onNavigate: (page: number) => void;
  onClose: () => void;
};

type ContentsButtonProps = {
  sections: TocSection[];
  onNavigate: (page: number) => void;
};

/* ── Constants ────────────────────────────────────────────────── */

const EASE_OUT = [0, 0, 0.15, 1] as const;

/* ── Private helpers ──────────────────────────────────────────── */

/** Page indices are 0-based; folios are what the reader sees. */
const folio = (index: number): string => String(index + 1).padStart(2, '0');

/* ── Panel ────────────────────────────────────────────────────── */

const ContentsPanel = ({ sections, onNavigate, onClose }: ContentsPanelProps): React.ReactElement => (
  <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-70 bg-surface-sunken/60 backdrop-blur-[2px]"
      onClick={onClose}
    />
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="fixed bottom-14 left-1/2 z-80 max-h-[60vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-xl border border-border bg-surface shadow-xl"
    >
      <div className="px-5 py-4">
        <div className="mb-4 font-mono text-[10px] tracking-widest text-ink-faint uppercase">Contents</div>
        <div className="grid gap-5">
          {sections.map((section) => (
            <div key={section.focusName}>
              <button
                onClick={() => onNavigate(section.startPage)}
                className="group mb-2 flex w-full cursor-pointer items-baseline gap-3 text-left"
              >
                <span className="font-serif text-sm font-medium text-ink transition-colors duration-fast group-hover:text-accent">
                  {section.focusName}
                </span>
                <span className="min-w-4 flex-1 translate-y-[-2px] border-b border-dotted border-border" />
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">p. {folio(section.startPage)}</span>
              </button>
              <div className="grid gap-1.5 border-l border-border pl-3">
                {section.articles.map((article) => (
                  <button
                    key={`${article.title}-${article.page}`}
                    onClick={() => onNavigate(article.page)}
                    className="group flex w-full cursor-pointer items-baseline gap-2 text-left"
                  >
                    <span className="font-serif text-xs leading-snug text-ink-secondary transition-colors duration-fast group-hover:text-accent">
                      {article.title}
                    </span>
                    <span className="min-w-4 flex-1 translate-y-[-2px] border-b border-dotted border-border/50" />
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">{folio(article.page)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  </>
);

/* ── Button ───────────────────────────────────────────────────── */

/**
 * Sits in the footer band every page reserves, opposite the exit.
 * Escape closes the panel before it would leave the issue.
 */
const ContentsButton = ({ sections, onNavigate }: ContentsButtonProps): React.ReactElement => {
  const [open, setOpen] = React.useState(false);

  const handleNavigate = React.useCallback(
    (page: number): void => {
      setOpen(false);
      onNavigate(page);
    },
    [onNavigate],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    // Capture, so the reader's own Escape handler doesn't exit the issue first.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((current) => !current)}
        aria-label="Contents"
        aria-expanded={open}
        className={`fixed right-5 bottom-4 z-60 cursor-pointer transition-colors duration-fast ${
          open ? 'text-accent' : 'text-ink-faint hover:text-ink-secondary'
        }`}
      >
        <List size={14} strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && <ContentsPanel sections={sections} onNavigate={handleNavigate} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ContentsButtonProps, ContentsPanelProps };
export { ContentsButton, ContentsPanel };
