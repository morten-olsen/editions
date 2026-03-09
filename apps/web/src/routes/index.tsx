import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { ArticleCard } from "../components/article-card.tsx";
import { Separator } from "../components/separator.tsx";
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

type TaskItem = {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type SortMode = "top" | "recent";
type ReadStatus = "all" | "unread" | "read";

const PAGE_SIZE = 20;

const TASK_TYPE_LABELS: Record<string, string> = {
  fetch_source: "Fetching feed",
  extract_article: "Extracting article",
  analyse_article: "Analysing article",
};

const formatTaskType = (type: string): string =>
  TASK_TYPE_LABELS[type] ?? type;

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const TaskRow = ({ task }: { task: TaskItem }): React.ReactElement => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink">{formatTaskType(task.type)}</span>
        {task.status === "failed" ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-critical hover:text-critical/80 cursor-pointer"
          >
            {expanded ? "collapse" : "error"}
          </button>
        ) : (
          <span className="text-xs text-ink-tertiary">
            {task.status === "running" && task.startedAt
              ? formatDuration(Date.now() - task.startedAt)
              : task.status === "completed" && task.completedAt && task.startedAt
                ? formatDuration(task.completedAt - task.startedAt)
                : "queued"}
          </span>
        )}
      </div>
      {expanded && task.error && (
        <pre className="mt-2 text-xs text-critical/80 bg-critical-subtle rounded-md p-3 overflow-auto max-h-32">
          {task.error}
        </pre>
      )}
    </div>
  );
};

const IndexPage = (): React.ReactNode => {
  const auth = useAuth();
  const [feedPage, setFeedPage] = useState<FeedPage | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<SortMode>("top");
  const [status, setStatus] = useState<ReadStatus>("all");

  // Task monitoring
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFeed = useCallback(async (
    newOffset: number,
    sortMode: SortMode,
    readStatus: ReadStatus,
  ): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data } = await client.GET("/api/feed", {
      params: {
        query: {
          offset: newOffset,
          limit: PAGE_SIZE,
          sort: sortMode,
          status: readStatus,
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

  const loadTasks = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data } = await client.GET("/api/tasks", {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      setTasks((data as { tasks: TaskItem[] }).tasks);
    }
  }, [auth]);

  useEffect(() => {
    void (async (): Promise<void> => {
      await Promise.all([loadFeed(0, sort, status), loadTasks()]);
      setLoading(false);
    })();
  }, [loadFeed, loadTasks, sort, status]);

  const hasActive = tasks.some((t) => t.status === "pending" || t.status === "running");

  useEffect(() => {
    if (hasActive) {
      pollRef.current = setInterval(() => void loadTasks(), 1000);
    }
    return (): void => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActive, loadTasks]);

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
  ): void => {
    setSort(newSort);
    setStatus(newStatus);
    setOffset(0);
    void loadFeed(0, newSort, newStatus);
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    void loadFeed(newOffset, sort, status);
  };

  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
  const failedTasks = tasks.filter((t) => t.status === "failed");

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

        <select
          value={status}
          onChange={(e) => handleFilterChange(undefined, e.target.value as ReadStatus)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
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
            sort === "top" && status === "all"
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

      {/* Task activity */}
      {(activeTasks.length > 0 || failedTasks.length > 0) && (
        <>
          <Separator soft className="my-6" />
          <div className="max-w-md">
            {activeTasks.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-ink-tertiary tracking-wide uppercase">Active</span>
                  <span className="size-1.5 rounded-full bg-caution animate-pulse" />
                </div>
                <div className="divide-y divide-border">
                  {activeTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {failedTasks.length > 0 && (
              <div>
                <div className="text-xs font-medium text-critical tracking-wide uppercase mb-2">
                  Failed ({failedTasks.length})
                </div>
                <div className="divide-y divide-border">
                  {failedTasks.slice(0, 10).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

const Route = createFileRoute("/")({
  component: IndexPage,
});

export { Route };
