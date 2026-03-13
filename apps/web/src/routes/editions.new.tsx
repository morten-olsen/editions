import { createFileRoute } from '@tanstack/react-router';

import { useCreateEditionConfig, SCHEDULE_PRESETS, selectClasses, isPresetSchedule, scheduleSelectValue } from '../hooks/editions/editions.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Input } from '../components/input.tsx';
import { Button } from '../components/button.tsx';
import { Checkbox } from '../components/checkbox.tsx';
import { Separator } from '../components/separator.tsx';
import { IconPicker } from '../components/icon-picker.tsx';
import { FocusConfigCard, AvailableFocusesList } from '../views/editions/focus-config-card.tsx';

const NewEditionConfigPage = (): React.ReactNode => {
  const hook = useCreateEditionConfig();
  const { focusSelection } = hook;

  if (focusSelection.focusesLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading…</div>;
  }

  return (
    <>
      <PageHeader title="New edition" subtitle="Configure a curated digest from your topics" />

      {hook.error && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-6"
          data-ai-id="edition-error"
          data-ai-role="error"
          data-ai-error={hook.error}
        >
          {hook.error}
        </div>
      )}

      <form
        onSubmit={hook.handleSubmit}
        className="max-w-lg flex flex-col gap-6"
        data-ai-id="edition-form"
        data-ai-role="form"
        data-ai-label="New edition form"
      >
        <NewEditionFields hook={hook} />
        <Separator soft />
        <SelectedTopicsSection focusSelection={focusSelection} />
        <AvailableFocusesList
          allFocuses={focusSelection.allFocuses}
          selectedIds={focusSelection.selectedIds}
          onToggle={focusSelection.toggleFocus}
          idPrefix="edition"
        />
        <NewEditionActions isPending={hook.isPending} onCancel={hook.handleCancel} />
      </form>
    </>
  );
};

/* ---- Form fields ---- */

type EditionHook = ReturnType<typeof useCreateEditionConfig>;

const NewEditionFields = ({ hook }: { hook: EditionHook }): React.ReactNode => {
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
  } = hook;

  return (
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
      <NewScheduleField schedule={schedule} setSchedule={setSchedule} />
      <NewLookbackField lookbackHours={lookbackHours} setLookbackHours={setLookbackHours} />
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
  );
};

const NewScheduleField = ({
  schedule,
  setSchedule,
}: {
  schedule: string;
  setSchedule: (v: string) => void;
}): React.ReactNode => (
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
          Cron expression — e.g. <code className="font-mono bg-surface-sunken px-1 rounded">0 7 * * *</code> means daily
          at 7am
        </p>
      </div>
    )}
  </div>
);

const NewLookbackField = ({
  lookbackHours,
  setLookbackHours,
}: {
  lookbackHours: number;
  setLookbackHours: (v: number) => void;
}): React.ReactNode => (
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
);

/* ---- Selected topics section ---- */

type FocusSelection = EditionHook['focusSelection'];

const SelectedTopicsSection = ({ focusSelection }: { focusSelection: FocusSelection }): React.ReactNode => {
  const { allFocuses, selectedFocuses, toggleFocus, updateFocusField, moveFocus } = focusSelection;

  return (
    <div>
      <div className="text-sm font-medium text-ink mb-0.5">
        Topics{' '}
        {selectedFocuses.length > 0 && (
          <span className="text-ink-tertiary font-normal">({selectedFocuses.length})</span>
        )}
      </div>
      <p className="text-xs text-ink-tertiary mb-4">
        Each topic becomes a section in your edition. Use the arrows to reorder.
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
              <FocusConfigCard
                key={config.focusId}
                focusConfig={config}
                focus={focus}
                idx={idx}
                total={selectedFocuses.length}
                onMove={(dir) => moveFocus(config.focusId, dir)}
                onRemove={() => toggleFocus(config.focusId)}
                onUpdateField={(field, value) => updateFocusField(config.focusId, field, value)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---- Actions ---- */

const NewEditionActions = ({ isPending, onCancel }: { isPending: boolean; onCancel: () => void }): React.ReactNode => (
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
      onClick={onCancel}
      data-ai-id="edition-cancel"
      data-ai-role="button"
      data-ai-label="Cancel"
    >
      Cancel
    </Button>
  </div>
);

const Route = createFileRoute('/editions/new')({
  component: NewEditionConfigPage,
});

export { Route };
