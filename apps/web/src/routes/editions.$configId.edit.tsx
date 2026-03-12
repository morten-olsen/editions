import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../api/api.ts';
import { useAuthHeaders, queryKeys } from '../api/api.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Checkbox } from '../components/checkbox.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

const SCHEDULE_PRESETS = [
  { label: 'Daily at 7am', value: '0 7 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekdays at 7am', value: '0 7 * * 1-5' },
  { label: 'Weekdays at 8am', value: '0 8 * * 1-5' },
  { label: 'Every Monday at 8am', value: '0 8 * * 1' },
  { label: 'Every Friday at 5pm', value: '0 17 * * 5' },
  { label: 'Custom…', value: '__custom__' },
] as const;

const selectClasses =
  'rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

const priorityLabel = (w: number): string => {
  if (w <= 0.1) {
    return 'Off';
  }
  if (w < 0.75) {
    return 'Low';
  }
  if (w <= 1.25) {
    return 'Normal';
  }
  if (w <= 2.1) {
    return 'High';
  }
  return 'Top';
};

const EditEditionConfigPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { configId } = Route.useParams();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [schedule, setSchedule] = useState('');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: queryKeys.editions.config(configId),
    queryFn: async (): Promise<EditionConfig> => {
      const { data, error: err } = await client.GET('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        headers,
      });
      if (err) {
        throw new Error('Edition config not found');
      }
      return data as unknown as EditionConfig;
    },
    enabled: !!headers,
  });

  const focusesQuery = useQuery({
    queryKey: queryKeys.focuses.all,
    queryFn: async (): Promise<Focus[]> => {
      const { data } = await client.GET('/api/focuses', { headers });
      return (data ?? []) as Focus[];
    },
    enabled: !!headers,
  });

  // Populate form state when config data loads
  useEffect(() => {
    if (!configQuery.data) {
      return;
    }
    const c = configQuery.data;
    setName(c.name);
    setIcon(c.icon);
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
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      })),
    );
  }, [configQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<void> => {
      const { error: err } = await client.PATCH('/api/editions/configs/{configId}', {
        params: { path: { configId } },
        body,
        headers,
      });
      if (err) {
        throw new Error('Failed to update edition config');
      }
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.configs });
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.config(configId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
      void navigate({ to: '/editions/$configId', params: { configId } });
    },
    onError: (err: Error): void => {
      setError(err.message);
    },
  });

  if (!headers) {
    return null;
  }

  const loading = configQuery.isLoading || focusesQuery.isLoading;
  const config = configQuery.data ?? null;
  const allFocuses = focusesQuery.data ?? [];

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  if (!config) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{error ?? configQuery.error?.message ?? 'Edition config not found'}</div>
      </div>
    );
  }

  const selectedIds = new Set(selectedFocuses.map((f) => f.focusId));
  const isPresetSchedule = SCHEDULE_PRESETS.some((p) => p.value !== '__custom__' && p.value === schedule);
  const scheduleSelectValue = isPresetSchedule ? schedule : '__custom__';

  const toggleFocus = (focusId: string): void => {
    setSelectedFocuses((prev) => {
      const existing = prev.find((f) => f.focusId === focusId);
      if (existing) {
        return prev.filter((f) => f.focusId !== focusId);
      }
      return [
        ...prev,
        {
          focusId,
          position: prev.length,
          budgetType: 'count' as const,
          budgetValue: 5,
          lookbackHours: null,
          excludePriorEditions: null,
          weight: 1,
        },
      ];
    });
  };

  const updateFocusField = (
    focusId: string,
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ): void => {
    setSelectedFocuses((prev) => prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)));
  };

  const moveFocus = (focusId: string, direction: -1 | 1): void => {
    setSelectedFocuses((prev) => {
      const idx = prev.findIndex((f) => f.focusId === focusId);
      if (idx < 0) {
        return prev;
      }
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) {
        return prev;
      }
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

    const body: Record<string, unknown> = {};

    if (name !== config.name) {
      body.name = name;
    }
    if (icon !== config.icon) {
      body.icon = icon;
    }
    if (schedule !== config.schedule) {
      body.schedule = schedule;
    }
    if (lookbackHours !== config.lookbackHours) {
      body.lookbackHours = lookbackHours;
    }
    if (excludePriorEditions !== config.excludePriorEditions) {
      body.excludePriorEditions = excludePriorEditions;
    }
    if (enabled !== config.enabled) {
      body.enabled = enabled;
    }

    const focusesChanged =
      JSON.stringify(selectedFocuses) !==
      JSON.stringify(
        config.focuses.map((f) => ({
          focusId: f.focusId,
          position: f.position,
          budgetType: f.budgetType,
          budgetValue: f.budgetValue,
          lookbackHours: f.lookbackHours,
          excludePriorEditions: f.excludePriorEditions,
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
        excludePriorEditions: f.excludePriorEditions,
        weight: f.weight,
      }));
    }

    if (Object.keys(body).length === 0) {
      void navigate({ to: '/editions/$configId', params: { configId } });
      return;
    }

    updateMutation.mutate(body);
  };

  return (
    <>
      <PageHeader title="Edit edition" />

      {error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edit-edition-error"
          data-ai-role="error"
          data-ai-error={error}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edit-edition-form"
        data-ai-role="form"
        data-ai-label="Edit edition form"
      >
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ai-id="edit-edition-name"
            data-ai-role="input"
            data-ai-label="Edition name"
            data-ai-value={name}
          />
          <IconPicker value={icon} onChange={setIcon} />

          {/* Schedule */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-preset" className="text-sm font-medium text-ink">
              Delivery schedule
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">When this edition is automatically generated</p>
            <select
              id="schedule-preset"
              value={scheduleSelectValue}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setSchedule(e.target.value);
                }
              }}
              className={`w-full ${selectClasses}`}
              data-ai-id="edit-edition-schedule"
              data-ai-role="select"
              data-ai-label="Delivery schedule"
              data-ai-value={schedule}
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {!isPresetSchedule && (
              <div className="flex flex-col gap-1.5 mt-1">
                <Input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="font-mono"
                  placeholder="0 7 * * *"
                  required
                  data-ai-id="edit-edition-schedule-custom"
                  data-ai-role="input"
                  data-ai-label="Custom cron expression"
                  data-ai-value={schedule}
                />
                <p className="text-xs text-ink-tertiary">
                  Cron expression — e.g. <code className="font-mono bg-surface-sunken px-1 rounded">0 7 * * *</code>{' '}
                  means daily at 7am
                </p>
              </div>
            )}
          </div>

          {/* Lookback */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lookback" className="text-sm font-medium text-ink">
              How far back to look
            </label>
            <p className="text-xs text-ink-tertiary -mt-0.5">How old an article can be to appear in this edition</p>
            <select
              id="lookback"
              value={lookbackHours}
              onChange={(e) => setLookbackHours(Number(e.target.value))}
              className={`w-full ${selectClasses}`}
              data-ai-id="edit-edition-lookback"
              data-ai-role="select"
              data-ai-label="How far back to look"
              data-ai-value={String(lookbackHours)}
            >
              <option value={1}>Last hour</option>
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last week</option>
              <option value={730}>Last month</option>
              <option value={8760}>Last year</option>
            </select>
          </div>

          <Checkbox
            label="Don't repeat articles across editions"
            description="Articles that appeared in a previous issue of this digest won't be included again"
            checked={excludePriorEditions}
            onCheckedChange={(checked) => setExcludePriorEditions(checked === true)}
            data-ai-id="edit-edition-exclude-prior"
            data-ai-role="checkbox"
            data-ai-label="Don't repeat articles across editions"
            data-ai-state={excludePriorEditions ? 'checked' : 'unchecked'}
          />
          <Checkbox
            label="Active"
            description="When off, this edition won't be generated automatically"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
            data-ai-id="edit-edition-enabled"
            data-ai-role="checkbox"
            data-ai-label="Active"
            data-ai-state={enabled ? 'checked' : 'unchecked'}
          />
        </div>

        <Separator soft />

        {/* Selected focuses */}
        <div>
          <div className="text-sm font-medium text-ink mb-0.5">
            Topics{' '}
            {selectedFocuses.length > 0 && (
              <span className="text-ink-tertiary font-normal">({selectedFocuses.length})</span>
            )}
          </div>
          <p className="text-xs text-ink-tertiary mb-4">
            Each topic becomes a section in your edition. Use the arrows ↑↓ to reorder.
          </p>
          {selectedFocuses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-6 text-center">
              <p className="text-sm text-ink-tertiary">No topics added yet.</p>
              <p className="text-xs text-ink-faint mt-1">Choose from the list below to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedFocuses.map((focusConfig, idx) => {
                const focus = allFocuses.find((f) => f.id === focusConfig.focusId);
                if (!focus) {
                  return null;
                }

                return (
                  <div key={focusConfig.focusId} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono text-accent w-5 text-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 text-sm font-medium text-ink">{focus.name}</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveFocus(focusConfig.focusId, -1)}
                          disabled={idx === 0}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                          aria-label="Move up"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFocus(focusConfig.focusId, 1)}
                          disabled={idx === selectedFocuses.length - 1}
                          className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                          aria-label="Move down"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFocus(focusConfig.focusId)}
                          className="ml-1 rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:text-critical cursor-pointer"
                          aria-label="Remove"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 pl-8">
                      {/* Budget */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-ink-tertiary">Include up to</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={focusConfig.budgetValue}
                            onChange={(e) =>
                              updateFocusField(focusConfig.focusId, 'budgetValue', Number(e.target.value))
                            }
                            className="w-16 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                          />
                          <select
                            value={focusConfig.budgetType}
                            onChange={(e) => updateFocusField(focusConfig.focusId, 'budgetType', e.target.value)}
                            className={selectClasses}
                          >
                            <option value="count">articles</option>
                            <option value="time">minutes of reading</option>
                          </select>
                        </div>
                      </div>

                      {/* Lookback override */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-ink-tertiary">Age limit</span>
                        <select
                          value={focusConfig.lookbackHours === null ? '' : String(focusConfig.lookbackHours)}
                          onChange={(e) =>
                            updateFocusField(
                              focusConfig.focusId,
                              'lookbackHours',
                              e.target.value === '' ? null : Number(e.target.value),
                            )
                          }
                          className={selectClasses}
                        >
                          <option value="">Same as edition default</option>
                          <option value="1">Last hour only</option>
                          <option value="24">Last 24 hours</option>
                          <option value="168">Last week</option>
                          <option value="730">Last month</option>
                          <option value="8760">Last year</option>
                        </select>
                      </div>

                      {/* Past edition articles */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-ink-tertiary">Past issue articles</span>
                        <select
                          value={
                            focusConfig.excludePriorEditions === null
                              ? ''
                              : focusConfig.excludePriorEditions
                                ? 'true'
                                : 'false'
                          }
                          onChange={(e) =>
                            updateFocusField(
                              focusConfig.focusId,
                              'excludePriorEditions',
                              e.target.value === '' ? null : e.target.value === 'true',
                            )
                          }
                          className={selectClasses}
                        >
                          <option value="">Use edition setting</option>
                          <option value="true">Skip — don&apos;t repeat past articles</option>
                          <option value="false">Allow — past articles can reappear</option>
                        </select>
                      </div>

                      {/* Priority */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-ink-tertiary">Priority</span>
                        <p className="text-xs text-ink-faint -mt-1">
                          How much to favour this topic when selecting articles
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={0.1}
                            value={focusConfig.weight}
                            onChange={(e) => updateFocusField(focusConfig.focusId, 'weight', Number(e.target.value))}
                            className="flex-1 accent-accent"
                          />
                          <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
                            {priorityLabel(focusConfig.weight)}
                          </span>
                        </div>
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
          <div data-ai-id="edit-edition-available-topics" data-ai-role="list" data-ai-label="Available topics">
            <div className="text-sm font-medium text-ink mb-0.5">Available topics</div>
            <p className="text-xs text-ink-tertiary mb-3">Add topics to include them as sections in your edition</p>
            <div className="flex flex-col gap-2">
              {allFocuses
                .filter((f) => !selectedIds.has(f.id))
                .map((focus) => (
                  <div
                    key={focus.id}
                    className="flex items-center justify-between py-2"
                    data-ai-id={`edit-edition-topic-${focus.id}`}
                    data-ai-role="section"
                    data-ai-label={focus.name}
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
                      data-ai-id={`edit-edition-add-topic-${focus.id}`}
                      data-ai-role="button"
                      data-ai-label={`Add ${focus.name}`}
                    >
                      Add
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            type="submit"
            disabled={updateMutation.isPending}
            data-ai-id="edit-edition-submit"
            data-ai-role="button"
            data-ai-label="Save changes"
            data-ai-state={updateMutation.isPending ? 'loading' : 'idle'}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => void navigate({ to: '/editions/$configId', params: { configId } })}
            data-ai-id="edit-edition-cancel"
            data-ai-role="button"
            data-ai-label="Cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
};

const Route = createFileRoute('/editions/$configId/edit')({
  component: EditEditionConfigPage,
});

export { Route };
