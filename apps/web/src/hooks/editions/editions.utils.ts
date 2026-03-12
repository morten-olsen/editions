import type { EditionArticle, FocusSection, FocusConfig } from './editions.types.ts';

/* ── Shared constants ─────────────────────────────────────────────── */

const SCHEDULE_PRESETS = [
  { label: 'Daily at 7am', value: '0 7 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Daily at noon', value: '0 12 * * *' },
  { label: 'Weekdays at 7am', value: '0 7 * * 1-5' },
  { label: 'Weekdays at 8am', value: '0 8 * * 1-5' },
  { label: 'Every Monday at 8am', value: '0 8 * * 1' },
  { label: 'Every Friday at 5pm', value: '0 17 * * 5' },
  { label: 'Custom…', value: '__custom__' },
] as const;

const selectClasses =
  'rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20';

/* ── Shared helpers ───────────────────────────────────────────────── */

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

const formatLookback = (hours: number): string => {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.round(hours / 24);
  return days === 7 ? '1 week' : `${days}d`;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? '< 1 min' : `${minutes} min read`;
};

const groupByFocus = (articles: EditionArticle[]): FocusSection[] => {
  const sections: FocusSection[] = [];
  const map = new Map<string, FocusSection>();
  for (const article of articles) {
    let section = map.get(article.focusId);
    if (!section) {
      section = { focusId: article.focusId, focusName: article.focusName, articles: [] };
      map.set(article.focusId, section);
      sections.push(section);
    }
    section.articles.push(article);
  }
  return sections;
};

const isPresetSchedule = (schedule: string): boolean =>
  SCHEDULE_PRESETS.some((p) => p.value !== '__custom__' && p.value === schedule);

const scheduleSelectValue = (schedule: string): string => (isPresetSchedule(schedule) ? schedule : '__custom__');

const mapFocusesToPayload = (
  focuses: FocusConfig[],
): {
  focusId: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
}[] =>
  focuses.map((f, i) => ({
    focusId: f.focusId,
    position: i,
    budgetType: f.budgetType,
    budgetValue: f.budgetValue,
    lookbackHours: f.lookbackHours,
    excludePriorEditions: f.excludePriorEditions,
    weight: f.weight,
  }));

/* ── Exports ──────────────────────────────────────────────────────── */

export {
  SCHEDULE_PRESETS,
  selectClasses,
  priorityLabel,
  formatLookback,
  formatTime,
  groupByFocus,
  isPresetSchedule,
  scheduleSelectValue,
  mapFocusesToPayload,
};
