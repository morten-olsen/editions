import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useOptimisticMap } from '../utilities/use-optimistic-map.ts';

import { PAGE_SIZE, ANALYSIS_JOB_TYPES, windowToRange } from './focuses.utils.ts';
import type {
  VoteValue,
  FocusDetail,
  FocusArticlesPage,
  ArticlesWithBookmarks,
  SortMode,
  TimeWindow,
  ReadStatus,
  JobEntry,
  VoteOverride,
} from './focuses.types.ts';

// ---------------------------------------------------------------------------
// useFocusArticlesQuery
// ---------------------------------------------------------------------------

type FocusArticlesQueryParams = {
  focusId: string;
  headers: Record<string, string> | undefined;
  sort: SortMode;
  window: TimeWindow;
  status: ReadStatus;
  offset: number;
};

const useFocusArticlesQuery = (
  params: FocusArticlesQueryParams,
): { data: ArticlesWithBookmarks | undefined; isLoading: boolean } => {
  const { focusId, headers, sort, window, status, offset } = params;
  return useQuery({
    queryKey: ['focuses', focusId, 'articles', { sort, window, status, offset }],
    queryFn: async (): Promise<ArticlesWithBookmarks> => {
      const range = windowToRange(window);
      const { data } = await client.GET('/api/focuses/{id}/articles', {
        params: {
          path: { id: focusId },
          query: { offset, limit: PAGE_SIZE, sort, status, ...range },
        },
        headers,
      });

      const page = (data as FocusArticlesPage) ?? { articles: [], total: 0, offset: 0, limit: PAGE_SIZE };

      let bookmarkedIds = new Set<string>();
      const articleIds = page.articles.map((a) => a.id);
      if (articleIds.length > 0) {
        const { data: bmData } = await client.POST('/api/bookmarks/check', {
          body: { articleIds },
          headers,
        });
        if (bmData) {
          bookmarkedIds = new Set((bmData as { bookmarkedIds: string[] }).bookmarkedIds);
        }
      }

      return { page, bookmarkedIds };
    },
    enabled: !!headers,
  });
};

// ---------------------------------------------------------------------------
// useAnalysisPolling
// ---------------------------------------------------------------------------

const useAnalysisPolling = (
  headers: Record<string, string> | undefined,
  isEmpty: boolean,
  focusId: string,
): boolean | undefined => {
  const queryClient = useQueryClient();

  const { data: analysisRunning } = useQuery({
    queryKey: ['jobs', 'analysis-running'],
    queryFn: async (): Promise<boolean> => {
      const res = await fetch('/api/jobs?active=true', {
        headers: headers as Record<string, string>,
      });
      if (!res.ok) {
        return false;
      }
      const body = (await res.json()) as { jobs: JobEntry[] };
      return body.jobs.some(
        (j) => ANALYSIS_JOB_TYPES.has(j.type) && (j.status === 'pending' || j.status === 'running'),
      );
    },
    enabled: !!headers && isEmpty,
    refetchInterval: (query) => (query.state.data ? 2000 : false),
  });

  const wasRunning = useRef(false);
  useEffect(() => {
    if (analysisRunning) {
      wasRunning.current = true;
    } else if (wasRunning.current && analysisRunning === false) {
      wasRunning.current = false;
      void queryClient.invalidateQueries({ queryKey: ['focuses', focusId, 'articles'] });
    }
  }, [analysisRunning, queryClient, focusId]);

  return analysisRunning;
};

// ---------------------------------------------------------------------------
// useFocusVoteHandlers
// ---------------------------------------------------------------------------

