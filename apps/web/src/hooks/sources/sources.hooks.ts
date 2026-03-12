import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";

import { useAuthHeaders, queryKeys } from "../../api/api.hooks.ts";
import { client } from "../../api/api.ts";
import { usePagination } from "../utilities/use-pagination.ts";
import { useFormPopulation } from "../utilities/use-form-population.ts";
import type { UsePaginationResult } from "../utilities/use-pagination.ts";

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

type SourceType = "rss" | "podcast";
type Direction = "newest" | "oldest";

// -- useSourcesList --

type UseSourcesListResult = {
  sources: Source[];
  loading: boolean;
  sourcesQuery: UseQueryResult<Source[], Error>;
  reanalyseMutation: UseMutationResult<void, Error, void, unknown>;
};

const useSourcesList = (): UseSourcesListResult => {
  const headers = useAuthHeaders();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET("/api/sources", { headers });
      return ((data as Source[]) ?? []).filter((s) => s.type !== "bookmarks");
    },
    enabled: !!headers,
  });

  const reanalyseMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.POST("/api/sources/reanalyse-all", { headers });
    },
  });

  return {
    sources: sourcesQuery.data ?? [],
    loading: sourcesQuery.isLoading,
    sourcesQuery,
    reanalyseMutation,
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
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("rss");
  const [direction, setDirection] = useState<Direction>("newest");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error: err } = await client.POST("/api/sources", {
        body: { name, url, type: sourceType, direction },
        headers,
      });
      if (err) {
        throw new Error(
          "error" in err ? (err as { error: string }).error : "Failed to create source",
        );
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: "/sources" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
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
    void navigate({ to: "/sources" });
  }, [navigate]);

  return {
    form: {
      name,
      setName,
      url,
      setUrl,
      sourceType,
      setSourceType,
      direction,
      setDirection,
      error,
    },
    createMutation,
    handleSubmit,
    navigateToSources,
    ready: !!headers,
  };
};

// -- useSourceDetail --

type UseSourceDetailParams = {
  sourceId: string;
};

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
  handleFetch: () => void;
  handleReanalyse: () => void;
  ready: boolean;
};

const PAGE_SIZE = 20;

const useSourceDetail = ({ sourceId }: UseSourceDetailParams): UseSourceDetailResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [reanalyseResult, setReanalyseResult] = useState<string | null>(null);

  // Pagination is declared before articlesQuery so offset is available for the query key.
  // The total updates on subsequent renders once articlesQuery resolves.
  const [articlesTotal, setArticlesTotal] = useState(0);

  const pagination = usePagination({
    pageSize: PAGE_SIZE,
    total: articlesTotal,
  });

  const sourceQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: async (): Promise<Source> => {
      const { data, error: err } = await client.GET("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) throw new Error("Source not found");
      return data as Source;
    },
    enabled: !!headers,
  });

  const articlesQuery = useQuery({
    queryKey: queryKeys.sources.articles(sourceId, pagination.offset),
    queryFn: async (): Promise<ArticlesPage> => {
      const { data } = await client.GET("/api/sources/{id}/articles", {
        params: {
          path: { id: sourceId },
          query: { offset: pagination.offset, limit: PAGE_SIZE },
        },
        headers,
      });
      const page = data as ArticlesPage;
      setArticlesTotal(page.total);
      return page;
    },
    enabled: !!headers,
  });

  const fetchMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error: err } = await client.POST("/api/sources/{id}/fetch", {
        params: { path: { id: sourceId } },
        headers,
      });

      if (err || !data) throw new Error("Failed to start fetch");

      const taskId = (data as { taskId: string }).taskId;

      const poll = (): Promise<string> =>
        new Promise((resolve, reject) => {
          const check = async (): Promise<void> => {
            const { data: task } = await client.GET("/api/sources/{id}/tasks/{taskId}", {
              params: { path: { id: sourceId, taskId } },
              headers,
            });

            if (!task) {
              reject(new Error("Lost track of task"));
              return;
            }

            const t = task as { status: string; result: unknown; error: string | null };

            if (t.status === "completed") {
              const result = t.result as { newArticles: number; totalItems: number } | null;
              resolve(
                result
                  ? `Fetched ${result.totalItems} items, ${result.newArticles} new`
                  : "Fetch completed",
              );
            } else if (t.status === "failed") {
              reject(new Error(t.error ?? "Fetch failed"));
            } else {
              setTimeout(() => void check(), 500);
            }
          };

          void check();
        });

      return poll();
    },
    onSuccess: (message: string): void => {
      setFetchResult(message);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sources.detail(sourceId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sources.articles(sourceId, pagination.offset),
      });
    },
    onError: (err: Error): void => {
      setFetchResult(err.message);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sources.detail(sourceId),
      });
    },
  });

  const reanalyseMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error: err } = await client.POST("/api/sources/{id}/reanalyse", {
        params: { path: { id: sourceId } },
        headers,
      });

      if (err || !data) throw new Error("Failed to start reanalysis");
      const result = data as { enqueued: number };
      return `Enqueued ${result.enqueued} articles for analysis`;
    },
    onSuccess: (message: string): void => {
      setReanalyseResult(message);
    },
    onError: (err: Error): void => {
      setReanalyseResult(err.message);
    },
  });

  const handleFetch = useCallback((): void => {
    setFetchResult(null);
    fetchMutation.mutate();
  }, [fetchMutation]);

  const handleReanalyse = useCallback((): void => {
    setReanalyseResult(null);
    reanalyseMutation.mutate();
  }, [reanalyseMutation]);

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
    handleFetch,
    handleReanalyse,
    ready: !!headers,
  };
};

