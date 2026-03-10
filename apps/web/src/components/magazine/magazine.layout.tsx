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

/* ── Touch / swipe helpers ────────────────────────────────────────── */

/** Minimum horizontal distance (px) for a swipe to register. */
const SWIPE_THRESHOLD = 50;
/** Tap zones: fraction of screen width from each edge that counts as a nav tap. */
const TAP_ZONE = 0.25;

type TouchState = {
  startX: number;
  startY: number;
  startTime: number;
};

/**
 * Hook that adds swipe-to-navigate and edge-tap-to-navigate on touch devices.
 * - Horizontal swipe (≥ SWIPE_THRESHOLD px, mostly horizontal) turns the page.
 * - Quick tap (< 300 ms, < 10 px movement) in the left/right 25% of the screen turns the page.
 * - Taps in the center 50% and vertical scrolls are left alone.
 */
const useTouchNav = (
  ref: React.RefObject<HTMLDivElement | null>,
  page: number,
  total: number,
  onPageChange: (page: number) => void,
): void => {
  const touch = React.useRef<TouchState | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touch.current = { startX: t.clientX, startY: t.clientY, startTime: Date.now() };
    };

    const onTouchEnd = (e: TouchEvent): void => {
      if (!touch.current || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.current.startX;
      const dy = t.clientY - touch.current.startY;
      const elapsed = Date.now() - touch.current.startTime;
      touch.current = null;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      /* ── Swipe detection ── */
      if (absDx >= SWIPE_THRESHOLD && absDx > absDy * 1.2) {
        if (dx < 0 && page < total - 1) onPageChange(page + 1);    // swipe left → next
        else if (dx > 0 && page > 0) onPageChange(page - 1);        // swipe right → prev
        return;
      }

      /* ── Edge-tap detection ── */
      if (elapsed < 300 && absDx < 10 && absDy < 10) {
        /* Ignore taps on interactive elements */
        const target = e.target as HTMLElement;
        if (target.closest("a, button, audio, video, input, textarea, [role='button']")) return;

        const x = t.clientX;
        const width = window.innerWidth;
        if (x < width * TAP_ZONE && page > 0) onPageChange(page - 1);
        else if (x > width * (1 - TAP_ZONE) && page < total - 1) onPageChange(page + 1);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, page, total, onPageChange]);
};

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

  /* Swipe and edge-tap navigation for touch devices */
  useTouchNav(scrollRef, page, total, onPageChange);

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
