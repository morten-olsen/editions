import * as React from 'react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';

import { Collapse } from './animate.tsx';

/* ── Types ──────────────────────────────────────────────────────── */

type FocusClassification = {
  focusId: string;
  focusName: string;
  focusIcon: string | null;
  confidence: number;
};

type FocusInsightProps = {
  classifications: FocusClassification[];
};

/* ── Helpers ─────────────────────────────────────────────────────── */

const formatConfidence = (value: number): string => `${Math.round(value * 100)}%`;

const confidenceLabel = (value: number): string => {
  if (value >= 0.8) {
    return 'Strong match';
  }
  if (value >= 0.5) {
    return 'Moderate match';
  }
  if (value >= 0.3) {
    return 'Weak match';
  }
  return 'Low match';
};

const confidenceColor = (value: number): string => {
  if (value >= 0.8) {
    return 'bg-accent';
  }
  if (value >= 0.5) {
    return 'bg-accent/60';
  }
  return 'bg-ink-faint';
};

/* ── Sub-components ──────────────────────────────────────────────── */

const FocusRow = ({ classification }: { classification: FocusClassification }): React.ReactElement => (
  <Link
    to="/focuses/$focusId"
    params={{ focusId: classification.focusId }}
    className="flex items-center gap-3 py-2 group"
  >
    <span className="shrink-0 w-5 text-center text-sm">{classification.focusIcon ?? ''}</span>
    <span className="flex-1 min-w-0 text-sm text-ink-secondary group-hover:text-ink transition-colors duration-fast truncate">
      {classification.focusName}
    </span>
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-normal ${confidenceColor(classification.confidence)}`}
          style={{ width: `${Math.round(classification.confidence * 100)}%` }}
        />
      </div>
      <span
        className="text-xs text-ink-tertiary tabular-nums w-8 text-right"
        title={confidenceLabel(classification.confidence)}
      >
        {formatConfidence(classification.confidence)}
      </span>
    </div>
  </Link>
);

/* ── Main component ──────────────────────────────────────────────── */

const FocusInsight = ({ classifications }: FocusInsightProps): React.ReactElement | null => {
  const [open, setOpen] = useState(false);

  if (classifications.length === 0) {
    return null;
  }

  const topMatch = classifications[0];

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 text-xs text-ink-tertiary hover:text-ink-secondary transition-colors duration-fast cursor-pointer select-none"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-fast ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>
        <span>
          Focus insight
          {!open && topMatch && (
            <span className="text-ink-faint">
              {' '}
              &middot; top match: {topMatch.focusName} ({formatConfidence(topMatch.confidence)})
            </span>
          )}
        </span>
      </button>

      <Collapse show={open} duration="slow">
        <div className="mt-3 pl-5.5">
          <p className="text-xs text-ink-faint mb-2">
            How this article relates to your focuses. Use this to fine-tune focus settings.
          </p>
          <div className="divide-y divide-border">
            {classifications.map((c) => (
              <FocusRow key={c.focusId} classification={c} />
            ))}
          </div>
        </div>
      </Collapse>
    </div>
  );
};

export type { FocusClassification, FocusInsightProps };
export { FocusInsight };
