import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
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
  const auth = useAuth();
  const { sourceId } = Route.useParams();
  const [source, setSource] = useState<Source | null>(null);
  const [articlesPage, setArticlesPage] = useState<ArticlesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [reanalysing, setReanalysing] = useState(false);
  const [reanalyseResult, setReanalyseResult] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const loadSource = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data, error: err } = await client.GET("/api/sources/{id}", {
      params: { path: { id: sourceId } },
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (err) {
      setError("Source not found");
    } else {
      setSource(data as Source);
    }
  }, [auth, sourceId]);

  const loadArticles = useCallback(async (newOffset: number): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data } = await client.GET("/api/sources/{id}/articles", {
      params: { path: { id: sourceId }, query: { offset: newOffset, limit: PAGE_SIZE } },
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      setArticlesPage(data as ArticlesPage);
    }
  }, [auth, sourceId]);

  useEffect(() => {
    void (async (): Promise<void> => {
      await Promise.all([loadSource(), loadArticles(0)]);
      setLoading(false);
    })();
  }, [loadSource, loadArticles]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    void loadArticles(newOffset);
  };

  const handleFetch = async (): Promise<void> => {
    setFetching(true);
    setFetchResult(null);

    const { data, error: err } = await client.POST("/api/sources/{id}/fetch", {
      params: { path: { id: sourceId } },
      headers,
    });

    if (err || !data) {
      setFetchResult("Failed to start fetch");
      setFetching(false);
      return;
    }

    const taskId = (data as { taskId: string }).taskId;
    const poll = async (): Promise<void> => {
      const { data: task } = await client.GET("/api/sources/{id}/tasks/{taskId}", {
        params: { path: { id: sourceId, taskId } },
        headers,
      });

      if (!task) {
        setFetchResult("Lost track of task");
        setFetching(false);
        return;
      }

      const t = task as { status: string; result: unknown; error: string | null };

      if (t.status === "completed") {
        const result = t.result as { newArticles: number; totalItems: number } | null;
        setFetchResult(
          result
            ? `Fetched ${result.totalItems} items, ${result.newArticles} new`
            : "Fetch completed",
        );
        setFetching(false);
        void loadSource();
        void loadArticles(offset);
      } else if (t.status === "failed") {
        setFetchResult(t.error ?? "Fetch failed");
        setFetching(false);
        void loadSource();
      } else {
        setTimeout(() => void poll(), 500);
      }
    };

    void poll();
  };

  const handleReanalyse = async (): Promise<void> => {
    setReanalysing(true);
    setReanalyseResult(null);

    const { data, error: err } = await client.POST("/api/sources/{id}/reanalyse", {
      params: { path: { id: sourceId } },
      headers,
    });

    if (err || !data) {
      setReanalyseResult("Failed to start reanalysis");
    } else {
      const result = data as { enqueued: number };
      setReanalyseResult(`Enqueued ${result.enqueued} articles for analysis`);
    }
    setReanalysing(false);
  };

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!source) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? "Source not found"}</div>
      </div>
    );
  }

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
              disabled={reanalysing}
              onClick={() => void handleReanalyse()}
            >
              {reanalysing ? "Reanalysing..." : "Reanalyse"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={fetching}
              onClick={() => void handleFetch()}
            >
              {fetching ? "Fetching..." : "Fetch now"}
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
            <Button variant="primary" disabled={fetching} onClick={() => void handleFetch()}>
              {fetching ? "Fetching..." : "Fetch now"}
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
