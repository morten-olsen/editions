import * as React from 'react';

import { Button } from '../../components/button.tsx';
import { EntityIcon } from '../../components/entity-icon.tsx';
import { SCHEDULE_PRESETS } from '../../hooks/editions/editions.utils.ts';

import type { DiscoveryEditionConfig } from '../../hooks/discovery/discovery.hooks.ts';

type DiscoveryEditionCardProps = {
  config: DiscoveryEditionConfig;
  focusNames: Map<string, string>;
  onAdopt: (id: string) => void;
  adopting: boolean;
};

const scheduleLabel = (cron: string): string => {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === cron);
  return preset ? preset.label : cron;
};

const DiscoveryEditionCard = ({
  config,
  focusNames,
  onAdopt,
  adopting,
}: DiscoveryEditionCardProps): React.ReactElement => (
  <div
    className="rounded-lg border border-border bg-surface-raised overflow-hidden break-inside-avoid"
    data-ai-id={`discovery-edition-${config.id}`}
    data-ai-role="section"
    data-ai-label={config.name}
  >
    {config.coverImage && (
      <img src={config.coverImage} alt="" className="w-full h-36 object-cover" />
    )}

    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
          <EntityIcon icon={config.icon} fallback="book-open" size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-xl font-medium tracking-tight text-ink">{config.name}</div>
          <div className="text-sm text-ink-secondary mt-1 leading-relaxed">{config.description}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-tertiary">
        <span className="inline-flex items-center gap-1">
          <EntityIcon icon="clock" size={12} className="text-ink-faint" />
          {scheduleLabel(config.schedule)}
        </span>
        <span className="inline-flex items-center gap-1">
          <EntityIcon icon="layers" size={12} className="text-ink-faint" />
          {config.focuses.length} {config.focuses.length === 1 ? 'focus' : 'focuses'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {config.focuses.map((f) => (
          <span
            key={f.focusId}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent-subtle text-accent"
          >
            {focusNames.get(f.focusId) ?? f.focusId}
          </span>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        {config.adopted ? (
          <span className="inline-flex items-center gap-1 text-sm text-accent font-medium">
            <EntityIcon icon="check" size={14} />
            Added to your editions
          </span>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAdopt(config.id)}
            disabled={adopting}
          >
            Add to my editions
          </Button>
        )}
      </div>
    </div>
  </div>
);

export type { DiscoveryEditionCardProps };
export { DiscoveryEditionCard };
