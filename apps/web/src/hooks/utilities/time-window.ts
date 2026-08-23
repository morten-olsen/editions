/**
 * The time filter shared by the global feed, the focus feeds and the focus
 * preview. One definition and one default: changing what "recent" means is a
 * single edit here rather than three that can drift apart.
 */
type TimeWindow = 'today' | 'week' | 'all';

/**
 * Feeds open on today's articles. The feed is the between-editions surface, so
 * the useful default is "what's new", not the whole archive.
 */
const DEFAULT_TIME_WINDOW: TimeWindow = 'today';

const WINDOW_HOURS: Record<Exclude<TimeWindow, 'all'>, number> = {
  today: 24,
  week: 7 * 24,
};

/**
 * Converts a window to the `from`/`to` query the feed endpoints take.
 *
 * "Today" is a rolling 24 hours rather than since-local-midnight — it keeps an
 * article published last evening in view instead of dropping it at midnight.
 */
const windowToRange = (window: TimeWindow): { from?: string; to?: string } => {
  if (window === 'all') {
    return {};
  }
  const from = new Date(Date.now() - WINDOW_HOURS[window] * 60 * 60 * 1000);
  return { from: from.toISOString() };
};

const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  today: 'Today',
  week: 'This week',
  all: 'All time',
};

export type { TimeWindow };
export { DEFAULT_TIME_WINDOW, TIME_WINDOW_LABELS, windowToRange };
