import { useState } from 'react';

import { Checkbox } from '../../components/checkbox.tsx';
import { confidenceHint } from '../../hooks/focuses/focuses.utils.ts';

type FocusSource = {
  sourceId: string;
  weight: number;
  minConfidence: number | null;
};

type Source = {
  id: string;
  name: string;
  url: string;
};

const selectClasses =
  'rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-secondary focus:outline-none focus:ring-1 focus:ring-accent';

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

const SourceSelectionList = ({
  allSources,
  selectedSources,
  selectedIds,
  onToggle,
  onChangeWeight,
  onChangeMinConfidence,
  idPrefix,
}: {
  allSources: Source[];
  selectedSources: FocusSource[];
  selectedIds: Set<string>;
  onToggle: (sourceId: string) => void;
  onChangeWeight: (sourceId: string, weight: number) => void;
  onChangeMinConfidence?: (sourceId: string, minConfidence: number | null) => void;
  idPrefix: string;
}): React.ReactNode => (
  <div data-ai-id={`${idPrefix}-sources`} data-ai-role="list" data-ai-label="Source selection">
    <div className="text-sm font-medium text-ink mb-0.5">Sources</div>
    <p className="text-xs text-ink-tertiary mb-4">
      Choose which sources feed this topic. All articles are scored — use the threshold to control how closely they must
      match.
    </p>
    {allSources.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-sm text-ink-tertiary">No sources yet.</p>
        <p className="text-xs text-ink-faint mt-1">You can add sources later.</p>
      </div>
    ) : (
      <div className="flex flex-col gap-1">
        {allSources.map((source) => {
          const isSelected = selectedIds.has(source.id);
          const selection = selectedSources.find((s) => s.sourceId === source.id);

          return (
            <SourceItem
              key={source.id}
              source={source}
              isSelected={isSelected}
              selection={selection ?? null}
              onToggle={() => onToggle(source.id)}
              onChangeWeight={(weight) => onChangeWeight(source.id, weight)}
              onChangeMinConfidence={onChangeMinConfidence ? (mc) => onChangeMinConfidence(source.id, mc) : undefined}
              idPrefix={idPrefix}
            />
          );
        })}
      </div>
    )}
  </div>
);

const SourceConfidenceOverride = ({
  value,
  onChange,
  sourceId,
  idPrefix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  sourceId: string;
  idPrefix: string;
}): React.ReactNode => {
  const [enabled, setEnabled] = useState(value !== null);
  const displayValue = value !== null ? Math.round(value * 100) : 50;

  const handleToggle = (): void => {
    if (enabled) {
      setEnabled(false);
      onChange(null);
    } else {
      setEnabled(true);
      onChange(displayValue / 100);
    }
  };

  return (
    <div className="mt-2 pl-7">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs text-accent hover:text-accent-hover transition-colors duration-fast"
        data-ai-id={`${idPrefix}-source-${sourceId}-confidence-toggle`}
        data-ai-role="button"
        data-ai-label="Toggle match threshold override"
      >
        {enabled ? 'Remove threshold override' : 'Set minimum match threshold'}
      </button>
      {enabled && (
        <div className="mt-1.5 flex items-center gap-3">
          <span className="text-xs text-ink-tertiary shrink-0">Threshold</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={displayValue}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            className="flex-1 accent-accent"
            data-ai-id={`${idPrefix}-source-${sourceId}-confidence`}
            data-ai-role="input"
            data-ai-label="Source match threshold"
            data-ai-value={String(displayValue)}
          />
          <span className="text-xs font-medium text-ink-secondary tabular-nums w-24 text-right">
            {displayValue === 0 ? 'All articles' : `${displayValue}% — ${confidenceHint(displayValue)}`}
          </span>
        </div>
      )}
    </div>
  );
};

const SourceItem = ({
  source,
  isSelected,
  selection,
  onToggle,
  onChangeWeight,
  onChangeMinConfidence,
  idPrefix,
}: {
  source: Source;
  isSelected: boolean;
  selection: FocusSource | null;
  onToggle: () => void;
  onChangeWeight: (weight: number) => void;
  onChangeMinConfidence?: (minConfidence: number | null) => void;
  idPrefix: string;
}): React.ReactNode => (
  <div
    className={`rounded-md transition-colors duration-fast ${isSelected ? 'bg-surface-sunken/50 p-3' : 'px-3 py-2'}`}
    data-ai-id={`${idPrefix}-source-${source.id}`}
    data-ai-role="checkbox"
    data-ai-label={source.name}
    data-ai-state={isSelected ? 'checked' : 'unchecked'}
  >
    <div className="flex items-center justify-between">
      <Checkbox label={source.name} checked={isSelected} onCheckedChange={onToggle} />
    </div>
    {isSelected && selection && (
      <>
        <div className="mt-2 pl-7 flex items-center gap-3">
          <span className="text-xs text-ink-tertiary shrink-0">Priority</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={selection.weight}
            onChange={(e) => onChangeWeight(Number(e.target.value))}
            className="flex-1 accent-accent"
            data-ai-id={`${idPrefix}-source-${source.id}-weight`}
            data-ai-role="input"
            data-ai-label={`${source.name} priority`}
            data-ai-value={String(selection.weight)}
          />
          <span className="text-xs font-medium text-ink-secondary tabular-nums w-12 text-right">
            {priorityLabel(selection.weight)}
          </span>
        </div>
        {onChangeMinConfidence && (
          <SourceConfidenceOverride
            value={selection.minConfidence}
            onChange={onChangeMinConfidence}
            sourceId={source.id}
            idPrefix={idPrefix}
          />
        )}
      </>
    )}
  </div>
);

export type { FocusSource, Source };
export { SourceSelectionList, selectClasses, priorityLabel };
