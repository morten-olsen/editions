/**
 * Paged Article — View
 *
 * Self-contained React component that renders a markdown article as a
 * paginated, magazine-style reading experience. Handles viewport tracking,
 * font loading, layout computation, page rendering, and navigation.
 *
 * Usage:
 *   <PagedArticleView article={article} />
 */

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { useContainerSize, useFontReady, useDebouncedValue } from './paged-article.hooks.ts';
import { layoutArticle, clearPrepareCache, type ArticleInput, type ArticleStyle } from './paged-article.engine.ts';
import { PageRenderer } from './paged-article.render.tsx';

/* ── Constants ────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;
const SWIPE_THRESHOLD = 50;
const TAP_ZONE = 0.25;

/* ── Props ────────────────────────────────────────────────────── */

type PagedArticleViewProps = {
  article: ArticleInput;
  style?: ArticleStyle;
  footer?: React.ReactNode;
  onPageChange?: (page: number, total: number) => void;
};

/* ── Component ────────────────────────────────────────────────── */

const PagedArticleView = ({
  article,
  style = 'standard',
  footer,
  onPageChange,
}: PagedArticleViewProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(containerRef);
  const fontsReady = useFontReady();
  const debouncedSize = useDebouncedValue(containerSize, 100);
  const [page, setPage] = useState(0);

  const result = useMemo(() => {
    if (!fontsReady || debouncedSize.width === 0) return null;
    return layoutArticle(article, { viewport: debouncedSize, style });
  }, [article, debouncedSize, style, fontsReady]);

  // Clamp page on layout change
  useEffect(() => {
    if (result && page >= result.pageCount) {
      setPage(Math.max(0, result.pageCount - 1));
    }
  }, [result, page]);

  // Notify parent
  useEffect(() => {
    if (result) onPageChange?.(page, result.pageCount);
  }, [page, result, onPageChange]);

  // Clean up cache on unmount
  useEffect(() => () => clearPrepareCache(), []);

  // Navigation
  const total = result?.pageCount ?? 1;
  const goNext = useCallback((): void => setPage((p) => Math.min(total - 1, p + 1)), [total]);
  const goPrev = useCallback((): void => setPage((p) => Math.max(0, p - 1)), []);
  const goTo = useCallback((p: number): void => setPage(Math.max(0, Math.min(total - 1, p))), [total]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'ArrowRight': case 'l': case 'j':
          e.preventDefault(); goNext(); return;
        case 'ArrowLeft': case 'h': case 'k':
          e.preventDefault(); goPrev(); return;
        case ' ':
          e.preventDefault();
          if (e.shiftKey) goPrev(); else goNext();
          return;
        case 'Home':
          e.preventDefault(); goTo(0); return;
        case 'End':
          e.preventDefault(); goTo(total - 1); return;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, goTo, total]);

  // Touch: swipe + edge tap
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) return;
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
    };

    const onTouchEnd = (e: TouchEvent): void => {
      const t = e.changedTouches[0];
      if (e.changedTouches.length !== 1 || !t) return;

      const dx = t.clientX - startX;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(t.clientY - startY);
      const elapsed = Date.now() - startTime;

      if (absDx >= SWIPE_THRESHOLD && absDx > absDy * 1.2) {
        if (dx < 0) goNext(); else goPrev();
        return;
      }

      if (elapsed < 300 && absDx < 10 && absDy < 10) {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, audio, video, input, textarea, [role='button']")) return;
        const x = t.clientX;
        const w = window.innerWidth;
        if (x < w * TAP_ZONE) goPrev();
        else if (x > w * (1 - TAP_ZONE)) goNext();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [goNext, goPrev]);

  // Transition direction tracking
  const direction = useRef(0);
  const prevPage = useRef(page);
  if (page !== prevPage.current) {
    direction.current = page > prevPage.current ? 1 : -1;
    prevPage.current = page;
  }

  // Loading state
  if (!fontsReady || !result) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-surface">
        <div className="text-xs font-mono text-ink-tertiary tracking-wide animate-pulse">
          Preparing layout&hellip;
        </div>
      </div>
    );
  }

  const currentPage = result.pages[page];
  if (!currentPage) return <div ref={containerRef} className="w-full h-full" />;

  const dir = direction.current;
  const isLastPage = page === result.pageCount - 1;

  return (
    <div ref={containerRef} className="relative bg-surface w-full h-full overflow-hidden select-none">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          initial={{ opacity: 0, x: dir * 30, scale: 0.99 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: dir * -20, scale: 0.98 }}
          transition={{ duration: 0.55, ease: easeOut }}
        >
          <PageRenderer
            page={currentPage}
            config={result.config}
            footer={footer}
            isLastPage={isLastPage}
          />
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <PageNav current={page} total={total} onPageChange={goTo} />
      </div>
    </div>
  );
};

/* ── PageNav ──────────────────────────────────────────────────── */

const PageNav = ({ current, total, onPageChange }: { current: number; total: number; onPageChange: (p: number) => void }): React.ReactElement => (
  <div className="flex items-center justify-center gap-6 py-4 bg-linear-to-t from-surface via-surface/80 to-transparent">
    <button
      onClick={() => onPageChange(Math.max(0, current - 1))}
      disabled={current === 0}
      className="text-xs font-mono tracking-wide text-ink-tertiary hover:text-ink disabled:opacity-30 transition-colors duration-fast"
    >
      Prev
    </button>
    <span className="text-xs font-mono tracking-wide text-ink-tertiary tabular-nums">
      {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
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

/* ── Exports ──────────────────────────────────────────────────── */

export type { PagedArticleViewProps };
export { PagedArticleView };
