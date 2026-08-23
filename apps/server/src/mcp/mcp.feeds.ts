import { parseRssFeed } from '../sources/sources.fetch.ts';
import type { FeedItem } from '../sources/sources.fetch.ts';

import { LIMITS, truncate } from './mcp.budget.ts';

/**
 * Feed inspection that touches no database.
 *
 * Kept apart from the tools so probing a candidate URL stays a pure function of
 * the network — that is what lets `inspect_feed` be a `read`-scope tool with no
 * side effects, and what makes these helpers testable without a server.
 */

// --- Types ---

type ProbeResult = {
  url: string;
  ok: boolean;
  error?: string;
  itemCount?: number;
  itemsPerWeek?: number | null;
  newestItemAt?: string | null;
  /** Whether items carry full text or just a blurb — decides how much extraction has to do. */
  contentDepth?: 'full-text' | 'summary-only' | 'unknown';
  recentTitles?: string[];
};

// --- URL comparison ---

/**
 * Canonical form for deciding whether two URLs name the same feed. Lowercases
 * the host and drops a trailing slash, so `HTTPS://Ex.com/f/` and
 * `https://ex.com/f` do not become two copies of one source.
 */
const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
};

// --- Publishing rate ---

/** Publishing rate from a known item count over a known span. */
const ratePerWeek = ({ count, from, to }: { count: number; from: string | null; to: string | null }): number | null => {
  if (count < 2 || from === null || to === null) {
    return null;
  }
  const spanMs = Date.parse(to) - Date.parse(from);
  if (!Number.isFinite(spanMs) || spanMs <= 0) {
    return null;
  }
  // Floor the span at a day, so a burst of same-hour posts cannot report a
  // nonsensically large weekly rate.
  const weeks = Math.max(spanMs / (7 * 24 * 60 * 60 * 1000), 1 / 7);
  return Number((count / weeks).toFixed(1));
};

/** Publishing rate inferred from a list of item timestamps. */
const estimateItemsPerWeek = (dates: (string | null)[]): number | null => {
  const times = dates
    .filter((d): d is string => d !== null)
    .map((d) => Date.parse(d))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);

  if (times.length < 2) {
    return null;
  }

  return ratePerWeek({
    // n timestamps bound n-1 intervals; counting the items themselves would
    // overstate the rate on a short span.
    count: times.length - 1,
    from: new Date(times[times.length - 1] as number).toISOString(),
    to: new Date(times[0] as number).toISOString(),
  });
};

// --- Probing ---

/** Fetches and parses a feed URL, reporting failure as data rather than throwing. */
const probeFeed = async (url: string): Promise<ProbeResult> => {
  let items: FeedItem[];
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      return { url, ok: false, error: `HTTP ${response.status} ${response.statusText}` };
    }
    items = parseRssFeed(await response.text());
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (items.length === 0) {
    return { url, ok: false, error: 'No feed items found — not an RSS or Atom feed, or the feed is empty' };
  }

  // 500 chars is well past a summary but short of an article, so it separates
  // feeds that ship full text from those the extractor will have to fetch.
  const withContent = items.filter((i) => (i.content?.length ?? 0) > 500).length;
  const dates = items.map((i) => i.publishedAt);
  const newest =
    dates
      .filter((d): d is string => d !== null)
      .sort()
      .at(-1) ?? null;

  return {
    url,
    ok: true,
    itemCount: items.length,
    itemsPerWeek: estimateItemsPerWeek(dates),
    newestItemAt: newest,
    contentDepth: withContent > items.length / 2 ? 'full-text' : withContent === 0 ? 'summary-only' : 'unknown',
    recentTitles: items.slice(0, LIMITS.feedProbeItems).map((i) => truncate(i.title, LIMITS.titleChars) ?? ''),
  };
};

export type { ProbeResult };
export { normalizeUrl, ratePerWeek, estimateItemsPerWeek, probeFeed };
