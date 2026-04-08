/**
 * Paged Article — Hooks
 *
 * React hooks for the paged article layout:
 * - useViewportSize: tracks viewport dimensions with debounced resize
 * - useFontReady: waits for web fonts to load before measuring
 * - useDebouncedValue: debounces a value
 * - useStableCallback: stable function reference
 */

import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

/* ── useContainerSize ─────────────────────────────────────────── */

type ContainerSize = {
  width: number;
  height: number;
};

const RESIZE_DEBOUNCE_MS = 100;

/**
 * Tracks the size of a container element via ResizeObserver.
 * Falls back to window dimensions until the ref is attached.
 */
const useContainerSize = (ref: RefObject<HTMLElement | null>): ContainerSize => {
  const [size, setSize] = useState<ContainerSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const update = (): void => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };

    // Initial measurement
    update();

    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(update, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref]);

  return size;
};

/* ── useFontReady ─────────────────────────────────────────────── */

/**
 * Checks that all font weights/styles we use for pretext measurement are loaded.
 * A single `document.fonts.check('16px Newsreader')` only verifies the regular weight.
 * We need 400, 500, 600, and italic variants.
 */
const FONT_CHECKS = [
  '16px "Newsreader"',
  '500 16px "Newsreader"',
  '600 16px "Newsreader"',
  'italic 16px "Newsreader"',
  '16px "JetBrains Mono"',
  '16px "Inter"',
];

const useFontReady = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const check = async (): Promise<void> => {
      try {
        await document.fonts.ready;
        // Check all weights/styles — retry briefly if not all loaded
        for (let attempt = 0; attempt < 5; attempt++) {
          if (FONT_CHECKS.every((f) => document.fonts.check(f))) {
            if (!cancelled) setReady(true);
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        // Give up after 500ms — use whatever's loaded
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    };

    void check();
    return () => { cancelled = true; };
  }, []);

  return ready;
};

/* ── useDebouncedValue ────────────────────────────────────────── */

const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  const firstRender = useRef(true);

  useEffect(() => {
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

const useStableCallback = <Args extends unknown[], R>(
  callback: (...args: Args) => R,
): ((...args: Args) => R) => {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback((...args: Args) => ref.current(...args), []);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ContainerSize };
export { useContainerSize, useFontReady, useDebouncedValue, useStableCallback };
