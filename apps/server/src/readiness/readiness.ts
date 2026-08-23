import { sql } from 'kysely';
import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import { JobService } from '../jobs/jobs.ts';
import type { Services } from '../services/services.ts';

// --- Types ---

/**
 * Narrows readiness to the part of the pipeline a caller actually depends on.
 * An empty scope means "everything this user owns".
 */
type ReadinessScope = {
  sourceIds?: string[];
  focusIds?: string[];
};

type PendingSource = {
  sourceId: string;
  name: string;
  pendingArticles: number;
};

type Readiness = {
  /**
   * - `ready` — everything in scope is analysed and nothing is in flight.
   *   Previews and counts can be trusted.
   * - `analysing` — work is in flight, so counts are provisional and will grow.
   * - `stalled` — articles remain unanalysed but no job is running, so nothing
   *   will change on its own.
   *
   * The `stalled` case is not hypothetical: extraction fails permanently for
   * some URLs (dead links, blocked scrapers), the job completes, and those
   * articles stay unanalysed forever. Reporting that as `analysing` would make
   * any wait loop run until its budget expired, every time. It is a distinct
   * state because the response differs — waiting helps with `analysing` and
   * never helps with `stalled`.
   */
  state: 'ready' | 'analysing' | 'stalled';
  /** Articles in scope that have completed the pipeline. */
  analysed: number;
  /** Articles in scope still waiting to be extracted, embedded or classified. */
  pending: number;
  /** Articles awaiting scoring against a focus in scope, once already analysed. */
  pendingClassification: number;
  /** Background jobs currently queued or running that touch this scope. */
  activeJobs: number;
  /** Which sources the outstanding work belongs to, worst first. */
  pendingSources: PendingSource[];
};

type ReadinessRequest = {
  userId: string;
  scope?: ReadinessScope;
};

type WaitRequest = ReadinessRequest & {
  timeoutMs: number;
};

// --- Constants ---

const POLL_INTERVAL_MS = 500;
const MAX_PENDING_SOURCES = 10;

// --- Scope resolution ---

/**
 * The set of source ids readiness should be measured over. `null` means
 * "unrestricted" — all of the user's sources — which is not the same as `[]`,
 * which means "a scope was requested and it resolved to nothing".
 */
const resolveScopedSourceIds = async (
  db: Kysely<DatabaseSchema>,
  scope: ReadinessScope | undefined,
): Promise<string[] | null> => {
  const hasSourceScope = scope?.sourceIds !== undefined && scope.sourceIds.length > 0;
  const hasFocusScope = scope?.focusIds !== undefined && scope.focusIds.length > 0;

  if (!hasSourceScope && !hasFocusScope) {
    return null;
  }

  const ids = new Set<string>(scope?.sourceIds ?? []);

  if (hasFocusScope) {
    const links = await db
      .selectFrom('focus_sources')
      .select('source_id')
      .where('focus_id', 'in', scope?.focusIds ?? [])
      .execute();
    for (const link of links) {
      ids.add(link.source_id);
    }
  }

  return [...ids];
};

// --- Counting ---

type ArticleCounts = {
  analysed: number;
  pending: number;
  pendingSources: PendingSource[];
};

const countArticles = async (
  db: Kysely<DatabaseSchema>,
  userId: string,
  scopedSourceIds: string[] | null,
): Promise<ArticleCounts> => {
  if (scopedSourceIds !== null && scopedSourceIds.length === 0) {
    return { analysed: 0, pending: 0, pendingSources: [] };
  }

  let totals = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .where('sources.user_id', '=', userId);

  if (scopedSourceIds !== null) {
    totals = totals.where('articles.source_id', 'in', scopedSourceIds);
  }

  const row = await totals
    .select([
      sql<number>`COUNT(CASE WHEN articles.analysed_at IS NOT NULL THEN 1 END)`.as('analysed'),
      sql<number>`COUNT(CASE WHEN articles.analysed_at IS NULL THEN 1 END)`.as('pending'),
    ])
    .executeTakeFirstOrThrow();

  let perSource = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .where('sources.user_id', '=', userId)
    .where('articles.analysed_at', 'is', null);

  if (scopedSourceIds !== null) {
    perSource = perSource.where('articles.source_id', 'in', scopedSourceIds);
  }

  const pendingRows = await perSource
    .select(['sources.id as source_id', 'sources.name', db.fn.countAll().as('pending')])
    .groupBy(['sources.id', 'sources.name'])
    .orderBy('pending', 'desc')
    .limit(MAX_PENDING_SOURCES)
    .execute();

  return {
    analysed: Number(row.analysed),
    pending: Number(row.pending),
    pendingSources: pendingRows.map((r) => ({
      sourceId: r.source_id,
      name: r.name,
      pendingArticles: Number(r.pending),
    })),
  };
};