const useFocusVoteHandlers = (
  focusId: string,
  headers: Record<string, string> | undefined,
  voteMap: ReturnType<typeof useOptimisticMap<VoteOverride>>,
): {
  handleFocusVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleGlobalVote: (articleId: string, value: VoteValue) => Promise<void>;
} => {
  const handleFocusVote = useCallback(
    async (articleId: string, value: VoteValue): Promise<void> => {
      const existing = voteMap.overrides[articleId] ?? {};
      voteMap.set(articleId, { ...existing, vote: value });
      if (value === null) {
        await client.DELETE('/api/focuses/{id}/articles/{articleId}/vote', {
          params: { path: { id: focusId, articleId } },
          headers,
        });
      } else {
        await client.PUT('/api/focuses/{id}/articles/{articleId}/vote', {
          params: { path: { id: focusId, articleId } },
          body: { value },
          headers,
        });
      }
    },
    [focusId, headers, voteMap],
  );

  const handleGlobalVote = useCallback(
    async (articleId: string, value: VoteValue): Promise<void> => {
      const existing = voteMap.overrides[articleId] ?? {};
      voteMap.set(articleId, { ...existing, globalVote: value });
      if (value === null) {
        await client.DELETE('/api/articles/{articleId}/vote', {
          params: { path: { articleId } },
          headers,
        });
      } else {
        await client.PUT('/api/articles/{articleId}/vote', {
          params: { path: { articleId } },
          body: { value },
          headers,
        });
      }
    },
    [headers, voteMap],
  );

  return { handleFocusVote, handleGlobalVote };
};

// ---------------------------------------------------------------------------
// useBookmarkHandler
// ---------------------------------------------------------------------------

const useBookmarkHandler = (
  headers: Record<string, string> | undefined,
  bookmarkMap: ReturnType<typeof useOptimisticMap<boolean>>,
  serverBookmarkedIds: Set<string>,
): ((articleId: string) => Promise<void>) =>
  useCallback(
    async (articleId: string): Promise<void> => {
      const currentlyBookmarked = bookmarkMap.get(articleId, serverBookmarkedIds.has(articleId));
      bookmarkMap.set(articleId, !currentlyBookmarked);
      if (currentlyBookmarked) {
        await client.DELETE('/api/articles/{articleId}/bookmark', {
          params: { path: { articleId } },
          headers,
        });
      } else {
        await client.PUT('/api/articles/{articleId}/bookmark', {
          params: { path: { articleId } },
          headers,
        });
      }
    },
    [headers, bookmarkMap, serverBookmarkedIds],
  );

// ---------------------------------------------------------------------------
// useVoteOverrides
// ---------------------------------------------------------------------------

type VoteOverrideAccessors = {
  getVoteOverride: (articleId: string, serverVote: VoteValue) => VoteValue;
  getGlobalVoteOverride: (articleId: string, serverGlobalVote: VoteValue) => VoteValue;
};

const useVoteOverrides = (voteMap: ReturnType<typeof useOptimisticMap<VoteOverride>>): VoteOverrideAccessors => {
  const getVoteOverride = useCallback(
    (articleId: string, serverVote: VoteValue): VoteValue => {
      const override = voteMap.overrides[articleId];
      return override?.vote !== undefined ? override.vote : serverVote;
    },
    [voteMap.overrides],
  );

  const getGlobalVoteOverride = useCallback(
    (articleId: string, serverGlobalVote: VoteValue): VoteValue => {
      const override = voteMap.overrides[articleId];
      return override?.globalVote !== undefined ? override.globalVote : serverGlobalVote;
    },
    [voteMap.overrides],
  );

  return { getVoteOverride, getGlobalVoteOverride };
};

// ---------------------------------------------------------------------------
// useFilterAndPagination
// ---------------------------------------------------------------------------

type FilterState = {
  sort: SortMode;
  window: TimeWindow;
  status: ReadStatus;
  offset: number;
};

type FilterActions = {
  handleFilterChange: (newSort?: SortMode, newWindow?: TimeWindow, newStatus?: ReadStatus) => void;
  handlePageChange: (newOffset: number) => void;
};

const useFilterAndPagination = (
  voteMap: ReturnType<typeof useOptimisticMap<VoteOverride>>,
  bookmarkMap: ReturnType<typeof useOptimisticMap<boolean>>,
): FilterState & FilterActions => {
  const [sort, setSort] = useState<SortMode>('top');
  const [window, setWindow] = useState<TimeWindow>('all');
  const [status, setStatus] = useState<ReadStatus>('unread');
  const [offset, setOffset] = useState(0);

  const handleFilterChange = useCallback(
    (newSort: SortMode = sort, newWindow: TimeWindow = window, newStatus: ReadStatus = status): void => {
      setSort(newSort);
      setWindow(newWindow);
      setStatus(newStatus);
      setOffset(0);
      voteMap.reset();
      bookmarkMap.reset();
    },
    [sort, window, status, voteMap, bookmarkMap],
  );

  const handlePageChange = useCallback(
    (newOffset: number): void => {
      setOffset(newOffset);
      voteMap.reset();
      bookmarkMap.reset();
    },
    [voteMap, bookmarkMap],
  );

  return { sort, window, status, offset, handleFilterChange, handlePageChange };
};

