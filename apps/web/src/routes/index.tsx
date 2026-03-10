import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
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
  readingTimeSeconds: number | null;
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
  const auth = useAuth();
  const [feedPage, setFeedPage] = useState<FeedPage | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<SortMode>("top");
  const [status, setStatus] = useState<ReadStatus>("unread");
  const [window, setWindow] = useState<TimeWindow>("all");

  const loadFeed = useCallback(async (
    newOffset: number,
    sortMode: SortMode,
    readStatus: ReadStatus,
    timeWindow: TimeWindow = "all",
  ): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data } = await client.GET("/api/feed", {
      params: {
        query: {
          offset: newOffset,
          limit: PAGE_SIZE,
          sort: sortMode,
          status: readStatus,
          ...windowToRange(timeWindow),
        },
      },
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      const page = data as FeedPage;
      setFeedPage(page);

      // Load bookmark status for these articles
      const articleIds = page.articles.map((a) => a.id);
      if (articleIds.length > 0) {
        const { data: bmData } = await client.POST("/api/bookmarks/check", {
          body: { articleIds },
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (bmData) {
          setBookmarkedIds(new Set((bmData as { bookmarkedIds: string[] }).bookmarkedIds));
        }
      }
    }
  }, [auth]);

  useEffect(() => {
    void (async (): Promise<void> => {
      await loadFeed(0, sort, status, window);
      setLoading(false);
    })();
  }, [loadFeed, sort, status, window]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

  const handleVote = async (articleId: string, value: VoteValue): Promise<void> => {
    setFeedPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.map((a) =>
          a.id === articleId ? { ...a, vote: value } : a,
        ),
      };
    });

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
  };

  const handleBookmarkToggle = async (articleId: string): Promise<void> => {
    const isBookmarked = bookmarkedIds.has(articleId);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });

    if (isBookmarked) {
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
  };

  const handleFilterChange = (
    newSort: SortMode = sort,
    newStatus: ReadStatus = status,
    newWindow: TimeWindow = window,
  ): void => {
    setSort(newSort);
    setStatus(newStatus);
    setWindow(newWindow);
    setOffset(0);
    void loadFeed(0, newSort, newStatus, newWindow);
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    void loadFeed(newOffset, sort, status, window);
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
      {loading ? (
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
                readingTimeSeconds={article.readingTimeSeconds}
                imageUrl={article.imageUrl}
                href={`/sources/${article.sourceId}/articles/${article.id}`}
                read={status === "all" ? !!article.readAt : false}
                vote={article.vote}
                onVote={(v) => void handleVote(article.id, v)}
                bookmarked={bookmarkedIds.has(article.id)}
                onBookmarkToggle={() => void handleBookmarkToggle(article.id)}
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

const Route = createFileRoute("/")({
  component: IndexPage,
});

export { Route };
