import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { ArticleCard } from "../components/article-card.tsx";
import type { VoteValue } from "../components/vote-controls.tsx";

type FeedArticle = {
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
  score: number;
  vote: 1 | -1 | null;
  sourceName: string;
};

type FeedPage = {
  articles: FeedArticle[];
  total: number;
  offset: number;
  limit: number;
};

type FeedData = {
  feedPage: FeedPage;
  bookmarkedIds: Set<string>;
};

type SortMode = "top" | "recent";
type ReadStatus = "all" | "unread" | "read";
type TimeWindow = "today" | "week" | "all";

const PAGE_SIZE = 20;

const windowToRange = (w: TimeWindow): { from?: string } => {
  if (w === "all") return {};
  const ms = w === "today" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return { from: new Date(Date.now() - ms).toISOString() };
};

const IndexPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<SortMode>("top");
  const [status, setStatus] = useState<ReadStatus>("unread");
  const [window, setWindow] = useState<TimeWindow>("all");

  const queryKey = queryKeys.feed({ sort, status, window, offset });

  const { data, isLoading } = useQuery<FeedData>({
    queryKey,
    queryFn: async (): Promise<FeedData> => {
      const { data: feedData } = await client.GET("/api/feed", {
        params: {
          query: {
            offset,
            limit: PAGE_SIZE,
            sort,
            status,
            ...windowToRange(window),
          },
        },
        headers,
      });

      const page = feedData as FeedPage;
      let bookmarkedIds = new Set<string>();

      const articleIds = page.articles.map((a) => a.id);
      if (articleIds.length > 0) {
        const { data: bmData } = await client.POST("/api/bookmarks/check", {
          body: { articleIds },
          headers,
        });
        if (bmData) {
          bookmarkedIds = new Set((bmData as { bookmarkedIds: string[] }).bookmarkedIds);
        }
      }

      return { feedPage: page, bookmarkedIds };
    },
    enabled: !!headers,
  });

  const feedPage = data?.feedPage ?? null;
  const bookmarkedIds = data?.bookmarkedIds ?? new Set<string>();

  const voteMutation = useMutation({
    mutationFn: async ({ articleId, value }: { articleId: string; value: VoteValue }): Promise<void> => {
      if (value === null) {
        await client.DELETE("/api/articles/{articleId}/vote", {
          params: { path: { articleId } },
          headers,
        });
      } else {
        await client.PUT("/api/articles/{articleId}/vote", {
          params: { path: { articleId } },
          body: { value },
          headers,
        });
      }
    },
    onMutate: async ({ articleId, value }): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<FeedData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          feedPage: {
            ...old.feedPage,
            articles: old.feedPage.articles.map((a) =>
              a.id === articleId ? { ...a, vote: value } : a,
            ),
          },
        };
      });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ articleId, bookmarked }: { articleId: string; bookmarked: boolean }): Promise<void> => {
      if (bookmarked) {
        await client.DELETE("/api/articles/{articleId}/bookmark", {
          params: { path: { articleId } },
          headers,
        });
      } else {
        await client.PUT("/api/articles/{articleId}/bookmark", {
          params: { path: { articleId } },
          headers,
        });
      }
    },
    onMutate: async ({ articleId, bookmarked }): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<FeedData>(queryKey, (old) => {
        if (!old) return old;
        const next = new Set(old.bookmarkedIds);
        if (bookmarked) {
          next.delete(articleId);
        } else {
          next.add(articleId);
        }
        return { ...old, bookmarkedIds: next };
      });
    },
  });

  const handleFilterChange = (
    newSort: SortMode = sort,
    newStatus: ReadStatus = status,
    newWindow: TimeWindow = window,
  ): void => {
    setSort(newSort);
    setStatus(newStatus);
    setWindow(newWindow);
    setOffset(0);
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
  };

  const totalPages = feedPage ? Math.ceil(feedPage.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeader
        title="Feed"
        subtitle="Your latest articles, ranked by importance"
        serif
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
        <div className="flex gap-1 border-b border-border">
          {(["top", "recent"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleFilterChange(s)}
              className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${sort === s ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent" : "text-ink-tertiary hover:text-ink-secondary"}`}
            >
              {s === "top" ? "Top" : "Recent"}
            </button>
          ))}
        </div>

        <select
          value={window}
          onChange={(e) => handleFilterChange(undefined, undefined, e.target.value as TimeWindow)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
        >
          <option value="all">All time</option>
          <option value="week">This week</option>
          <option value="today">Today</option>
        </select>

        <select
          value={status}
          onChange={(e) => handleFilterChange(undefined, e.target.value as ReadStatus)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !feedPage || feedPage.articles.length === 0 ? (
        <EmptyState
          title="No articles"
          description={
            sort === "top" && status === "unread"
              ? "You're all caught up! Switch to \"All\" to browse past articles."
              : sort === "top" && status === "all"
                ? "Articles will appear here once your sources have been fetched and processed."
                : "No articles match the current filters."
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border">
            {feedPage.articles.map((article) => (
              <ArticleCard
                key={article.id}
                id={article.id}
                title={article.title}
                sourceName={article.sourceName}
                author={article.author}
                summary={article.summary}
                publishedAt={article.publishedAt}
                consumptionTimeSeconds={article.consumptionTimeSeconds}
                imageUrl={article.imageUrl}
                href={`/sources/${article.sourceId}/articles/${article.id}`}
                read={status === "all" ? !!article.readAt : false}
                vote={article.vote}
                onVote={(v) => voteMutation.mutate({ articleId: article.id, value: v })}
                bookmarked={bookmarkedIds.has(article.id)}
                onBookmarkToggle={() => bookmarkMutation.mutate({ articleId: article.id, bookmarked: bookmarkedIds.has(article.id) })}
              />
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {feedPage.total} article{feedPage.total === 1 ? "" : "s"}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
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
                disabled={offset + PAGE_SIZE >= feedPage.total}
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

const Route = createFileRoute("/feed/")({
  component: IndexPage,
});

export { Route };
