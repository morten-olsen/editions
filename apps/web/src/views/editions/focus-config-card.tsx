import { Button } from '../../components/button.tsx';

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

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

/* ---- Focus config card ---- */

const FocusConfigCard = ({
  focusConfig,
  focus,
  idx,
  total,
  onMove,
  onRemove,
  onUpdateField,
}: {
  focusConfig: FocusConfig;
  focus: Focus;
  idx: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onUpdateField: (
    field: 'budgetType' | 'budgetValue' | 'lookbackHours' | 'excludePriorEditions' | 'weight',
    value: string | number | boolean | null,
  ) => void;
}): React.ReactNode => (
  <div className="border border-border rounded-lg p-4">
    <FocusConfigHeader name={focus.name} idx={idx} total={total} onMove={onMove} onRemove={onRemove} />
    <div className="flex flex-col gap-4 pl-8">
      <BudgetField focusConfig={focusConfig} onUpdateField={onUpdateField} />
      <LookbackField focusConfig={focusConfig} onUpdateField={onUpdateField} />
      <PriorEditionsField focusConfig={focusConfig} onUpdateField={onUpdateField} />
      <PriorityField focusConfig={focusConfig} onUpdateField={onUpdateField} />
    </div>
  </div>
);

/* ---- Card header ---- */

const FocusConfigHeader = ({
  name,
  idx,
  total,
  onMove,
  onRemove,
}: {
  name: string;
  idx: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}): React.ReactNode => (
  <div className="flex items-center gap-3 mb-4">
    <span className="text-xs font-mono text-accent w-5 text-center">{String(idx + 1).padStart(2, '0')}</span>
    <div className="flex-1 text-sm font-medium text-ink">{name}</div>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={idx === 0}
        className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
        aria-label="Move up"
      >
        &uarr;
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={idx === total - 1}
        className="rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
        aria-label="Move down"
      >
        &darr;
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded px-1.5 py-0.5 text-xs text-ink-tertiary hover:text-critical cursor-pointer"
        aria-label="Remove"
      >
        &times;
      </button>
    </div>
  </div>
);

/* ---- Budget field ---- */

const BudgetField = ({
  focusConfig,
  onUpdateField,
}: {
  focusConfig: FocusConfig;
  onUpdateField: (field: 'budgetType' | 'budgetValue', value: string | number) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs text-ink-tertiary">Include up to</span>
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={focusConfig.budgetValue}
        onChange={(e) => onUpdateField('budgetValue', Number(e.target.value))}
        className="w-16 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <select
        value={focusConfig.budgetType}
        onChange={(e) => onUpdateField('budgetType', e.target.value)}
        className={selectClasses}
      >
        <option value="count">articles</option>
        <option value="time">minutes of reading</option>
      </select>
    </div>
  </div>
);

/* ---- Lookback override field ---- */

const LookbackField = ({
  focusConfig,
  onUpdateField,
}: {
  focusConfig: FocusConfig;
  onUpdateField: (field: 'lookbackHours', value: number | null) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs text-ink-tertiary">Age limit</span>
    <select
      value={focusConfig.lookbackHours === null ? '' : String(focusConfig.lookbackHours)}
      onChange={(e) => onUpdateField('lookbackHours', e.target.value === '' ? null : Number(e.target.value))}
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
);

/* ---- Prior editions field ---- */

const PriorEditionsField = ({
  focusConfig,
  onUpdateField,
}: {
  focusConfig: FocusConfig;
  onUpdateField: (field: 'excludePriorEditions', value: boolean | null) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs text-ink-tertiary">Past issue articles</span>
    <select
      value={focusConfig.excludePriorEditions === null ? '' : focusConfig.excludePriorEditions ? 'true' : 'false'}
      onChange={(e) => onUpdateField('excludePriorEditions', e.target.value === '' ? null : e.target.value === 'true')}
      className={selectClasses}
    >
      <option value="">Use edition setting</option>
      <option value="true">Skip — don&apos;t repeat past articles</option>
      <option value="false">Allow — past articles can reappear</option>
    </select>
  </div>
);

/* ---- Priority field ---- */

const PriorityField = ({
  focusConfig,
  onUpdateField,
}: {
  focusConfig: FocusConfig;
  onUpdateField: (field: 'weight', value: number) => void;
}): React.ReactNode => (
  <div className="flex flex-col gap-1.5">
    <span className="text-xs text-ink-tertiary">Priority</span>
    <p className="text-xs text-ink-faint -mt-1">How much to favour this topic when selecting articles</p>
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={3}
        step={0.1}
        value={focusConfig.weight}
        onChange={(e) => onUpdateField('weight', Number(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
        {priorityLabel(focusConfig.weight)}
      </span>
    </div>
  </div>
);

/* ---- Available focuses list ---- */

const AvailableFocusesList = ({
  allFocuses,
  selectedIds,
  onToggle,
  idPrefix,
}: {
  allFocuses: Focus[];
  selectedIds: Set<string>;
  onToggle: (focusId: string) => void;
  idPrefix: string;
}): React.ReactNode => {
  const available = allFocuses.filter((f) => !selectedIds.has(f.id));
  if (available.length === 0) {
    return null;
  }

  return (
    <div data-ai-id={`${idPrefix}-available-topics`} data-ai-role="list" data-ai-label="Available topics">
      <div className="text-sm font-medium text-ink mb-0.5">Available topics</div>
      <p className="text-xs text-ink-tertiary mb-3">Add topics to include them as sections in your edition</p>
      <div className="flex flex-col gap-2">
        {available.map((focus) => (
          <div
            key={focus.id}
            className="flex items-center justify-between py-2"
            data-ai-id={`${idPrefix}-topic-${focus.id}`}
            data-ai-role="section"
            data-ai-label={focus.name}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{focus.name}</div>
              {focus.description && <div className="text-xs text-ink-tertiary truncate">{focus.description}</div>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onToggle(focus.id)}
              data-ai-id={`${idPrefix}-add-topic-${focus.id}`}
              data-ai-role="button"
              data-ai-label={`Add ${focus.name}`}
            >
              Add
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export type { FocusConfig, Focus };
export { FocusConfigCard, AvailableFocusesList, selectClasses, priorityLabel };
