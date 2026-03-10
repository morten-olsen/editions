import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { Input } from "../components/input.tsx";
import { Button } from "../components/button.tsx";
import { Checkbox } from "../components/checkbox.tsx";
import { Separator } from "../components/separator.tsx";

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
  lookbackHours: number | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  name: string;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: "time" | "count";
  budgetValue: number;
  lookbackHours: number | null;
  weight: number;
};

const EditEditionConfigPage = (): React.ReactNode => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { configId } = Route.useParams();
  const [config, setConfig] = useState<EditionConfig | null>(null);
  const [allFocuses, setAllFocuses] = useState<Focus[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;

    const hdrs = { Authorization: `Bearer ${auth.token}` };
    const [configRes, focusesRes] = await Promise.all([
      client.GET("/api/editions/configs/{configId}", {
        params: { path: { configId } },
        headers: hdrs,
      }),
      client.GET("/api/focuses", { headers: hdrs }),
    ]);

    if (configRes.error) {
      setError("Edition config not found");
    } else {
      const c = configRes.data as EditionConfig;
      setConfig(c);
      setName(c.name);
      setSchedule(c.schedule);
      setLookbackHours(c.lookbackHours);
      setExcludePriorEditions(c.excludePriorEditions);
      setEnabled(c.enabled);
      setSelectedFocuses(
        c.focuses.map((f) => ({
          focusId: f.focusId,
          position: f.position,
          budgetType: f.budgetType,
          budgetValue: f.budgetValue,
          lookbackHours: f.lookbackHours,
          weight: f.weight,
        })),
      );
    }

    if (focusesRes.data) {
      setAllFocuses(focusesRes.data as Focus[]);
    }

    setLoading(false);
  }, [auth, configId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!config) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? "Edition config not found"}</div>
      </div>
    );
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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const body: Record<string, unknown> = {};

    if (name !== config.name) body.name = name;
    if (schedule !== config.schedule) body.schedule = schedule;
    if (lookbackHours !== config.lookbackHours) body.lookbackHours = lookbackHours;
    if (excludePriorEditions !== config.excludePriorEditions)
      body.excludePriorEditions = excludePriorEditions;
    if (enabled !== config.enabled) body.enabled = enabled;

    const focusesChanged =
      JSON.stringify(selectedFocuses) !==
      JSON.stringify(
        config.focuses.map((f) => ({
          focusId: f.focusId,
          position: f.position,
          budgetType: f.budgetType,
          budgetValue: f.budgetValue,
          lookbackHours: f.lookbackHours,
          weight: f.weight,
        })),
      );

    if (focusesChanged) {
      body.focuses = selectedFocuses.map((f, i) => ({
        focusId: f.focusId,
        position: i,
        budgetType: f.budgetType,
        budgetValue: f.budgetValue,
        lookbackHours: f.lookbackHours,
        weight: f.weight,
      }));
    }

    if (Object.keys(body).length === 0) {
      await navigate({ to: "/editions/$configId", params: { configId } });
      return;
    }

    const { error: err } = await client.PATCH("/api/editions/configs/{configId}", {
      params: { path: { configId } },
      body,
      headers,
    });

    if (err) {
      setError("Failed to update edition config");
      setSubmitting(false);
      return;
    }

    await navigate({ to: "/editions/$configId", params: { configId } });
  };

  return (
    <>
      <PageHeader title="Edit edition" />

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
          <Input
            label="Schedule"
            description="Cron expression"
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
          <Checkbox
            label="Enabled"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
        </div>

        <Separator soft />

        {/* Selected focuses */}
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
              {selectedFocuses.map((focusConfig, idx) => {
                const focus = allFocuses.find((f) => f.id === focusConfig.focusId);
                if (!focus) return null;

                return (
                  <div key={focusConfig.focusId} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono text-accent w-5 text-center">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 text-sm font-medium text-ink">{focus.name}</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveFocus(focusConfig.focusId, -1)}
                          disabled={idx === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFocus(focusConfig.focusId, 1)}
                          disabled={idx === selectedFocuses.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFocus(focusConfig.focusId)}
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
                          value={focusConfig.budgetValue}
                          onChange={(e) =>
                            updateFocusField(focusConfig.focusId, "budgetValue", Number(e.target.value))
                          }
                          className="w-16 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                        <select
                          value={focusConfig.budgetType}
                          onChange={(e) =>
                            updateFocusField(focusConfig.focusId, "budgetType", e.target.value)
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
                          value={focusConfig.lookbackHours === null ? "" : String(focusConfig.lookbackHours)}
                          onChange={(e) =>
                            updateFocusField(
                              focusConfig.focusId,
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
                          value={focusConfig.weight}
                          onChange={(e) =>
                            updateFocusField(focusConfig.focusId, "weight", Number(e.target.value))
                          }
                          className="flex-1 accent-accent"
                        />
                        <span className="text-xs text-ink-secondary tabular-nums w-6 text-right">
                          {focusConfig.weight.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available focuses */}
        {allFocuses.filter((f) => !selectedIds.has(f.id)).length > 0 && (
          <div>
            <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">Add focuses</div>
            <div className="flex flex-col gap-2">
              {allFocuses
                .filter((f) => !selectedIds.has(f.id))
                .map((focus) => (
                  <div key={focus.id} className="flex items-center justify-between py-2">
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
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: "/editions/$configId", params: { configId } })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute("/editions/$configId/edit")({
  component: EditEditionConfigPage,
});

export { Route };
