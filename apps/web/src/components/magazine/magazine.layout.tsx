import * as React from "react";
import { motion, AnimatePresence } from "motion/react";

/* ── Types ────────────────────────────────────────────────────────── */

type MagazineLayoutProps = {
  children: React.ReactNode[];
  /** Current page index (0-based) */
  page: number;
  onPageChange: (page: number) => void;
};

type MagazineNavContext = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

/* ── Context ──────────────────────────────────────────────────────── */

const MagazineNavCtx = React.createContext<MagazineNavContext | null>(null);

/** Navigate within a MagazineLayout from any descendant component. Returns null outside a layout. */
const useMagazineNav = (): MagazineNavContext | null =>
  React.useContext(MagazineNavCtx);

/* ── Constants ────────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

/* ── MagazinePage (single page wrapper) ───────────────────────────── */

type MagazinePageProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * When true, content flows from the top instead of centering vertically.
   * Use for article pages with long-form content that scrolls.
   */
  flow?: boolean;
};

const MagazinePage = ({
  children,
  className = "",
  flow = false,
}: MagazinePageProps): React.ReactElement => (
  <div
    className={`min-h-screen flex flex-col px-6 py-12 md:px-12 lg:px-20 ${flow ? "justify-start pt-16 md:pt-20" : "justify-center"} ${className}`}
  >
    {children}
  </div>
);

/* ── PageIndicator ────────────────────────────────────────────────── */

type PageIndicatorProps = {
  current: number;
  total: number;
  onPageChange: (page: number) => void;
};

const PageIndicator = ({
  current,
  total,
  onPageChange,
}: PageIndicatorProps): React.ReactElement => (
  <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-6 py-4 bg-linear-to-t from-surface via-surface/80 to-transparent">
    <button
      onClick={() => onPageChange(Math.max(0, current - 1))}
      disabled={current === 0}
      className="text-xs font-mono tracking-wide text-ink-tertiary hover:text-ink disabled:opacity-30 transition-colors duration-fast"
    >
      Prev
    </button>
    <span className="text-xs font-mono tracking-wide text-ink-tertiary tabular-nums">
      {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
    </span>
    <button
      onClick={() => onPageChange(Math.min(total - 1, current + 1))}
      disabled={current === total - 1}
      className="text-xs font-mono tracking-wide text-ink-tertiary hover:text-ink disabled:opacity-30 transition-colors duration-fast"
    >
      Next
    </button>
  </div>
);

/* ── MagazineLayout ───────────────────────────────────────────────── */

const MagazineLayout = ({
  children,
  page,
  onPageChange,
}: MagazineLayoutProps): React.ReactElement => {
  const pages = React.Children.toArray(children);
  const total = pages.length;
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /* Left/Right arrows navigate pages; Up/Down scroll naturally */
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onPageChange(Math.min(total - 1, page + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPageChange(Math.max(0, page - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [page, total, onPageChange]);

  /* Scroll to top when the page changes */
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const direction = React.useRef(0);
  const prevPage = React.useRef(page);

  if (page !== prevPage.current) {
    direction.current = page > prevPage.current ? 1 : -1;
    prevPage.current = page;
  }

  const navCtx = React.useMemo<MagazineNavContext>(
    () => ({ page, total, onPageChange }),
    [page, total, onPageChange],
  );

  const dir = direction.current;

  return (
    <MagazineNavCtx.Provider value={navCtx}>
      <div ref={scrollRef} className="relative bg-surface h-screen overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={page}
            initial={{ opacity: 0, x: dir * 30, scale: 0.99 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: dir * -20, scale: 0.98 }}
            transition={{ duration: 0.55, ease: easeOut }}
          >
            {pages[page]}
          </motion.div>
        </AnimatePresence>
        <PageIndicator current={page} total={total} onPageChange={onPageChange} />
      </div>
    </MagazineNavCtx.Provider>
  );
};

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineLayoutProps, MagazinePageProps, PageIndicatorProps, MagazineNavContext };
export { MagazineLayout, MagazinePage, PageIndicator, useMagazineNav };