// -- useEditSource --

type UseEditSourceParams = {
  sourceId: string;
};

type EditSourceForm = {
  name: string;
  setName: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  direction: string;
  setDirection: (value: string) => void;
  error: string | null;
};

type UseEditSourceResult = {
  source: Source | undefined;
  loading: boolean;
  sourceQuery: UseQueryResult<Source, Error>;
  form: EditSourceForm;
  updateMutation: UseMutationResult<void, Error, Record<string, string>, unknown>;
  deleteMutation: UseMutationResult<void, Error, void, unknown>;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  navigateToSource: () => void;
  ready: boolean;
};

const useEditSource = ({ sourceId }: UseEditSourceParams): UseEditSourceResult => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [direction, setDirection] = useState("newest");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sourceQuery = useQuery({
    queryKey: queryKeys.sources.detail(sourceId),
    queryFn: async (): Promise<Source> => {
      const { data, error: err } = await client.GET("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) throw new Error("Source not found");
      return data as Source;
    },
    enabled: !!headers,
  });

  useFormPopulation(sourceQuery.data, (data: Source): void => {
    setName(data.name);
    setUrl(data.url);
    setDirection(data.direction);
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, string>): Promise<void> => {
      const { error: err } = await client.PATCH("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        body,
        headers,
      });
      if (err) throw new Error("Failed to update source");
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.sources.detail(sourceId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: "/sources/$sourceId", params: { sourceId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error: err } = await client.DELETE("/api/sources/{id}", {
        params: { path: { id: sourceId } },
        headers,
      });
      if (err) throw new Error("Failed to delete source");
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await navigate({ to: "/sources" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);

      const source = sourceQuery.data;
      if (!source) return;

      const body: Record<string, string> = {};
      if (name !== source.name) body.name = name;
      if (url !== source.url) body.url = url;
      if (direction !== source.direction) body.direction = direction;

      if (Object.keys(body).length === 0) {
        await navigate({ to: "/sources/$sourceId", params: { sourceId } });
        return;
      }

      updateMutation.mutate(body);
    },
    [sourceQuery.data, name, url, direction, sourceId, navigate, updateMutation],
  );

  const navigateToSource = useCallback((): void => {
    void navigate({ to: "/sources/$sourceId", params: { sourceId } });
  }, [navigate, sourceId]);

  return {
    source: sourceQuery.data,
    loading: sourceQuery.isLoading,
    sourceQuery,
    form: { name, setName, url, setUrl, direction, setDirection, error },
    updateMutation,
    deleteMutation,
    confirmDelete,
    setConfirmDelete,
    handleSubmit,
    navigateToSource,
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
  UseEditSourceParams,
  EditSourceForm,
  UseEditSourceResult,
};

export { useSourcesList, useCreateSource, useSourceDetail, useEditSource, PAGE_SIZE };
