import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useOptimisticMap } from '../utilities/use-optimistic-map.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

import { PAGE_SIZE, ANALYSIS_JOB_TYPES, windowToRange } from './focuses.utils.ts';
import { useFocusSourceSelection } from './focuses.hooks.ts';
import type {
  VoteValue,
  SourceSelection,
  FocusDetail,
  FocusEditable,
  FocusArticlesPage,
  ArticlesWithBookmarks,
  SortMode,
  TimeWindow,
  ReadStatus,
  JobEntry,
  VoteOverride,
} from './focuses.types.ts';
import type { UseFocusSourceSelectionResult } from './focuses.hooks.ts';

// ---------------------------------------------------------------------------
// useFocusDetail — sub-hooks
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
  const [sort, setSort] = useState<SortMode>('top');
  const [window, setWindow] = useState<TimeWindow>('all');
  const [status, setStatus] = useState<ReadStatus>('unread');
  const [offset, setOffset] = useState(0);

  const voteMap = useOptimisticMap<VoteOverride>();
  const bookmarkMap = useOptimisticMap<boolean>();

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

  const isBookmarked = useCallback(
    (articleId: string): boolean => bookmarkMap.get(articleId, serverBookmarkedIds.has(articleId)),
    [bookmarkMap, serverBookmarkedIds],
  );

  const { handleFocusVote, handleGlobalVote } = useFocusVoteHandlers(focusId, headers, voteMap);

  const handleBookmarkToggle = useCallback(
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

// ---------------------------------------------------------------------------
// useEditFocus — helper functions
// ---------------------------------------------------------------------------

type EditFocusFields = {
  name: string;
  description: string;
  icon: string | null;
  minConfidence: number;
  minReadingTime: string;
  maxReadingTime: string;
};

const buildEditFocusPatch = (focus: FocusEditable, fields: EditFocusFields): Record<string, string | number | null> => {
  const patchBody: Record<string, string | number | null> = {};
  if (fields.name !== focus.name) {
    patchBody.name = fields.name;
  }
  const newDesc = fields.description.trim() || null;
  if (newDesc !== focus.description) {
    patchBody.description = newDesc;
  }
  if (fields.icon !== focus.icon) {
    patchBody.icon = fields.icon;
  }
  const newMinConfidence = fields.minConfidence / 100;
  if (newMinConfidence !== focus.minConfidence) {
    patchBody.minConfidence = newMinConfidence;
  }
  const newMinReading = fields.minReadingTime ? Number(fields.minReadingTime) * 60 : null;
  if (newMinReading !== focus.minConsumptionTimeSeconds) {
    patchBody.minConsumptionTimeSeconds = newMinReading;
  }
  const newMaxReading = fields.maxReadingTime ? Number(fields.maxReadingTime) * 60 : null;
  if (newMaxReading !== focus.maxConsumptionTimeSeconds) {
    patchBody.maxConsumptionTimeSeconds = newMaxReading;
  }
  return patchBody;
};

const haveSourcesChanged = (selected: SourceSelection[], original: SourceSelection[]): boolean =>
  JSON.stringify(selected.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))) !==
  JSON.stringify(original.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId)));

// ---------------------------------------------------------------------------
// useEditFocus
// ---------------------------------------------------------------------------

type UseEditFocusResult = {
  focus: FocusEditable | undefined;
  loadingFocus: boolean;
  focusError: boolean;
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  icon: string | null;
  setIcon: React.Dispatch<React.SetStateAction<string | null>>;
  minConfidence: number;
  setMinConfidence: React.Dispatch<React.SetStateAction<number>>;
  minReadingTime: string;
  setMinReadingTime: React.Dispatch<React.SetStateAction<string>>;
  maxReadingTime: string;
  setMaxReadingTime: React.Dispatch<React.SetStateAction<string>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  sourceSelection: UseFocusSourceSelectionResult;
  loading: boolean;
  isPending: boolean;
  submit: () => void;
  headers: Record<string, string> | undefined;
};

const useEditFocus = (focusId: string): UseEditFocusResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState('');
  const [maxReadingTime, setMaxReadingTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sourceSelection = useFocusSourceSelection();

  const {
    data: focus,
    isLoading: loadingFocus,
    isError: focusError,
  } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<FocusEditable> => {
      const { data, error: err } = await client.GET('/api/focuses/{id}', {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) {
        throw new Error('Focus not found');
      }
      return data as unknown as FocusEditable;
    },
    enabled: !!headers,
  });

  useFormPopulation(focus, (data) => {
    setName(data.name);
    setDescription(data.description ?? '');
    setIcon(data.icon);
    setMinConfidence(Math.round(data.minConfidence * 100));
    setMinReadingTime(data.minConsumptionTimeSeconds !== null ? String(data.minConsumptionTimeSeconds / 60) : '');
    setMaxReadingTime(data.maxConsumptionTimeSeconds !== null ? String(data.maxConsumptionTimeSeconds / 60) : '');
    sourceSelection.setSelectedSources(data.sources);
  });

  const updateMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!focus) {
        return;
      }
      const patchBody = buildEditFocusPatch(focus, {
        name,
        description,
        icon,
        minConfidence,
        minReadingTime,
        maxReadingTime,
      });
      const sourcesChanged = haveSourcesChanged(sourceSelection.selectedSources, focus.sources);
      if (Object.keys(patchBody).length === 0 && !sourcesChanged) {
        return;
      }
      if (Object.keys(patchBody).length > 0) {
        const { error: err } = await client.PATCH('/api/focuses/{id}', {
          params: { path: { id: focusId } },
          body: patchBody,
          headers,
        });
        if (err) {
          throw new Error('Failed to update focus');
        }
      }
      if (sourcesChanged) {
        const { error: err } = await client.PUT('/api/focuses/{id}/sources', {
          params: { path: { id: focusId } },
          body: { sources: sourceSelection.selectedSources },
          headers,
        });
        if (err) {
          throw new Error('Failed to update sources');
        }
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.detail(focusId) });
      await navigate({ to: '/focuses/$focusId', params: { focusId } });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const submit = useCallback((): void => {
    setError(null);
    updateMutation.mutate();
  }, [updateMutation]);

  return {
    focus,
    loadingFocus,
    focusError,
    name,
    setName,
    description,
    setDescription,
    icon,
    setIcon,
    minConfidence,
    setMinConfidence,
    minReadingTime,
    setMinReadingTime,
    maxReadingTime,
    setMaxReadingTime,
    error,
    setError,
    sourceSelection,
    loading: loadingFocus || sourceSelection.loadingSources,
    isPending: updateMutation.isPending,
    submit,
    headers,
  };
};

export type { UseFocusDetailResult, UseEditFocusResult };
export { useFocusDetail, useEditFocus };
