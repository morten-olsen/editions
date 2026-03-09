import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { Separator } from "../components/separator.tsx";

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

const SettingsPage = (): React.ReactNode => {
  const auth = useAuth();
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

  return (
    <>
      <PageHeader title="Settings" />

      {/* Votes section */}
      <h2 className="text-lg font-medium text-ink mb-1">Votes</h2>
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
  );
};

const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

export { Route };
