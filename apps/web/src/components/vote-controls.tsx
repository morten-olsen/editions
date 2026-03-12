import * as React from 'react';

type VoteValue = 1 | -1 | null;

type VoteControlsProps = {
  value: VoteValue;
  onVote: (value: VoteValue) => void;
  label?: string;
};

const ChevronUp = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M3.5 8.5L7 5L10.5 8.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronDown = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M3.5 5.5L7 9L10.5 5.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VoteControls = ({ value, onVote, label }: VoteControlsProps): React.ReactElement => {
  const handleUp = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onVote(value === 1 ? null : 1);
  };

  const handleDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    onVote(value === -1 ? null : -1);
  };

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleUp}
        className={`rounded p-0.5 transition-colors duration-fast ease-gentle cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          value === 1 ? 'text-accent' : 'text-ink-faint hover:text-ink-tertiary'
        }`}
        aria-label={label ? `${label}: more like this` : 'More like this'}
      >
        <ChevronUp />
      </button>
      <button
        type="button"
        onClick={handleDown}
        className={`rounded p-0.5 transition-colors duration-fast ease-gentle cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          value === -1 ? 'text-critical' : 'text-ink-faint hover:text-ink-tertiary'
        }`}
        aria-label={label ? `${label}: less like this` : 'Less like this'}
      >
        <ChevronDown />
      </button>
      {label && <span className="text-xs text-ink-faint ml-0.5 select-none">{label}</span>}
    </div>
  );
};

export type { VoteControlsProps, VoteValue };
export { VoteControls };
