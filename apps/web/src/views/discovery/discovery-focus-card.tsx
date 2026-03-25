import * as React from 'react';

import { Button } from '../../components/button.tsx';
import { EntityIcon } from '../../components/entity-icon.tsx';

import type { DiscoveryFocus } from '../../hooks/discovery/discovery.hooks.ts';

type DiscoveryFocusCardProps = {
  focus: DiscoveryFocus;
  sourceNames: Map<string, string>;
  onAdopt: (id: string) => void;
  adopting: boolean;
};

const DiscoveryFocusCard = ({ focus, sourceNames, onAdopt, adopting }: DiscoveryFocusCardProps): React.ReactElement => (
  <div
    className="rounded-lg border border-border bg-surface-raised overflow-hidden break-inside-avoid"
    data-ai-id={`discovery-focus-${focus.id}`}
    data-ai-role="section"
    data-ai-label={focus.name}
  >
    {focus.coverImage && (
      <img src={focus.coverImage} alt="" className="w-full h-32 object-cover" />
    )}

    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-accent-subtle flex items-center justify-center shrink-0 mt-0.5">
          <EntityIcon icon={focus.icon} fallback="target" size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg font-medium tracking-tight text-ink">{focus.name}</div>
          <div className="text-sm text-ink-secondary mt-0.5 leading-relaxed">{focus.description}</div>
        </div>
        <div className="shrink-0 ml-2">
          {focus.adopted ? (
            <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
              <EntityIcon icon="check" size={12} />
              Added
            </span>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAdopt(focus.id)}
              disabled={adopting}
            >
              Add
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {focus.sources.map((s) => (
          <span
            key={s.sourceId}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-ink-tertiary"
          >
            <EntityIcon icon="rss" size={10} className="text-ink-faint" />
            {sourceNames.get(s.sourceId) ?? s.sourceId}
          </span>
        ))}
      </div>
    </div>
  </div>
);

export type { DiscoveryFocusCardProps };
export { DiscoveryFocusCard };
