import { useEffect, useState } from "react";
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

type FocusSource = {
  sourceId: string;
  mode: "always" | "match";
  weight: number;
};

type Focus = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  minReadingTimeSeconds: number | null;
  maxReadingTimeSeconds: number | null;
  sources: FocusSource[];
};

type Source = {
  id: string;
  name: string;
  url: string;
};

const EditFocusPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { focusId } = Route.useParams();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0);
  const [minReadingTime, setMinReadingTime] = useState("");
  const [maxReadingTime, setMaxReadingTime] = useState("");
  const [selectedSources, setSelectedSources] = useState<FocusSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formPopulated, setFormPopulated] = useState(false);

  const { data: focus, isLoading: loadingFocus, isError: focusError } = useQuery({
    queryKey: queryKeys.focuses.detail(focusId),
    queryFn: async (): Promise<Focus> => {
      const { data, error: err } = await client.GET("/api/focuses/{id}", {
        params: { path: { id: focusId } },
        headers,
      });
      if (err) throw new Error("Focus not found");
      return data as unknown as Focus;
    },
    enabled: !!headers,
  });

  const { data: allSources = [], isLoading: loadingSources } = useQuery({
    queryKey: queryKeys.sources.all,
    queryFn: async (): Promise<Source[]> => {
      const { data } = await client.GET("/api/sources", { headers });
      return (data as Source[]) ?? [];
    },
    enabled: !!headers,
  });

  // Populate form state from fetched focus data
  useEffect(() => {
    if (focus && !formPopulated) {
      setName(focus.name);
      setDescription(focus.description ?? "");
      setIcon(focus.icon);
      setMinConfidence(Math.round(focus.minConfidence * 100));
      setMinReadingTime(focus.minReadingTimeSeconds !== null ? String(focus.minReadingTimeSeconds / 60) : "");
      setMaxReadingTime(focus.maxReadingTimeSeconds !== null ? String(focus.maxReadingTimeSeconds / 60) : "");
      setSelectedSources(focus.sources);
      setFormPopulated(true);
    }
  }, [focus, formPopulated]);

  const updateFocus = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!focus) return;

      const patchBody: Record<string, string | number | null> = {};
      if (name !== focus.name) patchBody.name = name;
      const newDesc = description.trim() || null;
      if (newDesc !== focus.description) patchBody.description = newDesc;
      if (icon !== focus.icon) patchBody.icon = icon;
      const newMinConfidence = minConfidence / 100;
      if (newMinConfidence !== focus.minConfidence) patchBody.minConfidence = newMinConfidence;
      const newMinReading = minReadingTime ? Number(minReadingTime) * 60 : null;
      if (newMinReading !== focus.minReadingTimeSeconds) patchBody.minReadingTimeSeconds = newMinReading;
      const newMaxReading = maxReadingTime ? Number(maxReadingTime) * 60 : null;
      if (newMaxReading !== focus.maxReadingTimeSeconds) patchBody.maxReadingTimeSeconds = newMaxReading;

      const sourcesChanged =
        JSON.stringify(selectedSources.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId))) !==
        JSON.stringify(focus.sources.slice().sort((a, b) => a.sourceId.localeCompare(b.sourceId)));

      const hasFieldChanges = Object.keys(patchBody).length > 0;

      if (!hasFieldChanges && !sourcesChanged) return;

      if (hasFieldChanges) {
        const { error: err } = await client.PATCH("/api/focuses/{id}", {
          params: { path: { id: focusId } },
          body: patchBody,
          headers,
        });
        if (err) throw new Error("Failed to update focus");
      }

      if (sourcesChanged) {
        const { error: err } = await client.PUT("/api/focuses/{id}/sources", {
          params: { path: { id: focusId } },
          body: { sources: selectedSources },
          headers,
        });
        if (err) throw new Error("Failed to update sources");
      }
    },
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.focuses.detail(focusId) });
      await navigate({ to: "/focuses/$focusId", params: { focusId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) return null;

  const loading = loadingFocus || loadingSources;

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!focus || focusError) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? "Focus not found"}</div>
      </div>
    );
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
    updateFocus.mutate();
  };

  return (
    <>
      <PageHeader title="Edit focus" />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label="Description"
            description="Optional — helps guide the AI classifier"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <IconPicker value={icon} onChange={setIcon} />
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

        <div>
          <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">Sources</div>
          {allSources.length === 0 ? (
            <div className="text-sm text-ink-tertiary py-4">No sources available.</div>
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
          <Button variant="primary" type="submit" disabled={updateFocus.isPending}>
            {updateFocus.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/focuses/$focusId", params: { focusId } })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/focuses/$focusId/edit")({
  component: EditFocusPage,
});

export { Route };