/**
 * Articles that finished the pipeline but have no score against a focus in
 * scope yet. This is the signal that a freshly created or renamed focus is
 * still being reconciled — the article-level counts alone look clean, because
 * those articles were analysed long ago.
 */
const countPendingClassification = async (
  db: Kysely<DatabaseSchema>,
  userId: string,
  focusIds: string[],
): Promise<number> => {
  if (focusIds.length === 0) {
    return 0;
  }

  const row = await db
    .selectFrom('focuses')
    .innerJoin('focus_sources', 'focus_sources.focus_id', 'focuses.id')
    .innerJoin('articles', 'articles.source_id', 'focus_sources.source_id')
    .where('focuses.id', 'in', focusIds)
    .where('focuses.user_id', '=', userId)
    .where('articles.analysed_at', 'is not', null)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('article_focuses')
            .select('article_focuses.article_id')
            .whereRef('article_focuses.article_id', '=', 'articles.id')
            .whereRef('article_focuses.focus_id', '=', 'focuses.id'),
        ),
      ),
    )
    .select(db.fn.countAll().as('count'))
    .executeTakeFirstOrThrow();

  return Number(row.count);
};

/**
 * A job counts against a scope when it declares an overlapping source or focus,
 * or when it declares nothing at all — an unscoped job (`reanalyse_all`) can
 * touch anything, so it has to be treated as touching this scope too.
 */
const countActiveJobs = (services: Services, userId: string, scope: ReadinessScope | undefined): number => {
  const active = services.get(JobService).listByUser(userId, { active: true });

  const sourceIds = new Set(scope?.sourceIds ?? []);
  const focusIds = new Set(scope?.focusIds ?? []);
  if (sourceIds.size === 0 && focusIds.size === 0) {
    return active.length;
  }

  return active.filter((job) => {
    if (job.affects.sourceIds.length === 0 && job.affects.focusIds.length === 0) {
      return true;
    }
    return job.affects.sourceIds.some((id) => sourceIds.has(id)) || job.affects.focusIds.some((id) => focusIds.has(id));
  }).length;
};

// --- Service ---

/**
 * Answers "can the agent trust what it is about to read?".
 *
 * Analysis is asynchronous, so every count, preview and match list in the app
 * is provisional until the pipeline settles. This module is the single place
 * that decides what "settled" means, so callers never have to reason about job
 * types, extraction state or classification coverage.
 *
 * It deliberately combines two signals. The database knows which articles are
 * unanalysed, but a source that is still being *fetched* has no articles yet
 * and so looks trivially ready; only the job queue knows about that. Neither
 * signal alone is sufficient.
 */
class ReadinessService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  get = async ({ userId, scope }: ReadinessRequest): Promise<Readiness> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const scopedSourceIds = await resolveScopedSourceIds(db, scope);

    const [counts, pendingClassification] = await Promise.all([
      countArticles(db, userId, scopedSourceIds),
      countPendingClassification(db, userId, scope?.focusIds ?? []),
    ]);

    const activeJobs = countActiveJobs(this.#services, userId, scope);
    const pending = counts.pending + pendingClassification;

    return {
      state: activeJobs > 0 ? 'analysing' : pending > 0 ? 'stalled' : 'ready',
      analysed: counts.analysed,
      pending,
      pendingClassification,
      activeJobs,
      pendingSources: counts.pendingSources,
    };
  };

  /**
   * Polls while work is in flight, until `timeoutMs` elapses.
   *
   * Returns as soon as the state is anything but `analysing` — including
   * `stalled`, where articles remain unanalysed with no job to finish them.
   * Waiting on a stalled scope can only ever burn the whole budget.
   *
   * Always resolves rather than throwing on timeout: a caller that ran out of
   * budget still needs to report on what is outstanding, and running out is an
   * expected outcome, not an error.
   */
  waitUntilReady = async ({ userId, scope, timeoutMs }: WaitRequest): Promise<Readiness> => {
    const deadline = Date.now() + timeoutMs;

    let readiness = await this.get({ userId, scope });
    while (readiness.state === 'analysing' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      readiness = await this.get({ userId, scope });
    }

    return readiness;
  };
}

export type { Readiness, ReadinessScope, PendingSource };
export { ReadinessService };
