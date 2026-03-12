import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { useAi } from "../ai/ai.ts";
import { client } from "../api/api.ts";
import { useJobs, formatJobType, formatTimeAgo, formatDuration } from "../hooks/jobs/jobs.hooks.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Button } from "../components/button.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { Separator } from "../components/separator.tsx";
import { Input } from "../components/input.tsx";

import type { AiConfig } from "../ai/ai.ts";

// --- Jobs section ---

const JobsSection = ({ token }: { token: string }): React.ReactNode => {
  const {
    loading,
    jobs,
    hasActive,
    activeJobs,
    finishedGroups,
    expandedGroups,
    toggleGroup,
    counts,
  } = useJobs(token);

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-6 text-center">Loading...</div>;
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs"
        description="Background jobs like source fetching and article analysis will appear here."
      />
    );
  }

  const finishedJobs = jobs.filter((j) => j.status === "completed" || j.status === "failed");

  return (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        {counts.running > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {counts.running} running
          </span>
        )}
        {counts.pending > 0 && (
          <span className="text-ink-tertiary">{counts.pending} queued</span>
        )}
        {counts.completed > 0 && (
          <span className="text-positive">{counts.completed} completed</span>
        )}
        {counts.failed > 0 && (
          <span className="text-critical">{counts.failed} failed</span>
        )}
        {!hasActive && finishedJobs.length > 0 && (
          <span className="text-ink-faint ml-auto">
            last activity {formatTimeAgo(finishedJobs[0]!.completedAt ?? finishedJobs[0]!.createdAt)}
          </span>
        )}
      </div>

      {/* Active jobs — shown individually */}
      {activeJobs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {activeJobs.map((job, idx) => (
            <div key={job.id} className={idx > 0 ? "border-t border-border" : ""}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${job.status === "running" ? "bg-accent animate-pulse" : "bg-ink-faint"}`} />
                <span className="text-sm text-ink flex-1">{formatJobType(job.type)}</span>
                {job.progress && (
                  <span className="text-xs text-ink-faint">{job.progress.phase}</span>
                )}
                <span className="text-xs text-ink-tertiary">
                  {job.startedAt ? formatTimeAgo(job.startedAt) : "queued"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finished jobs — grouped by type */}
      {finishedGroups.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {finishedGroups.map((group, idx) => {
            const isExpanded = expandedGroups.has(group.type);
            const failedInGroup = group.jobs.filter((j) => j.status === "failed");

            return (
              <div key={group.type} className={idx > 0 ? "border-t border-border" : ""}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.type)}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-surface-hover transition-colors duration-fast cursor-pointer"
                >
                  <span className="shrink-0 text-xs text-ink-faint">{isExpanded ? "\u25be" : "\u25b8"}</span>
                  <span className="text-sm text-ink flex-1">{formatJobType(group.type)}</span>
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
                    {failedInGroup.map((job) => (
                      <div key={job.id} className="px-4 py-2.5 border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-critical font-medium">Failed</span>
                          <span className="text-xs text-ink-faint">
                            {job.completedAt ? formatTimeAgo(job.completedAt) : ""}
                            {job.startedAt && job.completedAt && ` \u00b7 ${formatDuration(job.startedAt, job.completedAt)}`}
                          </span>
                        </div>
                        {job.error && (
                          <pre className="text-xs text-critical/80 font-mono whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                            {job.error}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && failedInGroup.length === 0 && (
                  <div className="border-t border-border bg-surface-sunken px-4 py-3">
                    <span className="text-xs text-ink-tertiary">All {group.completed} jobs completed successfully</span>
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

// --- Scoring types & section ---

type ScoringWeightSet = {
  alpha: number;
  beta: number;
  gamma: number;
};

type UserScoringWeights = {
  global: ScoringWeightSet;
  focus: ScoringWeightSet;
  edition: ScoringWeightSet;
};

type ScoringResponse = {
  weights: UserScoringWeights;
  defaults: UserScoringWeights;
  isCustom: boolean;
};

type FeedType = "global" | "focus" | "edition";

type FeedConfig = {
  label: string;
  description: string;
  explanation: string;
};

const FEED_CONFIG: Record<FeedType, FeedConfig> = {
  global: {
    label: "Global Feed",
    description: "All articles across sources, without focus filtering.",
    explanation: "The global feed has no focus context, so confidence is unused by default. Ranking relies on your vote history and recency. Raise recency to keep the feed fresh; raise votes to surface articles similar to ones you've liked.",
  },
  focus: {
    label: "Focus Feeds",
    description: "Articles within a specific focus topic.",
    explanation: "Focus feeds use all three signals. Confidence measures how well an article matches the topic — raising it surfaces on-topic articles more strongly. Vote signal is scoped: votes cast within a focus teach it your preferences for that topic specifically, layered on top of your global votes.",
  },
  edition: {
    label: "Editions",
    description: "Curated, finite editions assembled from your focuses.",
    explanation: "Editions already filter by a time window (lookback hours), so recency matters less here — confidence and votes drive selection. Editions also apply source budgeting and per-focus weights on top of this score, so these weights shape the ordering within each source's allocation.",
  },
};

type WeightConfig = {
  label: string;
  short: string;
  detail: string;
};

const WEIGHT_CONFIG: Record<keyof ScoringWeightSet, WeightConfig> = {
  alpha: {
    label: "Confidence (α)",
    short: "Topic relevance",
    detail: "How well the article matches the focus, from the classifier (0.0–1.0). Set to 0 to ignore topic fit entirely; raise it to strongly prefer on-topic articles.",
  },
  beta: {
    label: "Votes (β)",
    short: "Personalisation",
    detail: "Your upvotes and downvotes, propagated to similar articles via semantic embeddings. Only the 15 most similar voted articles contribute — a few votes go a long way. Raise this to make ranking more personal; lower it for a more neutral feed.",
  },
  gamma: {
    label: "Recency (γ)",
    short: "Freshness",
    detail: "Exponential decay with a 3-day half-life — an article published today scores 1.0, after 3 days it scores 0.5, after 6 days 0.25. Raise this to prioritise breaking news; lower it to surface older gems.",
  },
};

const WeightSlider = ({
  id,
  config,
  value,
  onChange,
}: {
  id: string;
  config: WeightConfig;
  value: number;
  onChange: (v: number) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink">{config.label}</span>
        <span className="text-xs text-ink-faint">{config.short}</span>
      </div>
      <span className="text-xs text-ink-tertiary tabular-nums w-8 text-right">{value.toFixed(1)}</span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.1}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-accent h-1.5 cursor-pointer"
      data-ai-id={id}
      data-ai-role="input"
      data-ai-label={`${config.label} weight`}
      data-ai-value={value.toFixed(1)}
    />
    <p className="text-xs text-ink-faint leading-relaxed">{config.detail}</p>
  </div>
);

const FeedWeightsCard = ({
  feedType,
  weights,
  defaults,
  onChange,
}: {
  feedType: FeedType;
  weights: ScoringWeightSet;
  defaults: ScoringWeightSet;
  onChange: (w: ScoringWeightSet) => void;
}): React.ReactNode => {
  const feed = FEED_CONFIG[feedType];
  const isDefault =
    weights.alpha === defaults.alpha &&
    weights.beta === defaults.beta &&
    weights.gamma === defaults.gamma;

  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-5" data-ai-id={`scoring-${feedType}`} data-ai-role="section" data-ai-label={feed.label}>
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-ink">{feed.label}</h3>
            <p className="text-xs text-ink-tertiary mt-0.5">{feed.description}</p>
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange({ ...defaults })}
              className="text-xs text-ink-faint hover:text-accent transition-colors duration-fast cursor-pointer shrink-0"
              data-ai-id={`scoring-${feedType}-reset`}
              data-ai-role="button"
              data-ai-label={`Reset ${feed.label} to defaults`}
            >
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed mt-2">{feed.explanation}</p>
      </div>
      <Separator soft />
      {(["alpha", "beta", "gamma"] as const)
        .filter((key) => !(feedType === "global" && key === "alpha"))
        .map((key) => (
          <WeightSlider
            key={key}
            id={`scoring-${feedType}-${key}`}
            config={WEIGHT_CONFIG[key]}
            value={weights[key]}
            onChange={(v) => onChange({ ...weights, [key]: v })}
          />
        ))}
    </div>
  );
};

const ScoringSection = ({ token }: { token: string }): React.ReactNode => {
  const [data, setData] = useState<ScoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [weights, setWeights] = useState<UserScoringWeights | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      const res = await fetch("/api/settings/scoring", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as ScoringResponse;
        setData(json);
        setWeights(json.weights);
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading || !data || !weights) {
    return <div className="text-sm text-ink-tertiary py-6 text-center">Loading...</div>;
  }

  const handleFeedChange = (feedType: FeedType, w: ScoringWeightSet): void => {
    const updated = { ...weights, [feedType]: w };
    setWeights(updated);
    setDirty(true);
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const res = await fetch("/api/settings/scoring", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(weights),
    });
    if (res.ok) {
      const json = (await res.json()) as ScoringResponse;
      setData(json);
      setWeights(json.weights);
      setDirty(false);
    }
    setSaving(false);
  };

  const handleResetAll = async (): Promise<void> => {
    setSaving(true);
    const res = await fetch("/api/settings/scoring", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = (await res.json()) as ScoringResponse;
      setData(json);
      setWeights(json.weights);
      setDirty(false);
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Algorithm overview */}
      <div className="flex flex-col gap-4">
        <div className="text-sm text-ink-secondary leading-relaxed flex flex-col gap-2">
          <p>
            Every article in your feeds is scored using three signals, combined into a single number that determines its position:
          </p>
          <div className="bg-surface-sunken rounded-md px-4 py-3 font-mono text-xs text-ink text-center">
            score = α &times; confidence + β &times; votes + γ &times; recency
          </div>
        </div>

        <div className="grid gap-3 text-xs text-ink-secondary leading-relaxed">
          <div className="flex gap-3">
            <span className="shrink-0 font-mono text-ink w-16 text-right">confidence</span>
            <span>How well the article matches a focus topic, determined by the on-device classifier (0.0 = unrelated, 1.0 = strong match). Only meaningful within focus feeds and editions.</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono text-ink w-16 text-right">votes</span>
            <span>A personalisation signal derived from your upvotes and downvotes. When you vote on an article, that signal propagates to semantically similar articles via embeddings — so a few votes shape the ranking of hundreds of articles. Only the 15 most similar voted articles contribute, weighted by how similar they are.</span>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 font-mono text-ink w-16 text-right">recency</span>
            <span>Freshness, as an exponential decay. An article published right now scores 1.0; after 3 days it scores 0.5; after a week, 0.125. Articles without a publish date get a neutral 0.5.</span>
          </div>
        </div>

        <p className="text-sm text-ink-secondary leading-relaxed">
          The Greek letters (α, β, γ) are the weights you control below. They determine how much each signal matters. Each feed type has its own set of weights because the context is different — for example, the global feed has no focus topic, so confidence is irrelevant there.
        </p>
        <p className="text-sm text-ink-secondary leading-relaxed">
          The weights don't need to sum to 1. Higher values amplify a signal relative to the others; setting a weight to 0 disables that signal entirely.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4">
        {(["global", "focus", "edition"] as const).map((feedType) => (
          <FeedWeightsCard
            key={feedType}
            feedType={feedType}
            weights={weights[feedType]}
            defaults={data.defaults[feedType]}
            onChange={(w) => handleFeedChange(feedType, w)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
          data-ai-id="settings-scoring-save"
          data-ai-role="button"
          data-ai-label="Save scoring weights"
          data-ai-state={saving ? "loading" : "idle"}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        {data.isCustom && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void handleResetAll()}
            data-ai-id="settings-scoring-reset"
            data-ai-role="button"
            data-ai-label="Reset all to defaults"
          >
            Reset all to defaults
          </Button>
        )}
      </div>
    </div>
  );
};

/* ── AI Assistant section ─────────────────────────────── */

const AiSection = (): React.ReactNode => {
  const { config, setConfig, removeConfig, isEnabled } = useAi();
  const [endpoint, setEndpoint] = useState(config?.endpoint ?? "");
  const [apiKey, setApiKey] = useState(config?.apiKey ?? "");
  const [model, setModel] = useState(config?.model ?? "");
  const [dirty, setDirty] = useState(false);

  const handleSave = (): void => {
    if (!endpoint.trim() || !apiKey.trim() || !model.trim()) return;
    const newConfig: AiConfig = {
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    };
    setConfig(newConfig);
    setDirty(false);
  };

  const handleRemove = (): void => {
    removeConfig();
    setEndpoint("");
    setApiKey("");
    setModel("");
    setDirty(false);
  };

  const handleChange = (field: "endpoint" | "apiKey" | "model", value: string): void => {
    if (field === "endpoint") setEndpoint(value);
    if (field === "apiKey") setApiKey(value);
    if (field === "model") setModel(value);
    setDirty(true);
  };

  return (
    <div className="flex flex-col gap-6" data-ai-id="settings-assistant" data-ai-role="section" data-ai-label="Assistant configuration">
      <div className="text-sm text-ink-secondary leading-relaxed flex flex-col gap-2">
        <p>
          Connect an OpenAI-compatible AI provider to enable the AI assistant. The assistant can help you set up sources, focuses, and editions through natural conversation.
        </p>
        <p className="text-xs text-ink-tertiary">
          Your API key is stored locally in your browser and only sent to your configured provider.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="API Endpoint"
          description="The base URL of your OpenAI-compatible API"
          placeholder="https://api.openai.com/v1"
          value={endpoint}
          onChange={(e) => handleChange("endpoint", e.target.value)}
          data-ai-id="settings-ai-endpoint"
          data-ai-role="input"
          data-ai-label="API Endpoint"
          data-ai-value={endpoint}
        />
        <Input
          label="API Key"
          type="password"
          description="Your API key for authentication"
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => handleChange("apiKey", e.target.value)}
          data-ai-id="settings-ai-key"
          data-ai-role="input"
          data-ai-label="API Key"
          data-ai-value={apiKey ? "••••••" : ""}
        />
        <Input
          label="Model"
          description="The model identifier to use"
          placeholder="gpt-4o"
          value={model}
          onChange={(e) => handleChange("model", e.target.value)}
          data-ai-id="settings-ai-model"
          data-ai-role="input"
          data-ai-label="Model"
          data-ai-value={model}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || !endpoint.trim() || !apiKey.trim() || !model.trim()}
          onClick={handleSave}
          data-ai-id="settings-ai-save"
          data-ai-role="button"
          data-ai-label={isEnabled ? "Update assistant" : "Enable assistant"}
        >
          {isEnabled ? "Update" : "Enable assistant"}
        </Button>
        {isEnabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            data-ai-id="settings-ai-disable"
            data-ai-role="button"
            data-ai-label="Disable assistant"
          >
            Disable assistant
          </Button>
        )}
      </div>

      {isEnabled && (
        <div className="rounded-md bg-positive-subtle px-3.5 py-2.5 text-xs text-positive" data-ai-id="settings-ai-status" data-ai-role="status" data-ai-label="Assistant is enabled">
          Assistant is enabled. Look for the sparkle icon in the sidebar.
        </div>
      )}
    </div>
  );
};

type SettingsTab = "jobs" | "votes" | "scoring" | "assistant";

const SettingsPage = (): React.ReactNode => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("jobs");
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

  const tabs: { key: SettingsTab; label: string; badge?: string }[] = [
    { key: "jobs", label: "Jobs" },
    { key: "votes", label: "Votes" },
    { key: "scoring", label: "Scoring" },
    { key: "assistant", label: "Assistant", badge: "alpha" },
  ];

  return (
    <>
      <PageHeader title="Settings" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6" data-ai-id="settings-tabs" data-ai-role="section" data-ai-label="Settings tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${activeTab === tab.key ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent" : "text-ink-tertiary hover:text-ink-secondary"}`}
            data-ai-id={`settings-tab-${tab.key}`}
            data-ai-role="button"
            data-ai-label={tab.label}
            data-ai-state={activeTab === tab.key ? "selected" : "idle"}
          >
            {tab.label}
            {tab.badge && <span className="ml-1.5 text-[10px] font-medium text-accent/60 uppercase tracking-wider">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Jobs tab */}
      {activeTab === "jobs" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Running and recent background jobs</p>
          <JobsSection token={auth.token} />
        </>
      )}

      {/* Votes tab */}
      {activeTab === "votes" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Your feedback shapes how articles are ranked</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
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

      {/* Scoring tab */}
      {activeTab === "scoring" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Customise how articles are ranked in each feed</p>
          <ScoringSection token={auth.token} />
        </>
      )}

      {/* Assistant tab */}
      {activeTab === "assistant" && (
        <>
          <p className="text-sm text-ink-secondary mb-6">Configure an AI assistant to help you set up Editions</p>
          <AiSection />
        </>
      )}
    </>
  );
};

const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

export { Route };
