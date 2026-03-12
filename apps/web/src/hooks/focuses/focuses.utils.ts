import type { TimeWindow } from './focuses.types.ts';

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

const confidenceHint = (v: number): string => {
  if (v === 0) {
    return 'All articles';
  }
  if (v <= 30) {
    return 'Loose match';
  }
  if (v <= 60) {
    return 'Moderate';
  }
  if (v <= 80) {
    return 'Strong match';
  }
  return 'Exact match';
};

const PAGE_SIZE = 20;

const ANALYSIS_JOB_TYPES = new Set([
  'reconcile_focus',
  'reanalyse_source',
  'reanalyse_all',
  'refresh_source',
  'extract_and_analyse',
]);

const windowToRange = (window: TimeWindow): { from?: string; to?: string } => {
  if (window === 'all') {
    return {};
  }
  const now = new Date();
  const from = new Date(now.getTime() - (window === 'today' ? 24 : 7 * 24) * 60 * 60 * 1000);
  return { from: from.toISOString() };
};

export { selectClasses, priorityLabel, confidenceHint, PAGE_SIZE, ANALYSIS_JOB_TYPES, windowToRange };
