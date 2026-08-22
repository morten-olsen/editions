/**
 * Magazine Paged Article Hooks
 *
 * React hooks for the paged magazine layout:
 * - useViewportSize: tracks viewport dimensions with debounced ResizeObserver
 * - useFontReady: waits for web fonts to load before measuring
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/* ── useViewportSize ──────────────────────────────────────────── */

type ViewportSize = {
  width: number;
  height: number;
};

const RESIZE_DEBOUNCE_MS = 150;

const areFontFamiliesLoaded = (familiesKey: string): boolean => {
  return familiesKey.split(',').every((family) => document.fonts.check(`16px "${family}"`));
};

/**
 * Tracks the viewport size with a debounced ResizeObserver on documentElement.
 * Returns { width, height } that updates on resize.
 */
const useViewportSize = (): ViewportSize => {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = (): void => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    const handleResize = (): void => {
      clearTimeout(timer);
      timer = setTimeout(update, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);
    // Also observe visual viewport for mobile browser chrome changes
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return size;
};

/* ── useFontReady ─────────────────────────────────────────────── */

/**
 * Returns true once the specified font families have finished loading.
 * Uses document.fonts.ready to avoid measuring with fallback fonts.
 */
const useFontReady = (families: string[] = ['Newsreader', 'JetBrains Mono']): boolean => {
  const [ready, setReady] = useState(false);
  const familiesKey = families.join(',');

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const check = async (): Promise<void> => {
      try {
        await document.fonts.ready;
        if (areFontFamiliesLoaded(familiesKey)) {
          if (!cancelled) {
            setReady(true);
          }
          return;
        }
        // If not all loaded yet, wait a bit and retry
        await new Promise((r) => setTimeout(r, 100));
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [familiesKey]);

  return ready;
};

/* ── useDebouncedValue ────────────────────────────────────────── */

/**
 * Debounces a value by the specified delay.
 * Useful for preventing layout thrashing during rapid resize.
 */
const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  const firstRender = useRef(true);

  useEffect(() => {
    // Don't debounce the initial render
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

/* ── useStableCallback ────────────────────────────────────────── */

/**
 * Returns a stable function reference that always calls the latest callback.
 * Avoids re-triggering effects/memos that depend on callbacks.
 */
const useStableCallback = <Args extends unknown[], R>(callback: (...args: Args) => R): ((...args: Args) => R) => {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: Args) => ref.current(...args), []);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ViewportSize };
export { useViewportSize, useFontReady, useDebouncedValue, useStableCallback };
