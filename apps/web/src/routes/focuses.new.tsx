import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Textarea } from "../components/textarea.tsx";
import { Button } from "../components/button.tsx";
import { Checkbox } from "../components/checkbox.tsx";
import { Separator } from "../components/separator.tsx";
import { IconPicker } from "../components/icon-picker.tsx";

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

const selectClasses =
  "rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent";

const priorityLabel = (w: number): string => {
  if (w <= 0.1) return "Off";
  if (w < 0.75) return "Low";
  if (w <= 1.25) return "Normal";
  if (w <= 2.1) return "High";
  return "Top";
};

const confidenceHint = (v: number): string => {
  if (v === 0) return "All articles";
  if (v <= 30) return "Loose match";
  if (v <= 60) return "Moderate";
  if (v <= 80) return "Strong match";
  return "Exact match";
};

const NewFocusPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState("");
  const [maxReadingTime, setMaxReadingTime] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceSelection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: allSources = [], isLoading: loadingSources } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET("/api/sources", { headers });
      return (data as Source[]) ?? [];
    },
    enabled: !!headers,
  });

  const createFocus = useMutation({
    mutationFn: async (): Promise<void> => {
      const body: {
        name: string;
        description?: string;
        icon?: string | null;
        minConfidence?: number;
        minConsumptionTimeSeconds?: number | null;
        maxConsumptionTimeSeconds?: number | null;
        sources?: SourceSelection[];
      } = { name };
      if (description.trim()) body.description = description.trim();
      if (icon) body.icon = icon;
      if (minConfidence > 0) body.minConfidence = minConfidence / 100;
      const parsedMin = minReadingTime ? Number(minReadingTime) : null;
      const parsedMax = maxReadingTime ? Number(maxReadingTime) : null;
      if (parsedMin !== null) body.minConsumptionTimeSeconds = parsedMin * 60;
      if (parsedMax !== null) body.maxConsumptionTimeSeconds = parsedMax * 60;
      if (selectedSources.length > 0) body.sources = selectedSources;

      const { error: err } = await client.POST("/api/focuses", {
        body,
        headers,
      });

      if (err) {
        throw new Error("error" in err ? (err as { error: string }).error : "Failed to create focus");
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await navigate({ to: "/focuses" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) return null;

  if (loadingSources) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
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
    createFocus.mutate();
  };

  return (
    <>
      <PageHeader title="New topic" subtitle="A topic that shapes what appears in your editions" />

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
            description="Helps the app recognise which articles belong here — the more specific, the better."
            placeholder="News about software, startups, and the tech industry"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <IconPicker value={icon} onChange={setIcon} />

          {/* Match strength */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              How closely articles must match
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">
              Raise this to only include articles that are clearly a strong match. At 0%, anything potentially relevant is included.
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
              <span className="text-sm text-ink-secondary tabular-nums w-24 text-right">
                {minConfidence === 0 ? "All articles" : `${minConfidence}% — ${confidenceHint(minConfidence)}`}
              </span>
            </div>
          </div>

          {/* Reading time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Reading time
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">
              Only include articles within this length. Leave blank for any length.
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

        {/* Sources */}
        <div>
          <div className="text-sm font-medium text-ink mb-0.5">Sources</div>
          <p className="text-xs text-ink-tertiary mb-4">
            Choose which sources feed this topic and how articles from each are selected.
          </p>
          {allSources.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center">
              <p className="text-sm text-ink-tertiary">No sources yet.</p>
              <p className="text-xs text-ink-faint mt-1">You can add sources later.</p>
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
                          className={selectClasses}
                        >
                          <option value="always">All articles</option>
                          <option value="match">Matching only</option>
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
                        <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
                          {priorityLabel(selection.weight)}
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
          <Button variant="primary" type="submit" disabled={createFocus.isPending}>
            {createFocus.isPending ? "Creating…" : "Create topic"}
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
