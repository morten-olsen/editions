import * as React from 'react';
import { Link } from '@tanstack/react-router';

import { formatDate } from './article-card.tsx';

type FocusStat = { focusId: string; focusName: string; articleCount: number; avgConfidence: number };

type SourceCardProps = {
  id: string;
  name: string;
  url: string;
  lastFetchedAt?: string | null;
  fetchError?: string | null;
  href?: string;
  focusStats?: FocusStat[];
};

const SourceCard = ({ id, name, url, lastFetchedAt, fetchError, href, focusStats }: SourceCardProps): React.ReactElement => {
  const content = (
    <div
      className="p-4 rounded-lg border border-border bg-surface-raised transition-all duration-fast ease-gentle hover:shadow-sm hover:border-border-strong"
      data-ai-id={`source-${id}`}
      data-ai-role="card"
      data-ai-label={name}
      {...(fetchError ? { 'data-ai-error': fetchError } : {})}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-sm text-ink truncate">{name}</div>
          <div className="text-xs text-ink-tertiary truncate mt-0.5">{url}</div>
        </div>
        {fetchError && <div className="shrink-0 size-2 rounded-full bg-caution mt-1.5" title="Fetch error" />}
      </div>

      {lastFetchedAt && <div className="text-xs text-ink-faint mb-2">Last fetched {formatDate(lastFetchedAt)}</div>}

      {focusStats && focusStats.length > 0 && (
        <div className="space-y-1.5 mt-3">
          {focusStats.slice(0, 4).map((f) => {
            const pct = Math.round(f.avgConfidence * 100);
            return (
              <div key={f.focusId} className="flex items-center gap-2">
                <span className="text-xs text-ink-tertiary w-24 truncate">{f.focusName}</span>
                <div className="flex-1 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                  <div className="h-full bg-accent/50 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="font-mono text-xs text-ink-faint w-8 text-right">{pct}%</span>
              </div>
            );
          })}
          {focusStats.length > 4 && (
            <div className="text-xs text-ink-faint">+{focusStats.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export type { SourceCardProps };
export { SourceCard };
