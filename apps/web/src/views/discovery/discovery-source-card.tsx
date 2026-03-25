import * as React from 'react';

import { Button } from '../../components/button.tsx';
import { EntityIcon } from '../../components/entity-icon.tsx';

import type { DiscoverySource } from '../../hooks/discovery/discovery.hooks.ts';

type DiscoverySourceCardProps = {
  source: DiscoverySource;
  onAdopt: (id: string) => void;
  adopting: boolean;
};

const domainFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const DiscoverySourceCard = ({ source, onAdopt, adopting }: DiscoverySourceCardProps): React.ReactElement => (
  <div
    className="rounded-lg border border-border bg-surface-raised p-4 flex items-start gap-3 break-inside-avoid"
    data-ai-id={`discovery-source-${source.id}`}
    data-ai-role="section"
    data-ai-label={source.name}
  >
    {source.coverImage ? (
      <img
        src={source.coverImage}
        alt=""
        className="w-10 h-10 rounded-md object-cover shrink-0"
      />
    ) : (
      <div className="w-10 h-10 rounded-md bg-surface-sunken flex items-center justify-center shrink-0">
        <EntityIcon icon="rss" size={16} className="text-ink-tertiary" />
      </div>
    )}

    <div className="flex-1 min-w-0">
      <div className="font-serif text-base font-medium tracking-tight text-ink">{source.name}</div>
      <div className="text-xs text-ink-tertiary mt-0.5">{domainFromUrl(source.url)}</div>
      <div className="text-sm text-ink-secondary mt-1 line-clamp-2 leading-relaxed">{source.description}</div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {source.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-full bg-surface-sunken text-ink-tertiary"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>

    <div className="shrink-0 ml-2">
      {source.adopted ? (
        <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
          <EntityIcon icon="check" size={12} />
          Added
        </span>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAdopt(source.id)}
          disabled={adopting}
        >
          Add
        </Button>
      )}
    </div>
  </div>
);

export type { DiscoverySourceCardProps };
export { DiscoverySourceCard };
