import { useEffect, useRef, useCallback } from 'react';

import { client } from '../../api/api.ts';

const STORAGE_PREFIX = 'editions:reading-progress:';
const SAVE_INTERVAL_MS = 3000;

/**
 * Tracks scroll-based reading progress for text articles.
 * Persists to localStorage continuously and to the server every 3 seconds.
 * Restores scroll position on mount.
 */
const useReadingProgress = (articleId: string, initialProgress: number): void => {
  const storageKey = STORAGE_PREFIX + articleId;
  const lastSave = useRef(0);
  const restored = useRef(false);

  const getScrollRatio = useCallback((): number => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) {
      return 0;
    }
    return Math.min(1, scrollTop / docHeight);
  }, []);

  const saveToServer = useCallback(
    (ratio: number): void => {
      client
        .PATCH('/api/articles/{articleId}/progress', {
          params: { path: { articleId } },
          body: { progress: ratio },
        })
        .catch(() => {});
    },
    [articleId],
  );

  // Restore scroll position on mount
  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;

    const restore = (): void => {
      // Check localStorage first (more precise — stores scroll ratio)
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const ratio = parseFloat(saved);
          if (Number.isFinite(ratio) && ratio > 0 && ratio < 1) {
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo({ top: ratio * docHeight, behavior: 'instant' });
            return;
          }
        }
      } catch {
        /* ignore */
      }

      // Fall back to server progress
      if (initialProgress > 0 && initialProgress < 1) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: initialProgress * docHeight, behavior: 'instant' });
      }
    };

    // Wait for content to render before restoring
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }, [storageKey, initialProgress]);

  // Track scroll and persist
  useEffect(() => {
    const onScroll = (): void => {
      const ratio = getScrollRatio();

      try {
        localStorage.setItem(storageKey, String(ratio));
      } catch {
        /* ignore */
      }

      const now = Date.now();
      if (now - lastSave.current >= SAVE_INTERVAL_MS) {
        lastSave.current = now;
        saveToServer(ratio);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      // Save final position on unmount
      const ratio = getScrollRatio();
      if (ratio > 0) {
        try {
          localStorage.setItem(storageKey, String(ratio));
        } catch {
          /* ignore */
        }
        saveToServer(ratio);
      }
    };
  }, [storageKey, getScrollRatio, saveToServer]);
};

export { useReadingProgress };
