/**
 * Context budgeting for MCP tool output.
 *
 * The client of this API is an LLM with a finite context window, and Editions
 * holds tens of thousands of articles. A tool that returns "all matching
 * articles" is not generous, it is a denial of service against the caller's
 * ability to reason. So truncation is built into the shape of every list this
 * module hands out, rather than left to each tool to remember.
 *
 * The rule that makes truncation safe is that a truncated list always reports
 * its own `total`. An agent that sees `shown: 10, total: 4213` knows to narrow
 * its query; an agent handed a bare array of 10 assumes it has seen everything.
 */

// --- Types ---

type Capped<T> = {
  items: T[];
  /** How many items are in `items`. */
  shown: number;
  /** How many exist in total, before capping. */
  total: number;
  truncated: boolean;
};

// --- Limits ---

/**
 * Roughly how much a single tool response should cost the caller. Not enforced
 * mechanically — it is the budget the per-tool caps below are chosen against.
 */
const TARGET_RESPONSE_TOKENS = 7000;

const LIMITS = {
  /** Article body text, only ever returned by `get_article`. */
  articleContentChars: 4000,
  /** Summaries appear in sampled lists, so they are cut much harder. */
  summaryChars: 280,
  titleChars: 200,
  /** Sampled article titles per source in `profile_source`. */
  sourceSample: { default: 12, max: 25 },
  /** Matches and near-misses in `preview_focus`. */
  focusSample: { default: 10, max: 25 },
  /** Titles listed per section in `preview_edition`. */
  editionSectionSample: { default: 6, max: 15 },
  /** Feed URLs probed in one `inspect_feed` call. */
  feedProbe: { default: 5, max: 5 },
  /** Recent item titles returned per probed feed. */
  feedProbeItems: 8,
  /** Catalog entries per `browse_catalog` call. */
  catalog: { default: 15, max: 40 },
  /** Sources and focuses listed by `get_workspace`. */
  workspaceSources: 200,
  workspaceIssues: 3,
  /** Sources created in one `add_sources` call. */
  addSources: 20,
  /**
   * Votes cast in one `vote_articles` call. Generous because curating a focus
   * is inherently a bulk act — one call per vote would be a dozen round trips
   * for a single curation pass.
   */
  voteBatch: 50,
} as const;

// --- Helpers ---

/**
 * Bounds a caller-supplied count. Tool schemas already declare `.max()`, so
 * this is the second line of defence for values that arrive from elsewhere and
 * the single place a default is applied.
 */
const clamp = (value: number | undefined, { default: fallback, max }: { default: number; max: number }): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(value)));
};

/**
 * Cuts text to `maxChars`, marking the cut so the caller can tell a short field
 * from a shortened one and knows a fuller version exists.
 */
const truncate = (text: string | null | undefined, maxChars: number): string | null => {
  if (text === null || text === undefined) {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}… [truncated, ${trimmed.length} chars total]`;
};

/** Caps an in-memory list whose full length is already known. */
const capList = <T>(items: T[], max: number): Capped<T> => ({
  items: items.slice(0, max),
  shown: Math.min(items.length, max),
  total: items.length,
  truncated: items.length > max,
});

/**
 * Wraps rows that were already limited in SQL, where `total` came from a
 * separate `COUNT`. Prefer this over `capList` for anything that could be
 * large — capping after loading 40,000 rows defeats the point.
 */
const capped = <T>(items: T[], total: number): Capped<T> => ({
  items,
  shown: items.length,
  total,
  truncated: total > items.length,
});

export type { Capped };
export { LIMITS, TARGET_RESPONSE_TOKENS, clamp, truncate, capList, capped };
