import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { Separator } from "../components/separator.tsx";
import { ArticleCard } from "../components/article-card.tsx";

type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  lastFetchedAt: string | null;
  fetchError: string | null;
  createdAt: string;
  updatedAt: string;
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

const PAGE_SIZE = 20;

const SourceDetailPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const { sourceId } = Route.useParams();
  const [offset, setOffset] = useState(0);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [reanalyseResult, setReanalyseResult] = useState<string | null>(null);

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
    queryKey: queryKeys.sources.articles(sourceId, offset),
    queryFn: async (): Promise<ArticlesPage> => {
      const { data } = await client.GET("/api/sources/{id}/articles", {
        params: { path: { id: sourceId }, query: { offset, limit: PAGE_SIZE } },
        headers,
      });
      return data as ArticlesPage;
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

      // Poll task status until completion
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(sourceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources.articles(sourceId, offset) });
    },
    onError: (err: Error): void => {
      setFetchResult(err.message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources.detail(sourceId) });
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

  if (!headers) return null;

  const loading = sourceQuery.isLoading || articlesQuery.isLoading;

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  const source = sourceQuery.data;
  const articlesPage = articlesQuery.data ?? null;

  if (!source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{sourceQuery.error?.message ?? "Source not found"}</div>
      </div>
    );
  }

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
  };

  const handleFetch = (): void => {
    setFetchResult(null);
    fetchMutation.mutate();
  };

  const handleReanalyse = (): void => {
    setReanalyseResult(null);
    reanalyseMutation.mutate();
  };

  const totalPages = articlesPage ? Math.ceil(articlesPage.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeader
        title={source.name}
        subtitle={source.url}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/sources/$sourceId/edit" params={{ sourceId }}>
              <Button variant="ghost" size="sm">Edit</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              disabled={reanalyseMutation.isPending}
              onClick={handleReanalyse}
            >
              {reanalyseMutation.isPending ? "Reanalysing..." : "Reanalyse"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={fetchMutation.isPending}
              onClick={handleFetch}
            >
              {fetchMutation.isPending ? "Fetching..." : "Fetch now"}
            </Button>
          </div>
        }
      />

      {/* Status messages */}
      {source.fetchError && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4">
          {source.fetchError}
        </div>
      )}
      {fetchResult && (
        <div className="text-sm text-ink-secondary mb-4">{fetchResult}</div>
      )}
      {reanalyseResult && (
        <div className="text-sm text-ink-secondary mb-4">{reanalyseResult}</div>
      )}

      {/* Source meta */}
      <div className="flex items-center gap-4 text-xs text-ink-tertiary mb-6">
        {source.lastFetchedAt && (
          <span>Last fetched {new Date(source.lastFetchedAt).toLocaleString()}</span>
        )}
        {articlesPage && <span>{articlesPage.total} articles</span>}
      </div>

      <Separator soft className="mb-6" />

      {/* Articles */}
      {!articlesPage || articlesPage.articles.length === 0 ? (
        <EmptyState
          title="No articles yet"
          description="Try fetching the feed to pull in articles."
          action={
            <Button variant="primary" disabled={fetchMutation.isPending} onClick={handleFetch}>
              {fetchMutation.isPending ? "Fetching..." : "Fetch now"}
            </Button>
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border">
            {articlesPage.articles.map((article) => (
              <ArticleCard
                key={article.id}
                id={article.id}
                title={article.title}
                sourceName={source.name}
                author={article.author}
                summary={article.summary}
                imageUrl={article.imageUrl}
                publishedAt={article.publishedAt}

                href={`/sources/${sourceId}/articles/${article.id}`}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => handlePageChange(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-xs text-ink-tertiary">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset + PAGE_SIZE >= articlesPage.total}
                onClick={() => handlePageChange(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};

const Route = createFileRoute("/sources/$sourceId/")({
  component: SourceDetailPage,
});

export { Route };
