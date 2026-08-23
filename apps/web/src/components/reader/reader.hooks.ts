/**
 * Reader — Hooks
 *
 * Everything the paged reader needs to know before it can typeset: how big its
 * container is, whether the fonts it will measure against have loaded, and what
 * the resulting pages are.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { paginate, type Content, type LayoutFn, type LayoutResult } from '@editions/layout-engine';

/* ── Types ────────────────────────────────────────────────────── */

type Size = {
  width: number;
  height: number;
};

type PaginationArgs = {
  content: Content[];
  layouts: LayoutFn[];
  page: Size;
  /** Hold off until fonts are ready — measuring a fallback face wastes the work. */
  enabled: boolean;
};

/** One article's content, ready to typeset. */
type PaginatedArticle = {
  id: string;
  content: Content[];
};

type ArticlePaginationArgs = {
  articles: PaginatedArticle[];
  layouts: LayoutFn[];
  page: Size;
  enabled: boolean;
};

/* ── Constants ────────────────────────────────────────────────── */

const RESIZE_DEBOUNCE_MS = 160;

/** Families the reader measures against. */
const READER_FONTS = ['Newsreader', 'JetBrains Mono', 'Inter'];

/* ── Public functions ─────────────────────────────────────────── */

/**
 * Track an element's size, debounced.
 *
 * The reader measures its container rather than the window: on a two-page
 * spread a page is half the width, and in Storybook it is whatever the frame
 * gives it.
 */
const useElementSize = (ref: React.RefObject<HTMLElement | null>): Size => {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      setSize((current) =>
        Math.abs(current.width - rect.width) < 1 && Math.abs(current.height - rect.height) < 1
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    measure();

    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref]);

  return size;
};

/** True once the reader's fonts have loaded, so measurement matches rendering. */
const useFontsReady = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const wait = async (): Promise<void> => {
      try {
        await document.fonts.ready;
      } catch {
        // A font that never resolves shouldn't stop the reader rendering.
      }
      if (!cancelled) {
        setReady(true);
      }
    };

    void wait();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
};

/**
 * Typeset content into pages.
 *
 * Layout happens in a detached, off-screen mount so half-composed pages never
 * reach the screen. Re-runs whenever the page box or the content changes.
 */
const usePagination = ({ content, layouts, page, enabled }: PaginationArgs): LayoutResult[] => {
  const [pages, setPages] = useState<LayoutResult[]>([]);

  useLayoutEffect(() => {
    if (!enabled || page.width < 200 || page.height < 200) {
      return;
    }

    const mount = document.createElement('div');
    mount.style.position = 'absolute';
    mount.style.left = '-99999px';
    mount.style.top = '0';
    mount.style.visibility = 'hidden';
    mount.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mount);

    const result = paginate({ content, spec: page, layouts, mount });
    setPages(result);

    return () => {
      mount.remove();
    };
    // Only the page box's dimensions matter; a new object of the same size
    // would re-typeset for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, layouts, page.width, page.height, enabled]);

  return pages;
};

/**
 * Typeset many articles at once, keyed by id.
 *
 * A magazine paginates every article against the same page box, so this is one
 * pass over the whole issue rather than a hook per article — the number of
 * articles isn't known until the data arrives.
 */
const useArticlePagination = ({
  articles,
  layouts,
  page,
  enabled,
}: ArticlePaginationArgs): Map<string, LayoutResult[]> => {
  const [pages, setPages] = useState<Map<string, LayoutResult[]>>(new Map());

  useLayoutEffect(() => {
    if (!enabled || page.width < 200 || page.height < 200 || articles.length === 0) {
      return;
    }

    const mount = document.createElement('div');
    mount.style.position = 'absolute';
    mount.style.left = '-99999px';
    mount.style.top = '0';
    mount.style.visibility = 'hidden';
    mount.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mount);

    const result = new Map<string, LayoutResult[]>();
    for (const article of articles) {
      result.set(article.id, paginate({ content: article.content, spec: page, layouts, mount }));
    }
    setPages(result);

    return () => {
      mount.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, layouts, page.width, page.height, enabled]);

  return pages;
};

/** Attach an engine-built page element into the React tree. */
const usePageSlot = (element: HTMLElement | null): ((node: HTMLDivElement | null) => void) => {
  const attached = useRef<HTMLElement | null>(null);

  return useCallback(
    (node: HTMLDivElement | null): void => {
      if (attached.current?.parentElement) {
        attached.current.remove();
      }
      attached.current = element;
      if (node && element) {
        node.appendChild(element);
      }
    },
    [element],
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Size, PaginationArgs, PaginatedArticle, ArticlePaginationArgs };
export { useElementSize, useFontsReady, usePagination, useArticlePagination, usePageSlot, READER_FONTS };
