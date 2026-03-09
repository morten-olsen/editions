import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { Separator } from "../components/separator.tsx";

// --- Task types & helpers ---

type TaskItem = {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type TaskGroup = {
  type: string;
  completed: number;
  failed: number;
  tasks: TaskItem[];
};

const POLL_INTERVAL_MS = 3000;

const TASK_TYPE_LABELS: Record<string, string> = {
  fetch_source: "Fetch feed",
  extract_article: "Extract article",
  analyse_article: "Analyse article",
};

const formatTaskType = (type: string): string =>
  TASK_TYPE_LABELS[type] ?? type.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatTimeAgo = (ms: number): string => {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const formatDuration = (start: number, end: number): string => {
  const sec = Math.round((end - start) / 1000);
  if (sec < 1) return "<1s";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const groupFinishedTasks = (tasks: TaskItem[]): TaskGroup[] => {
  const map = new Map<string, TaskGroup>();
  for (const task of tasks) {
    let group = map.get(task.type);
    if (!group) {
      group = { type: task.type, completed: 0, failed: 0, tasks: [] };
      map.set(task.type, group);
    }
    if (task.status === "completed") group.completed++;
    else group.failed++;
    group.tasks.push(task);
  }
  return Array.from(map.values());
};

const TasksSection = ({ token }: { token: string }): React.ReactNode => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTasks = useCallback(async (): Promise<void> => {
    const { data } = await client.GET("/api/tasks", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data) {
      setTasks(data.tasks as TaskItem[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const hasActive = tasks.some((t) => t.status === "pending" || t.status === "running");

  useEffect(() => {
    if (hasActive) {
      intervalRef.current = setInterval(() => void loadTasks(), POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasActive, loadTasks]);

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-6 text-center">Loading...</div>;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks"
        description="Background tasks like source fetching and article analysis will appear here."
      />
    );
  }

  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running");
  const finishedTasks = tasks.filter((t) => t.status === "completed" || t.status === "failed");
  const groups = groupFinishedTasks(finishedTasks);

  const toggleGroup = (type: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Counts for the summary bar
  const pendingCount = activeTasks.filter((t) => t.status === "pending").length;
  const runningCount = activeTasks.filter((t) => t.status === "running").length;
  const completedCount = finishedTasks.filter((t) => t.status === "completed").length;
  const failedCount = finishedTasks.filter((t) => t.status === "failed").length;

  return (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        {runningCount > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {runningCount} running
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-ink-tertiary">{pendingCount} queued</span>
        )}
        {completedCount > 0 && (
          <span className="text-positive">{completedCount} completed</span>
        )}
        {failedCount > 0 && (
          <span className="text-critical">{failedCount} failed</span>
        )}
        {!hasActive && finishedTasks.length > 0 && (
          <span className="text-ink-faint ml-auto">
            last activity {formatTimeAgo(finishedTasks[0]!.completedAt ?? finishedTasks[0]!.createdAt)}
          </span>
        )}
      </div>

      {/* Active tasks — shown individually */}
      {activeTasks.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {activeTasks.map((task, idx) => (
            <div key={task.id} className={idx > 0 ? "border-t border-border" : ""}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${task.status === "running" ? "bg-accent animate-pulse" : "bg-ink-faint"}`} />
                <span className="text-sm text-ink flex-1">{formatTaskType(task.type)}</span>
                <span className="text-xs text-ink-tertiary">
                  {task.startedAt ? formatTimeAgo(task.startedAt) : "queued"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finished tasks — grouped by type */}
      {groups.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {groups.map((group, idx) => {
            const isExpanded = expandedGroups.has(group.type);
            const failedInGroup = group.tasks.filter((t) => t.status === "failed");

            return (
              <div key={group.type} className={idx > 0 ? "border-t border-border" : ""}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.type)}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-surface-hover transition-colors duration-fast cursor-pointer"
                >
                  <span className="shrink-0 text-xs text-ink-faint">{isExpanded ? "▾" : "▸"}</span>
                  <span className="text-sm text-ink flex-1">{formatTaskType(group.type)}</span>
                  <span className="flex items-center gap-2.5 text-xs">
                    {group.completed > 0 && (
                      <span className="text-positive">{group.completed} done</span>
                    )}
                    {group.failed > 0 && (
                      <span className="text-critical">{group.failed} failed</span>
                    )}
                  </span>
                </button>

                {isExpanded && failedInGroup.length > 0 && (
                  <div className="border-t border-border bg-surface-sunken">
                    {failedInGroup.map((task) => (
                      <div key={task.id} className="px-4 py-2.5 border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-critical font-medium">Failed</span>
                          <span className="text-xs text-ink-faint">
                            {task.completedAt ? formatTimeAgo(task.completedAt) : ""}
                            {task.startedAt && task.completedAt && ` · ${formatDuration(task.startedAt, task.completedAt)}`}
                          </span>
                        </div>
                        {task.error && (
                          <pre className="text-xs text-critical/80 font-mono whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                            {task.error}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && failedInGroup.length === 0 && (
                  <div className="border-t border-border bg-surface-sunken px-4 py-3">
                    <span className="text-xs text-ink-tertiary">All {group.completed} tasks completed successfully</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Vote types ---

type VoteWithArticle = {
  id: string;
  articleId: string;
  focusId: string | null;
  value: 1 | -1;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  sourceId: string;
  sourceName: string;
  focusName: string | null;
};

type VotesPage = {
  votes: VoteWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

type ScopeFilter = "all" | "global" | "focus";
type ValueFilter = "all" | "up" | "down";

const PAGE_SIZE = 30;

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

type SettingsTab = "tasks" | "votes";

const SettingsPage = (): React.ReactNode => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("tasks");
  const [votesPage, setVotesPage] = useState<VotesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [valueFilter, setValueFilter] = useState<ValueFilter>("all");

  const loadVotes = useCallback(async (
    newOffset: number,
    scope: ScopeFilter,
    value: ValueFilter,
  ): Promise<void> => {
    if (auth.status !== "authenticated") return;

    const query: Record<string, unknown> = {
      offset: newOffset,
      limit: PAGE_SIZE,
    };
    if (scope !== "all") query.scope = scope;
    if (value === "up") query.value = 1;
    if (value === "down") query.value = -1;

    const { data } = await client.GET("/api/votes", {
      params: { query: query as never },
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (data) {
      setVotesPage(data as VotesPage);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    void loadVotes(0, scopeFilter, valueFilter);
  }, [loadVotes, scopeFilter, valueFilter]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

  const handleFilterChange = (
    newScope: ScopeFilter = scopeFilter,
    newValue: ValueFilter = valueFilter,
  ): void => {
    setScopeFilter(newScope);
    setValueFilter(newValue);
    setOffset(0);
    setLoading(true);
    void loadVotes(0, newScope, newValue);
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    void loadVotes(newOffset, scopeFilter, valueFilter);
  };

  const handleRemove = async (vote: VoteWithArticle): Promise<void> => {
    await client.DELETE("/api/votes/{voteId}", {
      params: { path: { voteId: vote.id } },
      headers,
    });

    setVotesPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        votes: prev.votes.filter((v) => v.id !== vote.id),
        total: prev.total - 1,
      };
    });
  };

  const totalPages = votesPage ? Math.ceil(votesPage.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "tasks", label: "Tasks" },
    { key: "votes", label: "Votes" },
  ];

  return (
    <>
      <PageHeader title="Settings" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${activeTab === tab.key ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent" : "text-ink-tertiary hover:text-ink-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {activeTab === "tasks" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Running and recent background tasks</p>
          <TasksSection token={auth.token} />
        </>
      )}

      {/* Votes tab */}
      {activeTab === "votes" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Your feedback shapes how articles are ranked</p>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 border-b border-border">
          {(["all", "global", "focus"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleFilterChange(s)}
              className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${scopeFilter === s ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent" : "text-ink-tertiary hover:text-ink-secondary"}`}
            >
              {s === "all" ? "All" : s === "global" ? "Quality" : "Relevance"}
            </button>
          ))}
        </div>

        <select
          value={valueFilter}
          onChange={(e) => handleFilterChange(undefined, e.target.value as ValueFilter)}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
        >
          <option value="all">All votes</option>
          <option value="up">Upvotes</option>
          <option value="down">Downvotes</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !votesPage || votesPage.votes.length === 0 ? (
        <EmptyState
          title="No votes yet"
          description={
            scopeFilter === "all" && valueFilter === "all"
              ? "Vote on articles in your focus feeds or while reading to train the ranking system."
              : "No votes match the current filters."
          }
        />
      ) : (
        <>
          <div className="flex flex-col">
            {votesPage.votes.map((vote, idx) => (
              <div key={vote.id}>
                {idx > 0 && <Separator soft />}
                <div className="flex items-start gap-4 py-4">
                  <div className={`mt-0.5 shrink-0 w-5 text-center text-sm ${vote.value === 1 ? "text-accent" : "text-critical"}`}>
                    {vote.value === 1 ? "\u2191" : "\u2193"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      to="/sources/$sourceId/articles/$articleId"
                      params={{ sourceId: vote.sourceId, articleId: vote.articleId }}
                      className="font-serif text-sm font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast leading-snug line-clamp-1"
                    >
                      {vote.articleTitle}
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-tertiary">
                      <span>{vote.sourceName}</span>
                      <span className="text-ink-faint">·</span>
                      <span>{formatDate(vote.createdAt)}</span>
                      <span className="text-ink-faint">·</span>
                      {vote.focusId ? (
                        <Link
                          to="/focuses/$focusId"
                          params={{ focusId: vote.focusId }}
                          className="hover:text-accent transition-colors duration-fast"
                        >
                          {vote.focusName}
                        </Link>
                      ) : (
                        <span>Quality</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleRemove(vote)}
                    className="shrink-0 text-xs text-ink-faint hover:text-critical transition-colors duration-fast cursor-pointer mt-0.5"
                    aria-label="Remove vote"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {votesPage.total} vote{votesPage.total === 1 ? "" : "s"}
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
                disabled={offset + PAGE_SIZE >= votesPage.total}
                onClick={() => handlePageChange(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
        </>
      )}
    </>
  );
};

const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

export { Route };
