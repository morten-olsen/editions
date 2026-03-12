import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '../../components/input.tsx';
import { Button } from '../../components/button.tsx';
import { Checkbox } from '../../components/checkbox.tsx';
import { Separator } from '../../components/separator.tsx';
import { IconPicker } from '../../components/icon-picker.tsx';

// ─── Shared form helpers ────────────────────────────────────────────────────

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

// ─── Sample data ─────────────────────────────────────────────────────────────

type FocusConfig = {
  focusId: string;
  focusName: string;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

const SAMPLE_FOCUSES: FocusConfig[] = [
  {
    focusId: '1',
    focusName: 'Technology',
    budgetType: 'count',
    budgetValue: 5,
    lookbackHours: null,
    excludePriorEditions: null,
    weight: 1,
  },
  {
    focusId: '2',
    focusName: 'Science',
    budgetType: 'count',
    budgetValue: 3,
    lookbackHours: null,
    excludePriorEditions: true,
    weight: 2,
  },
  {
    focusId: '3',
    focusName: 'Global News',
    budgetType: 'time',
    budgetValue: 15,
    lookbackHours: 168,
    excludePriorEditions: false,
    weight: 1,
  },
];

const AVAILABLE_FOCUSES: { id: string; name: string; description: string | null }[] = [
  { id: '4', name: 'Design', description: 'Product design, UI, and creative work' },
  { id: '5', name: 'Business', description: 'Markets, startups, and economics' },
  { id: '6', name: 'Climate', description: 'Climate science, policy, and sustainability' },
];

// ─── Form component ───────────────────────────────────────────────────────────

const EditionEditForm = ({ mode }: { mode: 'create' | 'edit' }): React.ReactElement => {
  const [name, setName] = useState(mode === 'edit' ? 'Morning Briefing' : '');
  const [icon, setIcon] = useState<string | null>(mode === 'edit' ? 'newspaper' : null);
  const [schedule, setSchedule] = useState('0 7 * * *');
  const [lookbackHours, setLookbackHours] = useState(24);
  const [excludePriorEditions, setExcludePriorEditions] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [selectedFocuses, setSelectedFocuses] = useState<FocusConfig[]>(mode === 'edit' ? SAMPLE_FOCUSES : []);
  const [availableFocuses, setAvailableFocuses] =
    useState<{ id: string; name: string; description: string | null }[]>(AVAILABLE_FOCUSES);

  const selectedIds = new Set(selectedFocuses.map((f) => f.focusId));
  const isPresetSchedule = SCHEDULE_PRESETS.some((p) => p.value !== '__custom__' && p.value === schedule);
  const scheduleSelectValue = isPresetSchedule ? schedule : '__custom__';

  const addFocus = (focusId: string): void => {
    const focus = availableFocuses.find((f) => f.id === focusId);
    if (!focus) {
      return;
    }
    setSelectedFocuses((prev) => [
      ...prev,
      {
        focusId,
        focusName: focus.name,
        budgetType: 'count',
        budgetValue: 5,
        lookbackHours: null,
        excludePriorEditions: null,
        weight: 1,
      },
    ]);
    setAvailableFocuses((prev) => prev.filter((f) => f.id !== focusId));
  };

  const removeFocus = (focusId: string): void => {
    const focus = selectedFocuses.find((f) => f.focusId === focusId);
    if (!focus) {
      return;
    }
    setSelectedFocuses((prev) => prev.filter((f) => f.focusId !== focusId));
    setAvailableFocuses((prev) => [...prev, { id: focusId, name: focus.focusName, description: null }]);
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
      [arr[idx], arr[newIdx]] = [arr[newIdx]!, arr[idx]!];
      return arr;
    });
  };

  const updateFocusField = (
    focusId: string,
    field: keyof Pick<FocusConfig, 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight'>,
    value: string | number | boolean | null,
  ): void => {
    setSelectedFocuses((prev) => prev.map((f) => (f.focusId === focusId ? { ...f, [field]: value } : f)));
  };

  return (
    <form className="max-w-lg flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-5">
        <Input
          label="Name"
          placeholder="Morning Briefing"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <IconPicker value={icon} onChange={setIcon} />

        {/* Schedule */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sb-schedule-preset" className="text-sm font-medium text-ink">
            Delivery schedule
          </label>
          <p className="text-xs text-ink-tertiary -mt-0.5">When this edition is automatically generated</p>
          <select
            id="sb-schedule-preset"
            value={scheduleSelectValue}
            onChange={(e) => {
              if (e.target.value !== '__custom__') {
                setSchedule(e.target.value);
              }
            }}
            className={`w-full ${selectClasses}`}
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
              />
              <p className="text-xs text-ink-tertiary">
                Cron expression — e.g. <code className="font-mono bg-surface-sunken px-1 rounded">0 7 * * *</code> means
                daily at 7am
              </p>
            </div>
          )}
        </div>

        {/* Lookback */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sb-lookback" className="text-sm font-medium text-ink">
            How far back to look
          </label>
          <p className="text-xs text-ink-tertiary -mt-0.5">How old an article can be to appear in this edition</p>
          <select
            id="sb-lookback"
            value={lookbackHours}
            onChange={(e) => setLookbackHours(Number(e.target.value))}
            className={`w-full ${selectClasses}`}
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
        />
        {mode === 'edit' && (
          <Checkbox
            label="Active"
            description="When off, this edition won't be generated automatically"
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
        )}
      </div>

      <Separator soft />

      {/* Topics */}
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
            {selectedFocuses.map((config, idx) => (
              <div key={config.focusId} className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-mono text-accent w-5 text-center">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 text-sm font-medium text-ink">{config.focusName}</div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveFocus(config.focusId, -1)}
                      disabled={idx === 0}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                      aria-label="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFocus(config.focusId, 1)}
                      disabled={idx === selectedFocuses.length - 1}
                      className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
                      aria-label="Move down"
                    >
                      &darr;
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFocus(config.focusId)}
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
                        value={config.budgetValue}
                        onChange={(e) => updateFocusField(config.focusId, 'budgetValue', Number(e.target.value))}
                        className="w-16 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                      <select
                        value={config.budgetType}
                        onChange={(e) => updateFocusField(config.focusId, 'budgetType', e.target.value)}
                        className={selectClasses}
                      >
                        <option value="count">articles</option>
                        <option value="time">minutes of reading</option>
                      </select>
                    </div>
                  </div>

                  {/* Age limit */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-ink-tertiary">Age limit</span>
                    <select
                      value={config.lookbackHours === null ? '' : String(config.lookbackHours)}
                      onChange={(e) =>
                        updateFocusField(
                          config.focusId,
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
                      value={config.excludePriorEditions === null ? '' : config.excludePriorEditions ? 'true' : 'false'}
                      onChange={(e) =>
                        updateFocusField(
                          config.focusId,
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
                        value={config.weight}
                        onChange={(e) => updateFocusField(config.focusId, 'weight', Number(e.target.value))}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
                        {priorityLabel(config.weight)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available topics */}
      {availableFocuses.filter((f) => !selectedIds.has(f.id)).length > 0 && (
        <div>
          <div className="text-sm font-medium text-ink mb-0.5">Available topics</div>
          <p className="text-xs text-ink-tertiary mb-3">Add topics to include them as sections in your edition</p>
          <div className="flex flex-col gap-2">
            {availableFocuses
              .filter((f) => !selectedIds.has(f.id))
              .map((focus) => (
                <div key={focus.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{focus.name}</div>
                    {focus.description && <div className="text-xs text-ink-tertiary truncate">{focus.description}</div>}
                  </div>
                  <Button variant="ghost" size="sm" type="button" onClick={() => addFocus(focus.id)}>
                    Add
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" type="submit">
          {mode === 'edit' ? 'Save changes' : 'Create edition'}
        </Button>
        <Button variant="ghost" type="button">
          Cancel
        </Button>
      </div>
    </form>
  );
};

// ─── Stories ──────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Design System/Compositions/Edition Edit',
  parameters: {
    layout: 'padded',
  },
};

type Story = StoryObj;

const CreateEdition: Story = {
  name: 'Create edition',
  render: () => (
    <div className="py-8 px-6 max-w-2xl">
      <div className="mb-8">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">New edition</div>
        <h1 className="text-2xl font-serif tracking-tight text-ink">Configure a curated digest from your topics</h1>
      </div>
      <EditionEditForm mode="create" />
    </div>
  ),
};

const EditEdition: Story = {
  name: 'Edit edition',
  render: () => (
    <div className="py-8 px-6 max-w-2xl">
      <div className="mb-8">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">Edit edition</div>
        <h1 className="text-2xl font-serif tracking-tight text-ink">Morning Briefing</h1>
      </div>
      <EditionEditForm mode="edit" />
    </div>
  ),
};

const EmptyTopics: Story = {
  name: 'Empty topics state',
  render: () => (
    <div className="py-8 px-6 max-w-2xl">
      <div className="mb-8">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-2">New edition</div>
        <h1 className="text-2xl font-serif tracking-tight text-ink">No topics added yet</h1>
      </div>
      <EditionEditForm mode="create" />
    </div>
  ),
};

export default meta;
export { CreateEdition, EditEdition, EmptyTopics };
