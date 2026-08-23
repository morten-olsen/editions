import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useBookmarkStatus } from '../bookmarks/bookmarks.hooks.ts';
import { DEFAULT_TIME_WINDOW, windowToRange } from '../utilities/time-window.ts';
import type { TimeWindow } from '../utilities/time-window.ts';
import { useOptimisticMap } from '../utilities/use-optimistic-map.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

import { PAGE_SIZE, ANALYSIS_JOB_TYPES } from './focuses.utils.ts';
import type {
  VoteValue,
  FocusDetail,
  FocusArticle,
  FocusArticlesPage,
  SortMode,
  ReadStatus,
  VoteOverride,
} from './focuses.types.ts';

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
      const { data } = await client.GET('/api/jobs', { params: { query: { active: true } }, headers });
      return (data?.jobs ?? []).some(
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
};

type FilterActions = {
  handleFilterChange: (newSort?: SortMode, newWindow?: TimeWindow, newStatus?: ReadStatus) => void;
};

type FilterKey = { sort: SortMode; window: TimeWindow; status: ReadStatus };

const useFocusFilters = (
  voteMap: ReturnType<typeof useOptimisticMap<VoteOverride>>,
  resetPage: () => void,
  setFilterKey: (key: FilterKey) => void,
): FilterState & FilterActions => {
  const [sort, setSort] = useState<SortMode>('top');
  const [window, setWindow] = useState<TimeWindow>(DEFAULT_TIME_WINDOW);
  const [status, setStatus] = useState<ReadStatus>('unread');

  const handleFilterChange = useCallback(
    (newSort: SortMode = sort, newWindow: TimeWindow = window, newStatus: ReadStatus = status): void => {
      setSort(newSort);
      setWindow(newWindow);
      setStatus(newStatus);
      setFilterKey({ sort: newSort, window: newWindow, status: newStatus });
      resetPage();
      voteMap.reset();
    },
    [sort, window, status, voteMap, resetPage, setFilterKey],
  );

  return { sort, window, status, handleFilterChange };
};

// ---------------------------------------------------------------------------
// useFocusDetail
// ---------------------------------------------------------------------------

type UseFocusDetailResult = {
  focus: FocusDetail | undefined;
  loadingFocus: boolean;
  focusError: Error | null;
  articles: FocusArticle[];
  total: number;
  loadingArticles: boolean;
  analysisRunning: boolean | undefined;
  sort: SortMode;
  window: TimeWindow;
  status: ReadStatus;
  pagination: PagerControls;
  getVoteOverride: (articleId: string, serverVote: VoteValue) => VoteValue;
  getGlobalVoteOverride: (articleId: string, serverGlobalVote: VoteValue) => VoteValue;
  isBookmarked: (articleId: string) => boolean;
  handleFocusVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleGlobalVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleBookmarkToggle: (articleId: string) => void;
  handleFilterChange: (newSort?: SortMode, newWindow?: TimeWindow, newStatus?: ReadStatus) => void;
  headers: Record<string, string> | undefined;
};

const useFocusQuery = (
  focusId: string,
  headers: Record<string, string> | undefined,
): { focus: FocusDetail | undefined; isLoading: boolean; error: Error | null } => {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<FocusDetail> => {
      const { data: focus, error: err } = await client.GET('/api/focuses/{id}', {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) {
        throw new Error('Focus not found');
      }
      return focus as FocusDetail;
    },
    enabled: !!headers,
  });

  return { focus: data, isLoading, error: error as Error | null };
};

const useFocusArticlesPage = (
  focusId: string,
  headers: Record<string, string> | undefined,
  filterKey: FilterKey,
): ReturnType<typeof usePagedQuery<FocusArticle>> =>
  usePagedQuery<FocusArticle>({
    queryKey: (offset) => ['focuses', focusId, 'articles', { ...filterKey, offset }],
    fetchPage: async ({ offset, limit }): Promise<FocusArticlesPage> => {
      const { data } = await client.GET('/api/focuses/{id}/articles', {
        params: {
          path: { id: focusId },
          query: {
            offset,
            limit,
            sort: filterKey.sort,
            status: filterKey.status,
            ...windowToRange(filterKey.window),
          },
        },
        headers,
      });
      return data as FocusArticlesPage;
    },
    pageSize: PAGE_SIZE,
    enabled: !!headers,
  });

const useFocusDetail = (focusId: string): UseFocusDetailResult => {
  const headers = useAuthHeaders();
  const voteMap = useOptimisticMap<VoteOverride>();

  const { focus, isLoading: loadingFocus, error: focusError } = useFocusQuery(focusId, headers);

  const [filterKey, setFilterKey] = useState<FilterKey>({
    sort: 'top',
    window: DEFAULT_TIME_WINDOW,
    status: 'unread',
  });

  const paged = useFocusArticlesPage(focusId, headers, filterKey);
  const { sort, window, status, handleFilterChange } = useFocusFilters(voteMap, paged.pagination.reset, setFilterKey);

  // Paging invalidates optimistic vote state, which is keyed by article id.
  const pagination = useMemo(
    (): PagerControls => ({
      ...paged.pagination,
      goNext: (): void => {
        voteMap.reset();
        paged.pagination.goNext();
      },
      goPrev: (): void => {
        voteMap.reset();
        paged.pagination.goPrev();
      },
    }),
    [paged.pagination, voteMap],
  );

  const isEmpty = !paged.isLoading && paged.items.length === 0;
  const analysisRunning = useAnalysisPolling(headers, isEmpty, focusId);

  const { getVoteOverride, getGlobalVoteOverride } = useVoteOverrides(voteMap);
  const { isBookmarked, toggleBookmark } = useBookmarkStatus(paged.items.map((a) => a.id));
  const { handleFocusVote, handleGlobalVote } = useFocusVoteHandlers(focusId, headers, voteMap);

  return {
    focus,
    loadingFocus,
    focusError,
    articles: paged.items,
    total: paged.total,
    loadingArticles: paged.isLoading,
    analysisRunning,
    sort,
    window,
    status,
    pagination,
    getVoteOverride,
    getGlobalVoteOverride,
    isBookmarked,
    handleFocusVote,
    handleGlobalVote,
    handleBookmarkToggle: toggleBookmark,
    handleFilterChange,
    headers,
  };
};

export type { UseFocusDetailResult };
export { useFocusDetail };
