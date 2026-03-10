import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Textarea } from "../components/textarea.tsx";
import { Button } from "../components/button.tsx";
import { Checkbox } from "../components/checkbox.tsx";
import { Separator } from "../components/separator.tsx";

type Source = {
  id: string;
  name: string;
  url: string;
};

type SourceSelection = {
  sourceId: string;
  mode: "always" | "match";
  weight: number;
};

const NewFocusPage = (): React.ReactNode => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState("");
  const [maxReadingTime, setMaxReadingTime] = useState("");
  const [allSources, setAllSources] = useState<Source[]>([]);
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSources = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const { data } = await client.GET("/api/sources", {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (data) {
      setAllSources(data as Source[]);
    }
    setLoadingSources(false);
  }, [auth]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  if (auth.status !== "authenticated") return null;

  if (loadingSources) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  const toggleSource = (sourceId: string): void => {
    setSelectedSources((prev) => {
      const existing = prev.find((s) => s.sourceId === sourceId);
      if (existing) return prev.filter((s) => s.sourceId !== sourceId);
      return [...prev, { sourceId, mode: "always", weight: 1 }];
    });
  };

  const changeMode = (sourceId: string, mode: "always" | "match"): void => {
    setSelectedSources((prev) =>
      prev.map((s) => (s.sourceId === sourceId ? { ...s, mode } : s)),
    );
  };

  const changeWeight = (sourceId: string, weight: number): void => {
    setSelectedSources((prev) =>
      prev.map((s) => (s.sourceId === sourceId ? { ...s, weight } : s)),
    );
  };

  const selectedIds = new Set(selectedSources.map((s) => s.sourceId));

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const body: {
      name: string;
      description?: string;
      minConfidence?: number;
      minReadingTimeSeconds?: number | null;
      maxReadingTimeSeconds?: number | null;
      sources?: SourceSelection[];
    } = { name };
    if (description.trim()) body.description = description.trim();
    if (minConfidence > 0) body.minConfidence = minConfidence / 100;
    const parsedMin = minReadingTime ? Number(minReadingTime) : null;
    const parsedMax = maxReadingTime ? Number(maxReadingTime) : null;
    if (parsedMin !== null) body.minReadingTimeSeconds = parsedMin * 60;
    if (parsedMax !== null) body.maxReadingTimeSeconds = parsedMax * 60;
    if (selectedSources.length > 0) body.sources = selectedSources;

    const { error: err } = await client.POST("/api/focuses", {
      body,
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (err) {
      setError("error" in err ? (err as { error: string }).error : "Failed to create focus");
      setSubmitting(false);
      return;
    }

    await navigate({ to: "/focuses" });
  };

  return (
    <>
      <PageHeader title="New focus" subtitle="Define a topic area for classifying articles" />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            placeholder="Technology"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label="Description"
            description="Optional — helps guide the AI classifier"
            placeholder="News about software, startups, and tech industry"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Minimum confidence
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">
              Only show articles that match with at least this confidence. 0% includes everything.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className="text-sm text-ink-secondary tabular-nums w-10 text-right">
                {minConfidence}%
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Reading time
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">
              Optional — only include articles within this reading time range.
            </p>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Min"
                type="number"
                min={0}
                value={minReadingTime}
                onChange={(e) => setMinReadingTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-ink-tertiary">to</span>
              <Input
                placeholder="Max"
                type="number"
                min={0}
                value={maxReadingTime}
                onChange={(e) => setMaxReadingTime(e.target.value)}
                className="flex-1"
              />
              <span className="text-xs text-ink-tertiary whitespace-nowrap">minutes</span>
            </div>
          </div>
        </div>

        <Separator soft />

        {/* Source selection */}
        <div>
          <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">Sources</div>
          {allSources.length === 0 ? (
            <div className="text-sm text-ink-tertiary py-4">
              No sources yet. You can add sources later.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {allSources.map((source) => {
                const isSelected = selectedIds.has(source.id);
                const selection = selectedSources.find((s) => s.sourceId === source.id);

                return (
                  <div
                    key={source.id}
                    className={`rounded-md transition-colors duration-fast ${isSelected ? "bg-surface-sunken/50 p-3" : "px-3 py-2"}`}
                  >
                    <div className="flex items-center justify-between">
                      <Checkbox
                        label={source.name}
                        checked={isSelected}
                        onCheckedChange={() => toggleSource(source.id)}
                      />
                      {isSelected && selection && (
                        <select
                          value={selection.mode}
                          onChange={(e) => changeMode(source.id, e.target.value as "always" | "match")}
                          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                          <option value="always">Always include</option>
                          <option value="match">If match</option>
                        </select>
                      )}
                    </div>
                    {isSelected && selection && (
                      <div className="mt-2 pl-7 flex items-center gap-3">
                        <span className="text-xs text-ink-tertiary shrink-0">Priority</span>
                        <input
                          type="range"
                          min={0}
                          max={3}
                          step={0.1}
                          value={selection.weight}
                          onChange={(e) => changeWeight(source.id, Number(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <span className="text-xs text-ink-secondary tabular-nums w-6 text-right">
                          {selection.weight.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create focus"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/focuses" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/focuses/new")({
  component: NewFocusPage,
});

export { Route };
