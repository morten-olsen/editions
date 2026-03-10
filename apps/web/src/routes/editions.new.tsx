import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";
import { Checkbox } from "../components/checkbox.tsx";
import { Separator } from "../components/separator.tsx";
import { IconPicker } from "../components/icon-picker.tsx";

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
  lookbackHours: number | null;
  weight: number;
};

const NewEditionConfigPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("0 7 * * *");
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const focusesQuery = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<Focus[]> => {
      const { data } = await client.GET("/api/focuses", { headers });
      return (data ?? []) as Focus[];
    },
    enabled: !!headers,
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.POST("/api/editions/configs", {
        body,
        headers,
      });
      if (err) {
        throw new Error("error" in err ? (err as { error: string }).error : "Failed to create edition");
      }
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: "/editions" });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) return null;

  const allFocuses = focusesQuery.data ?? [];

  if (focusesQuery.isLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  const selectedIds = new Set(selectedFocuses.map((f) => f.focusId));

  const toggleFocus = (focusId: string): void => {
    setSelectedFocuses((prev) => {
      const existing = prev.find((f) => f.focusId === focusId);
      if (existing) return prev.filter((f) => f.focusId !== focusId);
      return [
        ...prev,
        { focusId, position: prev.length, budgetType: "count" as const, budgetValue: 5, lookbackHours: null, weight: 1 },
      ];
    });
  };

  const updateFocusField = (
    focusId: string,
    field: "budgetType" | "budgetValue" | "lookbackHours" | "weight",
    value: string | number | null,
  ): void => {
    setSelectedFocuses((prev) =>
      prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)),
    );
  };

  const moveFocus = (focusId: string, direction: -1 | 1): void => {
    setSelectedFocuses((prev) => {
      const idx = prev.findIndex((f) => f.focusId === focusId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      const a = arr[idx]!;
      const b = arr[newIdx]!;
      arr[idx] = b;
      arr[newIdx] = a;
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);

    createMutation.mutate({
      name,
      icon,
      schedule,
      lookbackHours,
      excludePriorEditions,
      focuses: selectedFocuses.map((f, i) => ({
        focusId: f.focusId,
        position: i,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        weight: f.weight,
      })),
    });
  };

  return (
    <>
      <PageHeader title="New edition" subtitle="Configure a curated digest from your focuses" />

      {error && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            placeholder="Morning Briefing"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <IconPicker value={icon} onChange={setIcon} />
          <Input
            label="Schedule"
            description="Cron expression"
            placeholder="0 7 * * *"
            required
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="font-mono"
          />
          <div>
            <label htmlFor="lookback" className="block text-sm font-medium text-ink mb-1.5">
              Lookback window
            </label>
            <select
              id="lookback"
              value={lookbackHours}
              onChange={(e) => setLookbackHours(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value={1}>1 hour</option>
              <option value={24}>24 hours</option>
              <option value={168}>1 week</option>
              <option value={730}>1 month</option>
              <option value={8760}>1 year</option>
            </select>
          </div>
          <Checkbox
            label="Exclude articles from prior editions"
            checked={excludePriorEditions}
            onCheckedChange={(checked) => setExcludePriorEditions(checked === true)}
          />
        </div>

        <Separator soft />

        {/* Selected focuses — ordered list */}
        <div>
          <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">
            Sections {selectedFocuses.length > 0 && `(${selectedFocuses.length})`}
          </div>
          {selectedFocuses.length === 0 ? (
            <div className="text-sm text-ink-tertiary py-4">
              No sections added yet. Add focuses below.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedFocuses.map((config, idx) => {
                const focus = allFocuses.find((f) => f.id === config.focusId);
                if (!focus) return null;

                return (
                  <div key={config.focusId} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono text-accent w-5 text-center">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 text-sm font-medium text-ink">{focus.name}</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveFocus(config.focusId, -1)}
                          disabled={idx === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFocus(config.focusId, 1)}
                          disabled={idx === selectedFocuses.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFocus(config.focusId)}
                          className="ml-1 rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:text-critical cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 pl-8">
                      {/* Budget */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-tertiary w-16 shrink-0">Budget</span>
                        <input
                          type="number"
                          min={1}
                          value={config.budgetValue}
                          onChange={(e) =>
                            updateFocusField(config.focusId, "budgetValue", Number(e.target.value))
                          }
                          className="w-16 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                        <select
                          value={config.budgetType}
                          onChange={(e) =>
                            updateFocusField(config.focusId, "budgetType", e.target.value)
                          }
                          className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        >
                          <option value="count">articles</option>
                          <option value="time">minutes</option>
                        </select>
                      </div>
                      {/* Lookback override */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-tertiary w-16 shrink-0">Lookback</span>
                        <select
                          value={config.lookbackHours === null ? "" : String(config.lookbackHours)}
                          onChange={(e) =>
                            updateFocusField(
                              config.focusId,
                              "lookbackHours",
                              e.target.value === "" ? null : Number(e.target.value),
                            )
                          }
                          className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        >
                          <option value="">Use default</option>
                          <option value="1">1 hour</option>
                          <option value="24">24 hours</option>
                          <option value="168">1 week</option>
                          <option value="730">1 month</option>
                          <option value="8760">1 year</option>
                        </select>
                      </div>
                      {/* Priority */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-tertiary w-16 shrink-0">Priority</span>
                        <input
                          type="range"
                          min={0}
                          max={3}
                          step={0.1}
                          value={config.weight}
                          onChange={(e) =>
                            updateFocusField(config.focusId, "weight", Number(e.target.value))
                          }
                          className="flex-1 accent-accent"
                        />
                        <span className="text-xs text-ink-secondary tabular-nums w-6 text-right">
                          {config.weight.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available focuses to add */}
        {allFocuses.filter((f) => !selectedIds.has(f.id)).length > 0 && (
          <div>
            <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">Add focuses</div>
            <div className="flex flex-col gap-2">
              {allFocuses
                .filter((f) => !selectedIds.has(f.id))
                .map((focus) => (
                  <div
                    key={focus.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{focus.name}</div>
                      {focus.description && (
                        <div className="text-xs text-ink-tertiary truncate">{focus.description}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => toggleFocus(focus.id)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="primary" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create edition"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/editions" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/editions/new")({
  component: NewEditionConfigPage,
});

export { Route };
