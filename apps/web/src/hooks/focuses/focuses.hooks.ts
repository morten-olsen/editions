import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { useOptimisticMap } from '../utilities/use-optimistic-map.ts';
import { useFormPopulation } from '../utilities/use-form-population.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoteValue = 1 | -1 | null;

type SourceMode = 'always' | 'match';

type SourceSelection = {
  sourceId: string;
  mode: SourceMode;
  weight: number;
};

type Source = {
  id: string;
  name: string;
  url: string;
};

type FocusListItem = {
  id: string;
  name: string;
  description: string | null;
  sources: { sourceId: string; mode: SourceMode }[];
  createdAt: string;
};

type FocusDetail = {
  id: string;
  name: string;
  description: string | null;
  sources: { sourceId: string; mode: SourceMode }[];
  createdAt: string;
  updatedAt: string;
};

type FocusEditable = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sources: SourceSelection[];
};

type FocusArticle = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  readAt: string | null;
  confidence: number;
  score: number;
  vote: VoteValue;
  globalVote: VoteValue;
  sourceName: string;
  sourceType: string;
};

type FocusArticlesPage = {
  articles: FocusArticle[];
  total: number;
  offset: number;
  limit: number;
};

type ArticlesWithBookmarks = {
  page: FocusArticlesPage;
  bookmarkedIds: Set<string>;
};

type SortMode = 'top' | 'recent';
type TimeWindow = 'today' | 'week' | 'all';
type ReadStatus = 'all' | 'unread' | 'read';

type JobEntry = {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  affects: { sourceIds: string[]; focusIds: string[] };
};

type VoteOverride = { vote?: VoteValue; globalVote?: VoteValue };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const selectClasses =
  'rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent';

const priorityLabel = (w: number): string => {
  if (w <= 0.1) {
    return 'Off';
  }
  if (w < 0.75) {
    return 'Low';
  }
  if (w <= 1.25) {
    return 'Normal';
  }
  if (w <= 2.1) {
    return 'High';
  }
  return 'Top';
};

const confidenceHint = (v: number): string => {
  if (v === 0) {
    return 'All articles';
  }
  if (v <= 30) {
    return 'Loose match';
  }
  if (v <= 60) {
    return 'Moderate';
  }
  if (v <= 80) {
    return 'Strong match';
  }
  return 'Exact match';
};

// ---------------------------------------------------------------------------
// useFocusesList
// ---------------------------------------------------------------------------

type UseFocusesListResult = {
  focuses: FocusListItem[];
  isLoading: boolean;
  headers: Record<string, string> | undefined;
};

const useFocusesList = (): UseFocusesListResult => {
  const headers = useAuthHeaders();

  const { data: focuses = [], isLoading } = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<FocusListItem[]> => {
      const { data } = await client.GET('/api/focuses', { headers });
      return (data as FocusListItem[]) ?? [];
    },
    enabled: !!headers,
  });

  return { focuses, isLoading, headers };
};

// ---------------------------------------------------------------------------
// useFocusSourceSelection
// ---------------------------------------------------------------------------

type UseFocusSourceSelectionParams = {
  initialSources?: SourceSelection[];
};

type UseFocusSourceSelectionResult = {
  allSources: Source[];
  loadingSources: boolean;
  selectedSources: SourceSelection[];
  selectedIds: Set<string>;
  toggleSource: (sourceId: string) => void;
  changeMode: (sourceId: string, mode: SourceMode) => void;
  changeWeight: (sourceId: string, weight: number) => void;
  setSelectedSources: React.Dispatch<React.SetStateAction<SourceSelection[]>>;
};

const useFocusSourceSelection = (params?: UseFocusSourceSelectionParams): UseFocusSourceSelectionResult => {
  const headers = useAuthHeaders();
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>(params?.initialSources ?? []);

  const { data: allSources = [], isLoading: loadingSources } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET('/api/sources', { headers });
      return (data as Source[]) ?? [];
    },
    enabled: !!headers,
  });

  const toggleSource = useCallback((sourceId: string): void => {
    setSelectedSources((prev) => {
      const existing = prev.find((s) => s.sourceId === sourceId);
      if (existing) {
        return prev.filter((s) => s.sourceId !== sourceId);
      }
      return [...prev, { sourceId, mode: 'always' as const, weight: 1 }];
    });
  }, []);

  const changeMode = useCallback((sourceId: string, mode: SourceMode): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, mode } : s)));
  }, []);

  const changeWeight = useCallback((sourceId: string, weight: number): void => {
    setSelectedSources((prev) => prev.map((s) => (s.sourceId === sourceId ? { ...s, weight } : s)));
  }, []);

  const selectedIds = new Set(selectedSources.map((s) => s.sourceId));

  return {
    allSources,
    loadingSources,
    selectedSources,
    selectedIds,
    toggleSource,
    changeMode,
    changeWeight,
    setSelectedSources,
  };
};

// ---------------------------------------------------------------------------
// useCreateFocus
// ---------------------------------------------------------------------------

type UseCreateFocusResult = {
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
  isPending: boolean;
  submit: () => void;
  headers: Record<string, string> | undefined;
};

