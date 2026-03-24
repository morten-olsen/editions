import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import { usePagination } from '../utilities/use-pagination.ts';
import type { UsePaginationResult } from '../utilities/use-pagination.ts';

import { pollFetchTask } from './sources.utils.ts';

// -- Shared types --

type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  lastFetchedAt: string | null;
  fetchError: string | null;
  createdAt: string;
  updatedAt: string;
  direction: string;
};

type Article = {
  id: string;
  title: string;
  url: string | null;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

type ArticlesPage = {
  articles: Article[];
  total: number;
  offset: number;
  limit: number;
};

type SourceType = 'rss' | 'podcast';
type Direction = 'newest' | 'oldest';

// -- useSourcesList --

type UseSourcesListResult = {
  sources: Source[];
  loading: boolean;
  sourcesQuery: UseQueryResult<Source[], Error>;
  reanalyseMutation: UseMutationResult<void, Error, void, unknown>;
  reExtractMutation: UseMutationResult<void, Error, void, unknown>;
};

const useSourcesList = (): UseSourcesListResult => {
  const headers = useAuthHeaders();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET('/api/sources', { headers });
      return ((data as Source[]) ?? []).filter((s) => s.type !== 'bookmarks');
    },
    enabled: !!headers,
  });

  const reanalyseMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.POST('/api/sources/reanalyse-all', { headers });
    },
  });

  const reExtractMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await fetch('/api/sources/re-extract-all', { method: 'POST', headers });
    },
  });

  return {
    sources: sourcesQuery.data ?? [],
    loading: sourcesQuery.isLoading,
    sourcesQuery,
    reanalyseMutation,
    reExtractMutation,
  };
};

// -- useCreateSource --

type CreateSourceForm = {
  name: string;
  setName: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  sourceType: SourceType;
  setSourceType: (value: SourceType) => void;
  direction: Direction;
  setDirection: (value: Direction) => void;
  error: string | null;
};

type UseCreateSourceResult = {
  form: CreateSourceForm;
  createMutation: UseMutationResult<void, Error, void, unknown>;
  handleSubmit: (e: React.FormEvent) => void;
  navigateToSources: () => void;
  ready: boolean;
};

const useCreateSource = (): UseCreateSourceResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('rss');
  const [direction, setDirection] = useState<Direction>('newest');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error: err } = await client.POST('/api/sources', {
        body: { name, url, type: sourceType, direction },
        headers,
      });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to create source');
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: '/sources' });
    },
    onError: (err: Error): void => setError(err.message),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      setError(null);
      createMutation.mutate();
    },
    [createMutation],
  );

  const navigateToSources = useCallback((): void => {
    void navigate({ to: '/sources' });
  }, [navigate]);

  return {
    form: { name, setName, url, setUrl, sourceType, setSourceType, direction, setDirection, error },
    createMutation,
    handleSubmit,
    navigateToSources,
    ready: !!headers,
  };
};

// -- useSourceDetail helpers --

type UseSourceDetailParams = { sourceId: string };

type UseSourceDetailResult = {
  source: Source | undefined;
  articlesPage: ArticlesPage | null;
  loading: boolean;
  sourceQuery: UseQueryResult<Source, Error>;
  articlesQuery: UseQueryResult<ArticlesPage, Error>;
  pagination: UsePaginationResult;
  fetchMutation: UseMutationResult<string, Error, void, unknown>;
  fetchResult: string | null;
  reanalyseMutation: UseMutationResult<string, Error, void, unknown>;
  reanalyseResult: string | null;
  reExtractMutation: UseMutationResult<string, Error, void, unknown>;
  reExtractResult: string | null;
  handleFetch: () => void;
  handleReanalyse: () => void;
  handleReExtract: () => void;
  ready: boolean;
};

const PAGE_SIZE = 20;

type SourceDetailDeps = {
  sourceId: string;
  headers: Record<string, string> | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  paginationOffset: number;
};

const useFetchSourceMutation = (
  deps: SourceDetailDeps,
  setFetchResult: React.Dispatch<React.SetStateAction<string | null>>,
): UseMutationResult<string, Error, void, unknown> =>
  useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error: err } = await client.POST('/api/sources/{id}/fetch', {
        params: { path: { id: deps.sourceId } },
        headers: deps.headers,
      });
      if (err || !data) {
        throw new Error('Failed to start fetch');
      }
      return pollFetchTask(data.jobId, deps.headers);
    },
    onSuccess: (message: string): void => {
      setFetchResult(message);
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(deps.sourceId) });
      void deps.queryClient.invalidateQueries({
        queryKey: queryKeys.sources.articles(deps.sourceId, deps.paginationOffset),
      });
    },
    onError: (err: Error): void => {
      setFetchResult(err.message);
      void deps.queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(deps.sourceId) });
    },
  });

