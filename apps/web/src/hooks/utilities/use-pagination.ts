import { useState, useCallback } from 'react';

type UsePaginationParams = {
  pageSize: number;
  total: number;
};

type UsePaginationResult = {
  offset: number;
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  reset: () => void;
  setOffset: (offset: number) => void;
};

const usePagination = ({ pageSize, total }: UsePaginationParams): UsePaginationResult => {
  const [offset, setOffset] = useState(0);

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const currentPage = Math.floor(offset / pageSize) + 1;

  const goNext = useCallback((): void => {
    setOffset((prev) => prev + pageSize);
  }, [pageSize]);

  const goPrev = useCallback((): void => {
    setOffset((prev) => Math.max(0, prev - pageSize));
  }, [pageSize]);

  const reset = useCallback((): void => {
    setOffset(0);
  }, []);

  return {
    offset,
    currentPage,
    totalPages,
    hasPrev: offset > 0,
    hasNext: offset + pageSize < total,
    goNext,
    goPrev,
    reset,
    setOffset,
  };
};

export type { UsePaginationResult };
export { usePagination };
