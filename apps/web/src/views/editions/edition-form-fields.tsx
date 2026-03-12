import { Input } from '../../components/input.tsx';
import { SCHEDULE_PRESETS } from '../../hooks/editions/editions.edit-hooks.ts';

import { selectClasses } from './focus-config-card.tsx';

/* ---- Schedule field ---- */

const ScheduleField = ({
  schedule,
  setSchedule,
  isPresetSchedule,
  scheduleSelectValue,
}: {
  schedule: string;
  setSchedule: (v: string) => void;
  isPresetSchedule: boolean;
  scheduleSelectValue: string;
}): React.ReactNode => (
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
          Cron expression — e.g. <code className="font-mono bg-surface-sunken px-1 rounded">0 7 * * *</code> means daily
          at 7am
        </p>
      </div>
    )}
  </div>
);

/* ---- Lookback field ---- */

const LookbackField = ({
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
);

export { ScheduleField, LookbackField };