const useReanalyseSourceMutation = (
  deps: SourceDetailDeps,
  setReanalyseResult: React.Dispatch<React.SetStateAction<string | null>>,
): UseMutationResult<string, Error, void, unknown> =>
  useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error: err } = await client.POST('/api/sources/{id}/reanalyse', {
        params: { path: { id: deps.sourceId } },
        headers: deps.headers,
      });
      if (err || !data) {
        throw new Error('Failed to start reanalysis');
      }
      return `Enqueued ${(data as { enqueued: number }).enqueued} articles for analysis`;
    },
    onSuccess: (message: string): void => setReanalyseResult(message),
    onError: (err: Error): void => setReanalyseResult(err.message),
  });

const useReExtractSourceMutation = (
  deps: SourceDetailDeps,
  setReExtractResult: React.Dispatch<React.SetStateAction<string | null>>,
): UseMutationResult<string, Error, void, unknown> =>
  useMutation({
    mutationFn: async (): Promise<string> => {
      const res = await fetch(`/api/sources/${deps.sourceId}/re-extract`, {
        method: 'POST',
        headers: deps.headers,
      });
      if (!res.ok) {
        throw new Error('Failed to start re-extraction');
      }
      const data = (await res.json()) as { enqueued: number };
      return `Enqueued ${data.enqueued} articles for re-extraction`;
    },
    onSuccess: (message: string): void => setReExtractResult(message),
    onError: (err: Error): void => setReExtractResult(err.message),
  });

// -- useSourceDetail --

const useSourceDetail = ({ sourceId }: UseSourceDetailParams): UseSourceDetailResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [reanalyseResult, setReanalyseResult] = useState<string | null>(null);
  const [reExtractResult, setReExtractResult] = useState<string | null>(null);

  const [articlesTotal, setArticlesTotal] = useState(0);
  const pagination = usePagination({ pageSize: PAGE_SIZE, total: articlesTotal });

  const sourceQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: async (): Promise<Source> => {
      const { data, error: err } = await client.GET('/api/sources/{id}', {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) {
        throw new Error('Source not found');
      }
      return data as Source;
    },
    enabled: !!headers,
  });

  const articlesQuery = useQuery({
    queryKey: queryKeys.sources.articles(sourceId, pagination.offset),
    queryFn: async (): Promise<ArticlesPage> => {
      const { data } = await client.GET('/api/sources/{id}/articles', {
        params: { path: { id: sourceId }, query: { offset: pagination.offset, limit: PAGE_SIZE } },
        headers,
      });
      const page = data as ArticlesPage;
      setArticlesTotal(page.total);
      return page;
    },
    enabled: !!headers,
  });

  const deps: SourceDetailDeps = { sourceId, headers, queryClient, paginationOffset: pagination.offset };
  const fetchMutation = useFetchSourceMutation(deps, setFetchResult);
  const reanalyseMutation = useReanalyseSourceMutation(deps, setReanalyseResult);
  const reExtractMutation = useReExtractSourceMutation(deps, setReExtractResult);

  return {
    source: sourceQuery.data,
    articlesPage: articlesQuery.data ?? null,
    loading: sourceQuery.isLoading || articlesQuery.isLoading,
    sourceQuery,
    articlesQuery,
    pagination,
    fetchMutation,
    fetchResult,
    reanalyseMutation,
    reanalyseResult,
    reExtractMutation,
    reExtractResult,
    handleFetch: useCallback((): void => {
      setFetchResult(null);
      fetchMutation.mutate();
    }, [fetchMutation]),
    handleReanalyse: useCallback((): void => {
      setReanalyseResult(null);
      reanalyseMutation.mutate();
    }, [reanalyseMutation]),
    handleReExtract: useCallback((): void => {
      setReExtractResult(null);
      reExtractMutation.mutate();
    }, [reExtractMutation]),
    ready: !!headers,
  };
};

// -- Exports --

export type {
  Source,
  Article,
  ArticlesPage,
  SourceType,
  Direction,
  UseSourcesListResult,
  CreateSourceForm,
  UseCreateSourceResult,
  UseSourceDetailParams,
  UseSourceDetailResult,
};

export type { UseEditSourceParams, EditSourceForm, UseEditSourceResult } from './sources.edit-hooks.ts';

export { useEditSource } from './sources.edit-hooks.ts';

// -- useClassificationStats --

type FocusStat = { focusId: string; focusName: string; articleCount: number; avgConfidence: number };
type SourceClassificationStats = { sourceId: string; focuses: FocusStat[] };

const useClassificationStats = (): { stats: Map<string, FocusStat[]>; isLoading: boolean } => {
  const headers = useAuthHeaders();

  const { data, isLoading } = useQuery({
    queryKey: ['sources', 'classification-stats'],
    queryFn: async (): Promise<SourceClassificationStats[]> => {
      const res = await fetch('/api/sources/classification-stats', { headers });
      if (!res.ok) {
        return [];
      }
      return (await res.json()) as SourceClassificationStats[];
    },
    enabled: !!headers,
    staleTime: 30_000,
  });

  const stats = new Map<string, FocusStat[]>();
  for (const entry of data ?? []) {
    stats.set(entry.sourceId, entry.focuses);
  }
  return { stats, isLoading };
};

export type { FocusStat };
export { useSourcesList, useCreateSource, useSourceDetail, useClassificationStats, PAGE_SIZE };
