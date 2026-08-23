import { useState } from 'react';

import { useSweepPreview } from '../../hooks/editions/editions.issues-hooks.ts';
import type { SweepAction, SweepFilter } from '../../hooks/editions/editions.issues-hooks.ts';
import { Button } from '../../components/button.tsx';
import { Dialog } from '../../components/dialog.tsx';

type SweepScope = 'read' | 'unread' | 'any';
type SweepAge = 'any' | '7' | '30' | '90';

const SCOPE_LABELS: Record<SweepScope, string> = {
  read: 'Read issues',
  unread: 'Unread issues',
  any: 'All issues',
};

const AGE_LABELS: Record<SweepAge, string> = {
  any: 'Any age',
  '7': 'Older than 7 days',
  '30': 'Older than 30 days',
  '90': 'Older than 90 days',
};

const ACTION_LABELS: Record<SweepAction, string> = {
  delete: 'Delete',
  'mark-read': 'Mark read',
  'mark-unread': 'Mark unread',
};

const buildFilter = ({
  scope,
  age,
  keepLatest,
}: {
  scope: SweepScope;
  age: SweepAge;
  keepLatest: number;
}): SweepFilter => ({
  ...(scope === 'any' ? {} : { read: scope === 'read' }),
  ...(age === 'any' ? {} : { publishedBefore: new Date(Date.now() - Number(age) * 86_400_000).toISOString() }),
  ...(keepLatest > 0 ? { keepLatest } : {}),
});

const selectClasses =
  'h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer';

type SweepFormState = {
  scope: SweepScope;
  setScope: (v: SweepScope) => void;
  age: SweepAge;
  setAge: (v: SweepAge) => void;
  keepLatest: number;
  setKeepLatest: (v: number) => void;
  action: SweepAction;
  setAction: (v: SweepAction) => void;
};

type SweepSelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  aiId: string;
};

const SweepSelect = <T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  aiId,
}: SweepSelectProps<T>): React.ReactElement => (
  <label className="flex flex-col gap-1.5">
    <span className="font-mono text-xs tracking-wide text-ink-tertiary">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={selectClasses}
      data-ai-id={aiId}
      data-ai-role="select"
      data-ai-label={label}
      data-ai-value={value}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {labels[opt]}
        </option>
      ))}
    </select>
  </label>
);

const SweepForm = ({
  scope,
  setScope,
  age,
  setAge,
  keepLatest,
  setKeepLatest,
  action,
  setAction,
}: SweepFormState): React.ReactElement => (
  <div className="grid gap-4 sm:grid-cols-2 mb-6">
    <SweepSelect
      label="Which issues"
      value={scope}
      options={['read', 'unread', 'any'] as const}
      labels={SCOPE_LABELS}
      onChange={setScope}
      aiId="issues-sweep-scope"
    />
    <SweepSelect
      label="Age"
      value={age}
      options={['any', '7', '30', '90'] as const}
      labels={AGE_LABELS}
      onChange={setAge}
      aiId="issues-sweep-age"
    />
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-wide text-ink-tertiary">Always keep newest</span>
      <input
        type="number"
        min={0}
        max={100}
        value={keepLatest}
        onChange={(e) => setKeepLatest(Math.max(0, Number(e.target.value) || 0))}
        className={selectClasses}
        data-ai-id="issues-sweep-keep"
        data-ai-role="input"
        data-ai-label="Issues to always keep"
        data-ai-value={String(keepLatest)}
      />
    </label>
    <SweepSelect
      label="Action"
      value={action}
      options={['delete', 'mark-read', 'mark-unread'] as const}
      labels={ACTION_LABELS}
      onChange={setAction}
      aiId="issues-sweep-action"
    />
  </div>
);

const SweepSummary = ({
  affected,
  action,
}: {
  affected: number | undefined;
  action: SweepAction;
}): React.ReactElement => (
  <p
    className={`text-sm mb-6 ${action === 'delete' ? 'text-critical' : 'text-ink-secondary'}`}
    data-ai-id="issues-sweep-preview"
    data-ai-role="info"
    data-ai-label="Issues affected"
    data-ai-value={affected === undefined ? 'counting' : String(affected)}
  >
    {affected === undefined
      ? 'Counting matching issues...'
      : affected === 0
        ? 'No issues match this filter.'
        : `${ACTION_LABELS[action]} ${affected} issue${affected === 1 ? '' : 's'}${
            action === 'delete' ? ' — this cannot be undone.' : '.'
          }`}
  </p>
);

const CleanUpDialog = ({
  configId,
  open,
  onOpenChange,
  onRun,
  pending,
}: {
  configId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (params: { filter: SweepFilter; action: SweepAction }) => void;
  pending: boolean;
}): React.ReactElement => {
  const [scope, setScope] = useState<SweepScope>('read');
  const [age, setAge] = useState<SweepAge>('any');
  const [keepLatest, setKeepLatest] = useState(5);
  const [action, setAction] = useState<SweepAction>('delete');

  const filter = buildFilter({ scope, age, keepLatest });
  const affected = useSweepPreview(configId, filter, open);

  const isDestructive = action === 'delete';
  const canRun = affected !== undefined && affected > 0 && !pending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content data-ai-id="issues-sweep-dialog" data-ai-role="dialog" data-ai-label="Clean up issues">
        <Dialog.Title>Clean up issues</Dialog.Title>
        <Dialog.Description>
          Applies to every issue matching the filter, not just this page. The newest issues can be protected so a
          clean-up can never empty the magazine.
        </Dialog.Description>

        <SweepForm
          scope={scope}
          setScope={setScope}
          age={age}
          setAge={setAge}
          keepLatest={keepLatest}
          setKeepLatest={setKeepLatest}
          action={action}
          setAction={setAction}
        />

        <SweepSummary affected={affected} action={action} />

        <div className="flex justify-end gap-3">
          <Dialog.Close render={<Button variant="ghost" size="sm" data-ai-id="issues-sweep-cancel" />}>
            Cancel
          </Dialog.Close>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            size="sm"
            disabled={!canRun}
            onClick={() => onRun({ filter, action })}
            data-ai-id="issues-sweep-confirm"
            data-ai-role="button"
            data-ai-label="Run clean-up"
            data-ai-state={pending ? 'loading' : canRun ? 'idle' : 'disabled'}
          >
            {pending ? 'Working...' : ACTION_LABELS[action]}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export type { SweepAge, SweepScope };
export { ACTION_LABELS, CleanUpDialog };
