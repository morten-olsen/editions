import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { ArticleCard } from "../components/article-card.tsx";
import type { VoteValue } from "../components/vote-controls.tsx";

type Focus = {
  id: string;
  name: string;
  description: string | null;
  sources: { sourceId: string; mode: "always" | "match" }[];
  createdAt: string;
  updatedAt: string;
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
  vote: 1 | -1 | null;
  globalVote: 1 | -1 | null;
  sourceName: string;
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

type SortMode = "top" | "recent";
type TimeWindow = "today" | "week" | "all";
type ReadStatus = "all" | "unread" | "read";

const PAGE_SIZE = 20;

const CogIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
  </svg>
);

const windowToRange = (window: TimeWindow): { from?: string; to?: string } => {
  if (window === "all") return {};
  const now = new Date();
  const from = new Date(
    now.getTime() - (window === "today" ? 24 : 7 * 24) * 60 * 60 * 1000,
  );
  return { from: from.toISOString() };
};

const FocusDetailPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const { focusId } = Route.useParams();
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<SortMode>("top");
  const [window, setWindow] = useState<TimeWindow>("all");
  const [status, setStatus] = useState<ReadStatus>("unread");

  // Local optimistic state for votes and bookmarks
  const [voteOverrides, setVoteOverrides] = useState<Record<string, { vote?: VoteValue; globalVote?: VoteValue }>>({});
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({});

  const { data: focus, isLoading: loadingFocus, error: focusError } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<Focus> => {
      const { data, error: err } = await client.GET("/api/focuses/{id}", {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) throw new Error("Focus not found");
      return data as Focus;
    },
    enabled: !!headers,
  });

  const { data: articlesData, isLoading: loadingArticles } = useQuery({
    queryKey: ["focuses", focusId, "articles", { sort, window, status, offset }],
    queryFn: async (): Promise<ArticlesWithBookmarks> => {
      const range = windowToRange(window);
      const { data } = await client.GET("/api/focuses/{id}/articles", {
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

      const page = (data as FocusArticlesPage) ?? { articles: [], total: 0, offset: 0, limit: PAGE_SIZE };

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

      return { page, bookmarkedIds };
    },
    enabled: !!headers,
  });

  const articlesPage = articlesData?.page ?? null;
  const serverBookmarkedIds = articlesData?.bookmarkedIds ?? new Set<string>();

  if (!headers) return null;

  const handleFocusVote = async (articleId: string, value: VoteValue): Promise<void> => {
    setVoteOverrides((prev) => ({
      ...prev,
      [articleId]: { ...prev[articleId], vote: value },
    }));

    if (value === null) {
      await client.DELETE("/api/focuses/{id}/articles/{articleId}/vote", {
        params: { path: { id: focusId, articleId } },
        headers,
      });
    } else {
      await client.PUT("/api/focuses/{id}/articles/{articleId}/vote", {
        params: { path: { id: focusId, articleId } },
        body: { value },
        headers,
      });
    }
  };

  const handleGlobalVote = async (articleId: string, value: VoteValue): Promise<void> => {
    setVoteOverrides((prev) => ({
      ...prev,
      [articleId]: { ...prev[articleId], globalVote: value },
    }));

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
    const currentlyBookmarked = bookmarkOverrides[articleId] ?? serverBookmarkedIds.has(articleId);
    setBookmarkOverrides((prev) => ({
      ...prev,
      [articleId]: !currentlyBookmarked,
    }));

    if (currentlyBookmarked) {
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
    newWindow: TimeWindow = window,
    newStatus: ReadStatus = status,
  ): void => {
    setSort(newSort);
    setWindow(newWindow);
    setStatus(newStatus);
    setOffset(0);
    setVoteOverrides({});
    setBookmarkOverrides({});
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    setVoteOverrides({});
    setBookmarkOverrides({});
  };

  const loading = loadingFocus || loadingArticles;

  if (loading && !focus) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!focus) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{focusError ? "Focus not found" : "Focus not found"}</div>
      </div>
    );
  }

  const totalPages = articlesPage ? Math.ceil(articlesPage.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      {/* Header: name + cog */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-medium tracking-tight text-ink">
            {focus.name}
          </h1>
          {focus.description && (
            <div className="text-sm text-ink-secondary mt-1 leading-relaxed">
              {focus.description}
            </div>
          )}
        </div>
        <Link
          to="/focuses/$focusId/edit"
          params={{ focusId }}
          className="shrink-0 p-2 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast"
          aria-label="Edit focus settings"
        >
          <CogIcon />
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4 mb-6">
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

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={window}
            onChange={(e) => handleFilterChange(undefined, e.target.value as TimeWindow)}
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="today">Today</option>
          </select>

          <select
            value={status}
            onChange={(e) => handleFilterChange(undefined, undefined, e.target.value as ReadStatus)}
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Articles */}
      {!articlesPage || articlesPage.articles.length === 0 ? (
        <EmptyState
          title="No articles"
          description={
            sort === "top" && window === "all" && status === "unread"
              ? "You're all caught up! Switch to \"All\" to browse past articles."
              : sort === "top" && window === "all" && status === "all"
                ? "No articles have been classified into this focus yet."
                : "No articles match the current filters."
          }
        />
      ) : (
        <>
          <div className="divide-y divide-border">
            {articlesPage.articles.map((article) => {
              const overrides = voteOverrides[article.id];
              const focusVote = overrides?.vote !== undefined ? overrides.vote : article.vote;
              const globalVote = overrides?.globalVote !== undefined ? overrides.globalVote : article.globalVote;
              const bookmarked = bookmarkOverrides[article.id] ?? serverBookmarkedIds.has(article.id);

              return (
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
                  focusVote={focusVote}
                  onFocusVote={(v) => void handleFocusVote(article.id, v)}
                  vote={globalVote}
                  onVote={(v) => void handleGlobalVote(article.id, v)}
                  bookmarked={bookmarked}
                  onBookmarkToggle={() => void handleBookmarkToggle(article.id)}
                />
              );
            })}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {articlesPage.total} article{articlesPage.total === 1 ? "" : "s"}
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

const Route = createFileRoute("/focuses/$focusId/")({
  component: FocusDetailPage,
});

export { Route };
