import { createFileRoute } from '@tanstack/react-router';

import {
  useCreateEditionConfig,
  SCHEDULE_PRESETS,
  selectClasses,
  priorityLabel,
} from '../hooks/editions/editions.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Checkbox } from '../components/checkbox.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';

const NewEditionConfigPage = (): React.ReactNode => {
  const {
    name,
    setName,
    icon,
    setIcon,
    schedule,
    setSchedule,
    lookbackHours,
    setLookbackHours,
    excludePriorEditions,
    setExcludePriorEditions,
    error,
    focusSelection,
    isPending,
    handleSubmit,
    handleCancel,
  } = useCreateEditionConfig();

  const {
    allFocuses,
    focusesLoading,
    selectedFocuses,
    selectedIds,
    toggleFocus,
    updateFocusField,
    moveFocus,
    isPresetSchedule,
    scheduleSelectValue,
  } = focusSelection;

  if (focusesLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  return (
    <>
      <PageHeader title="New edition" subtitle="Configure a curated digest from your topics" />

      {error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edition-error"
          data-ai-role="error"
          data-ai-error={error}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edition-form"
        data-ai-role="form"
        data-ai-label="New edition form"
      >
        <div className="flex flex-col gap-5">
          <Input
            label="Name"
            placeholder="Morning Briefing"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ai-id="edition-name"
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
              value={scheduleSelectValue(schedule)}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setSchedule(e.target.value);
                }
              }}
              className={`w-full ${selectClasses}`}
              data-ai-id="edition-schedule"
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
            {!isPresetSchedule(schedule) && (
              <div className="flex flex-col gap-1.5 mt-1">
                <Input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="font-mono"
                  placeholder="0 7 * * *"
                  required
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
              data-ai-id="edition-lookback"
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
            data-ai-id="edition-exclude-prior"
            data-ai-role="checkbox"
            data-ai-label="Don't repeat articles across editions"
            data-ai-state={excludePriorEditions ? 'checked' : 'unchecked'}
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
              {selectedFocuses.map((config, idx) => {
                const focus = allFocuses.find((f) => f.id === config.focusId);
                if (!focus) {
                  return null;
                }

                return (
                  <div key={config.focusId} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono text-accent w-5 text-center">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 text-sm font-medium text-ink">{focus.name}</div>
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
                          onClick={() => toggleFocus(config.focusId)}
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

                      {/* Lookback override */}
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
                          value={
                            config.excludePriorEditions === null ? '' : config.excludePriorEditions ? 'true' : 'false'
                          }
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
                );
              })}
            </div>
          )}
        </div>

        {/* Available focuses to add */}
        {allFocuses.filter((f) => !selectedIds.has(f.id)).length > 0 && (
          <div data-ai-id="edition-available-topics" data-ai-role="list" data-ai-label="Available topics">
            <div className="text-sm font-medium text-ink mb-0.5">Available topics</div>
            <p className="text-xs text-ink-tertiary mb-3">Add topics to include them as sections in your edition</p>
            <div className="flex flex-col gap-2">
              {allFocuses
                .filter((f) => !selectedIds.has(f.id))
                .map((focus) => (
                  <div
                    key={focus.id}
                    className="flex items-center justify-between py-2"
                    data-ai-id={`edition-topic-${focus.id}`}
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
                      data-ai-id={`edition-add-topic-${focus.id}`}
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
            disabled={isPending}
            data-ai-id="edition-submit"
            data-ai-role="button"
            data-ai-label="Create edition"
            data-ai-state={isPending ? 'loading' : 'idle'}
          >
            {isPending ? 'Creating…' : 'Create edition'}
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={handleCancel}
            data-ai-id="edition-cancel"
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

const Route = createFileRoute('/editions/new')({
  component: NewEditionConfigPage,
});

export { Route };