// ---------------------------------------------------------------------------
// useFocusDetail
// ---------------------------------------------------------------------------

type UseFocusDetailResult = {
  focus: FocusDetail | undefined;
  loadingFocus: boolean;
  focusError: Error | null;
  articlesPage: FocusArticlesPage | null;
  loadingArticles: boolean;
  analysisRunning: boolean | undefined;
  sort: SortMode;
  window: TimeWindow;
  status: ReadStatus;
  pagination: {
    offset: number;
    currentPage: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
  getVoteOverride: (articleId: string, serverVote: VoteValue) => VoteValue;
  getGlobalVoteOverride: (articleId: string, serverGlobalVote: VoteValue) => VoteValue;
  isBookmarked: (articleId: string) => boolean;
  handleFocusVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleGlobalVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleBookmarkToggle: (articleId: string) => Promise<void>;
  handleFilterChange: (newSort?: SortMode, newWindow?: TimeWindow, newStatus?: ReadStatus) => void;
  handlePageChange: (newOffset: number) => void;
  headers: Record<string, string> | undefined;
};

const useFocusDetail = (focusId: string): UseFocusDetailResult => {
  const headers = useAuthHeaders();
  const voteMap = useOptimisticMap<VoteOverride>();
  const bookmarkMap = useOptimisticMap<boolean>();
  const { sort, window, status, offset, handleFilterChange, handlePageChange } = useFilterAndPagination(
    voteMap,
    bookmarkMap,
  );

  const {
    data: focus,
    isLoading: loadingFocus,
    error: focusError,
  } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<FocusDetail> => {
      const { data, error: err } = await client.GET('/api/focuses/{id}', {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) {
        throw new Error('Focus not found');
      }
      return data as FocusDetail;
    },
    enabled: !!headers,
  });

  const { data: articlesData, isLoading: loadingArticles } = useFocusArticlesQuery({
    focusId,
    headers,
    sort,
    window,
    status,
    offset,
  });

  const articlesPage = articlesData?.page ?? null;
  const serverBookmarkedIds = useMemo(
    () => articlesData?.bookmarkedIds ?? new Set<string>(),
    [articlesData?.bookmarkedIds],
  );

  const total = articlesPage?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;

  const isEmpty = !loadingArticles && (!articlesPage || articlesPage.articles.length === 0);
  const analysisRunning = useAnalysisPolling(headers, isEmpty, focusId);

  const { getVoteOverride, getGlobalVoteOverride } = useVoteOverrides(voteMap);

  const isBookmarked = useCallback(
    (articleId: string): boolean => bookmarkMap.get(articleId, serverBookmarkedIds.has(articleId)),
    [bookmarkMap, serverBookmarkedIds],
  );

  const { handleFocusVote, handleGlobalVote } = useFocusVoteHandlers(focusId, headers, voteMap);
  const handleBookmarkToggle = useBookmarkHandler(headers, bookmarkMap, serverBookmarkedIds);

  return {
    focus,
    loadingFocus,
    focusError: focusError as Error | null,
    articlesPage,
    loadingArticles,
    analysisRunning,
    sort,
    window,
    status,
    pagination: {
      offset,
      currentPage: Math.floor(offset / PAGE_SIZE) + 1,
      totalPages,
      hasPrev: offset > 0,
      hasNext: offset + PAGE_SIZE < total,
    },
    getVoteOverride,
    getGlobalVoteOverride,
    isBookmarked,
    handleFocusVote,
    handleGlobalVote,
    handleBookmarkToggle,
    handleFilterChange,
    handlePageChange,
    headers,
  };
};

export type { UseFocusDetailResult };
export { useFocusDetail };
