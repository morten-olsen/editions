import { useState, useCallback, useEffect, useRef } from 'react';

import { useAuthHeaders } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';

const STORAGE_PREFIX = 'editions:magazine-page:';
const SAVE_DEBOUNCE_MS = 1500;

// Intentional no-op: progress saves are best-effort, failures are silently ignored
const noop = (): void => undefined;

type UseMagazineProgressResult = {
  page: number;
  setPage: (page: number) => void;
  savePage: (page: number) => void;
};

/**
 * Restores the last-viewed magazine page from localStorage on mount,
 * and persists page changes to both localStorage and the server.
 */
const useMagazineProgress = (editionId: string): UseMagazineProgressResult => {
  const storageKey = STORAGE_PREFIX + editionId;
  const headers = useAuthHeaders();

  const [page, setPage] = useState((): number => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (Number.isFinite(n) && n >= 0) {
          return n;
        }
      }
    } catch {
      /* ignore */
    }
    return 0;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const savePage = useCallback(
    (p: number): void => {
      try {
        localStorage.setItem(storageKey, String(p));
      } catch {
        /* ignore */
      }

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!headers) {
          return;
        }
        void client
          .PATCH('/api/editions/{editionId}/progress', {
            params: { path: { editionId } },
            body: { currentPosition: p },
            headers,
          })
          .catch(noop);
      }, SAVE_DEBOUNCE_MS);
    },
    [editionId, storageKey, headers],
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return { page, setPage, savePage };
};

export type { UseMagazineProgressResult };
export { useMagazineProgress };