const useCreateFocus = (): UseCreateFocusResult => {
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

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const body: {
        name: string;
        description?: string;
        icon?: string | null;
        minConfidence?: number;
        minConsumptionTimeSeconds?: number | null;
        maxConsumptionTimeSeconds?: number | null;
        sources?: SourceSelection[];
      } = { name };
      if (description.trim()) {
        body.description = description.trim();
      }
      if (icon) {
        body.icon = icon;
      }
      if (minConfidence > 0) {
        body.minConfidence = minConfidence / 100;
      }
      const parsedMin = minReadingTime ? Number(minReadingTime) : null;
      const parsedMax = maxReadingTime ? Number(maxReadingTime) : null;
      if (parsedMin !== null) {
        body.minConsumptionTimeSeconds = parsedMin * 60;
      }
      if (parsedMax !== null) {
        body.maxConsumptionTimeSeconds = parsedMax * 60;
      }
      if (sourceSelection.selectedSources.length > 0) {
        body.sources = sourceSelection.selectedSources;
      }

      const { error: err } = await client.POST('/api/focuses', {
        body,
        headers,
      });

      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to create focus');
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await navigate({ to: '/focuses' });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const submit = useCallback((): void => {
    setError(null);
    createMutation.mutate();
  }, [createMutation]);

  return {
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
    isPending: createMutation.isPending,
    submit,
    headers,
  };
};

// ---------------------------------------------------------------------------
// useFocusDetail
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const ANALYSIS_JOB_TYPES = new Set([
  'reconcile_focus',
  'reanalyse_source',
  'reanalyse_all',
  'refresh_source',
  'extract_and_analyse',
]);

const windowToRange = (window: TimeWindow): { from?: string; to?: string } => {
  if (window === 'all') {
    return {};
  }
  const now = new Date();
  const from = new Date(now.getTime() - (window === 'today' ? 24 : 7 * 24) * 60 * 60 * 1000);
  return { from: from.toISOString() };
};

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
  const queryClient = useQueryClient();

  const [sort, setSort] = useState<SortMode>('top');
  const [window, setWindow] = useState<TimeWindow>('all');
  const [status, setStatus] = useState<ReadStatus>('unread');

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

  const [offset, setOffset] = useState(0);

  const { data: articlesData, isLoading: loadingArticles } = useQuery({
    queryKey: ['focuses', focusId, 'articles', { sort, window, status, offset }],
    queryFn: async (): Promise<ArticlesWithBookmarks> => {
      const range = windowToRange(window);
      const { data } = await client.GET('/api/focuses/{id}/articles', {
        params: {
          path: { id: focusId },
          query: {
            offset,
            limit: PAGE_SIZE,
            sort,
            status,
            ...range,
          },
        },
        headers,
      });

      const page = (data as FocusArticlesPage) ?? {
        articles: [],
        total: 0,
        offset: 0,
        limit: PAGE_SIZE,
      };

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

  const articlesPage = articlesData?.page ?? null;
  const serverBookmarkedIds = articlesData?.bookmarkedIds ?? new Set<string>();

  // Pagination derived values
  const total = articlesPage?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Analysis task polling when feed is empty
  const isEmpty = !loadingArticles && (!articlesPage || articlesPage.articles.length === 0);

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

  // When analysis transitions from running -> done, refetch articles
  const wasRunning = useRef(false);
  useEffect(() => {
    if (analysisRunning) {
      wasRunning.current = true;
    } else if (wasRunning.current && analysisRunning === false) {
      wasRunning.current = false;
      void queryClient.invalidateQueries({
        queryKey: ['focuses', focusId, 'articles'],
      });
    }
  }, [analysisRunning, queryClient, focusId]);

  // Vote overrides
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

  // Bookmark check
  const isBookmarked = useCallback(
    (articleId: string): boolean => bookmarkMap.get(articleId, serverBookmarkedIds.has(articleId)),
    [bookmarkMap, serverBookmarkedIds],
  );

  // Handlers
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
      currentPage,
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

  // Populate form from fetched focus data
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

      const patchBody: Record<string, string | number | null> = {};
      if (name !== focus.name) {
        patchBody.name = name;
      }
      const newDesc = description.trim() || null;
      if (newDesc !== focus.description) {
        patchBody.description = newDesc;
      }
      if (icon !== focus.icon) {
        patchBody.icon = icon;
      }
      const newMinConfidence = minConfidence / 100;
      if (newMinConfidence !== focus.minConfidence) {
        patchBody.minConfidence = newMinConfidence;
      }
      const newMinReading = minReadingTime ? Number(minReadingTime) * 60 : null;
      if (newMinReading !== focus.minConsumptionTimeSeconds) {
        patchBody.minConsumptionTimeSeconds = newMinReading;
      }
      const newMaxReading = maxReadingTime ? Number(maxReadingTime) * 60 : null;
      if (newMaxReading !== focus.maxConsumptionTimeSeconds) {
        patchBody.maxConsumptionTimeSeconds = newMaxReading;
      }

      const sourcesChanged =
        JSON.stringify(sourceSelection.selectedSources.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))) !==
        JSON.stringify(focus.sources.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId)));

      const hasFieldChanges = Object.keys(patchBody).length > 0;

      if (!hasFieldChanges && !sourcesChanged) {
        return;
      }

      if (hasFieldChanges) {
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.focuses.detail(focusId),
      });
      await navigate({ to: '/focuses/$focusId', params: { focusId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
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

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type {
  VoteValue,
  SourceMode,
  SourceSelection,
  Source,
  FocusListItem,
  FocusDetail,
  FocusEditable,
  FocusArticle,
  FocusArticlesPage,
  ArticlesWithBookmarks,
  SortMode,
  TimeWindow,
  ReadStatus,
  VoteOverride,
  UseFocusesListResult,
  UseFocusSourceSelectionParams,
  UseFocusSourceSelectionResult,
  UseCreateFocusResult,
  UseFocusDetailResult,
  UseEditFocusResult,
};

export {
  selectClasses,
  priorityLabel,
  confidenceHint,
  PAGE_SIZE,
  useFocusesList,
  useFocusSourceSelection,
  useCreateFocus,
  useFocusDetail,
  useEditFocus,
};
