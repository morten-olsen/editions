import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { Page } from '../../api/api.ts';

type PagerControls = {
  offset: number;
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  reset: () => void;
};

type UsePagedQueryParams<T> = {
  /** Built per offset so each page is cached separately. */
  queryKey: (offset: number) => readonly unknown[];
  fetchPage: (params: { offset: number; limit: number }) => Promise<Page<T>>;
  pageSize: number;
  enabled?: boolean;
};

type UsePagedQueryResult<T> = {
  items: T[];
  total: number;
  isLoading: boolean;
  /** The active page's key — pass to `setQueryData` for optimistic updates. */
  queryKey: readonly unknown[];
  pagination: PagerControls;
};

/**
 * One query plus its pager.
 *
 * Owns the two things every paged list got wrong on its own:
 *
 * - **Total continuity.** `keepPreviousData` holds the previous page while the
 *   next one loads, so `total` never blinks to zero mid-fetch and the pager
 *   doesn't collapse. This replaces the `setState`-inside-`queryFn`, `useRef`
 *   and `?? 0` variants that each list had grown.
 * - **Offset clamping.** When a mutation shrinks the list (deleting a page's
 *   worth of rows), the stored offset can point past the end. The offset is
 *   clamped to the last real page instead of showing an empty one.
 */
const usePagedQuery = <T>({
  queryKey,
  fetchPage,
  pageSize,
  enabled = true,
}: UsePagedQueryParams<T>): UsePagedQueryResult<T> => {
  const [requestedOffset, setRequestedOffset] = useState(0);

  // The key the query actually runs under. Returned to callers as-is, so an
  // optimistic `setQueryData` always targets the live query even on the single
  // render where the requested offset is still being clamped.
  const activeKey = queryKey(requestedOffset);
  const query = useQuery<Page<T>>({
    queryKey: activeKey,
    queryFn: () => fetchPage({ offset: requestedOffset, limit: pageSize }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const maxOffset = totalPages > 0 ? (totalPages - 1) * pageSize : 0;
  const offset = Math.min(requestedOffset, maxOffset);

  // Only fires when the list shrank under us; keeps goNext/goPrev arithmetic
  // starting from the page actually being shown.
  useEffect(() => {
    if (requestedOffset > maxOffset) {
      setRequestedOffset(maxOffset);
    }
  }, [requestedOffset, maxOffset]);

  const goNext = useCallback((): void => {
    setRequestedOffset((prev) => prev + pageSize);
  }, [pageSize]);

  const goPrev = useCallback((): void => {
    setRequestedOffset((prev) => Math.max(0, prev - pageSize));
  }, [pageSize]);

  const reset = useCallback((): void => {
    setRequestedOffset(0);
  }, []);

  return {
    items: query.data?.items ?? [],
    total,
    isLoading: query.isLoading,
    queryKey: activeKey,
    pagination: {
      offset,
      currentPage: Math.floor(offset / pageSize) + 1,
      totalPages,
      hasPrev: offset > 0,
      hasNext: offset + pageSize < total,
      goNext,
      goPrev,
      reset,
    },
  };
};

export type { PagerControls, UsePagedQueryParams, UsePagedQueryResult };
export { usePagedQuery };
