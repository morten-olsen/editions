import type { Kysely, SelectQueryBuilder } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';
import { toPage } from '../pagination/pagination.ts';
import type { Page, PageOptions } from '../pagination/pagination.ts';

import { mapEditionRow } from './editions.queries.ts';
import type { Edition, EditionSummary } from './editions.queries.ts';

// --- Types ---

/**
 * Selects issues of one edition config for a bulk action.
 *
 * `keepLatest` is a *guard*, not a selector: it protects the N most recently
 * published issues in the config whether or not they match the rest of the
 * filter. "Delete read issues, always keep the 5 newest" is expressible, and no
 * sweep can empty a config that has `keepLatest` set.
 */
type IssueSweepFilter = {
  /** `true` = only read issues, `false` = only unread, omitted = both. */
  read?: boolean;
  /** Only issues published strictly before this ISO timestamp. */
  publishedBefore?: string;
  /** Never touch the N most recent issues in the config. */
  keepLatest?: number;
};

type IssueSweepAction = 'delete' | 'mark-read' | 'mark-unread';

/** Number of issues the sweep matched — the same count preview reports. */
type IssueSweepResult = {
  affected: number;
};

type ListIssuesOptions = PageOptions & {
  read?: boolean;
};

type IssuesPage = Page<EditionSummary>;

type Db = Kysely<DatabaseSchema>;

/** A `select editions.id` builder — what every sweep statement filters on. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kysely infers a distinct shape per join/select
type IssueIdQuery = SelectQueryBuilder<any, any, any>;

const DEFAULT_ISSUES_PAGE_SIZE = 20;

// --- Query building ---

const ISSUE_COLUMNS = [
  'editions.id',
  'editions.edition_config_id',
  'editions.title',
  'editions.total_reading_minutes',
  'editions.article_count',
  'editions.current_position',
  'editions.read_at',
  'editions.published_at',
  'editions.created_at',
] as const;

type IssueScope = {
  userId: string;
  configId: string;
};

type IssueRow = Parameters<typeof mapEditionRow>[0] & { config_name: string };

/**
 * Every issue of one config, ownership enforced. The single place the
 * user_id join lives — list, count and sweep all build on it.
 */
const scopedIssues = (db: Db, { userId, configId }: IssueScope): IssueIdQuery =>
  db
    .selectFrom('editions')
    .innerJoin('edition_configs', 'edition_configs.id', 'editions.edition_config_id')
    .where('editions.edition_config_id', '=', configId)
    .where('edition_configs.user_id', '=', userId);

/**
 * The ids a sweep applies to, as a subquery rather than a materialised array —
 * so preview, delete and read-status all run the *same* selection, and a config
 * with thousands of issues never runs into SQLite's bound-parameter limit.
 */
const matchingIssueIds = (db: Db, scope: IssueScope, filter: IssueSweepFilter): IssueIdQuery => {
  let query = scopedIssues(db, scope).select('editions.id');

  if (filter.read === true) {
    query = query.where('editions.read_at', 'is not', null);
  } else if (filter.read === false) {
    query = query.where('editions.read_at', 'is', null);
  }

  if (filter.publishedBefore !== undefined) {
    query = query.where('editions.published_at', '<', filter.publishedBefore);
  }

  if (filter.keepLatest !== undefined && filter.keepLatest > 0) {
    const protectedIds = db
      .selectFrom('editions')
      .select('editions.id')
      .where('editions.edition_config_id', '=', scope.configId)
      .orderBy('editions.published_at', 'desc')
      .limit(filter.keepLatest);
    query = query.where('editions.id', 'not in', protectedIds);
  }

  return query;
};

// --- Reads ---

const listIssues = async (
  db: Db,
  scope: IssueScope,
  { read, offset = 0, limit = DEFAULT_ISSUES_PAGE_SIZE }: ListIssuesOptions = {},
): Promise<IssuesPage> => {
  const filtered = (): IssueIdQuery => {
    let query = scopedIssues(db, scope);
    if (read === true) {
      query = query.where('editions.read_at', 'is not', null);
    } else if (read === false) {
      query = query.where('editions.read_at', 'is', null);
    }
    return query;
  };

  const countResult = await filtered().select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();

  // The scoped builder is intentionally loosely typed (see IssueIdQuery), so the
  // row shape is asserted here rather than inferred.
  const rows = (await filtered()
    .select([...ISSUE_COLUMNS, 'edition_configs.name as config_name'])
    .orderBy('editions.published_at', 'desc')
    .offset(offset)
    .limit(limit)
    .execute()) as IssueRow[];

  return toPage({
    items: rows.map(
      (row): EditionSummary => ({
        ...mapEditionRow(row),
        configName: row.config_name,
      }),
    ),
    total: countResult.count as number,
    offset,
    limit,
  });
};

const countMatchingIssues = async (db: Db, scope: IssueScope, filter: IssueSweepFilter): Promise<IssueSweepResult> => {
  const result = await db
    .selectFrom('editions')
    .select(db.fn.countAll().as('count'))
    .where('editions.id', 'in', matchingIssueIds(db, scope, filter))
    .executeTakeFirstOrThrow();

  return { affected: Number(result.count) };
};

// --- Writes ---

/**
 * Article read state is monotonic: reading an issue marks its unread articles
 * read and leaves the rest alone (so an article read weeks ago keeps its
 * original timestamp), while un-reading an issue only clears the issue's own
 * flag. Marking read is therefore not reversible on the article — which is the
 * point: the article *was* read, and no other issue containing it should be
 * silently reset. See docs/database.md.
 */
const applyIssueReadStatus = async (db: Db, ids: IssueIdQuery, read: boolean): Promise<number> => {
  const readAt = read ? new Date().toISOString() : null;

  const result = await db.updateTable('editions').set({ read_at: readAt }).where('id', 'in', ids).execute();

  if (read) {
    const articleIds = db.selectFrom('edition_articles').select('article_id').where('edition_id', 'in', ids);

    await db
      .updateTable('articles')
      .set({ read_at: readAt })
      .where('read_at', 'is', null)
      .where('id', 'in', articleIds)
      .execute();
  }

  return Number(result[0]?.numUpdatedRows ?? 0);
};

const deleteIssues = async (db: Db, ids: IssueIdQuery): Promise<number> => {
  // edition_articles cascades on editions.id (migration 001).
  const result = await db.deleteFrom('editions').where('id', 'in', ids).execute();
  return Number(result[0]?.numDeletedRows ?? 0);
};

const runIssueSweep = async (
  db: Db,
  scope: IssueScope,
  { filter, action }: { filter: IssueSweepFilter; action: IssueSweepAction },
): Promise<IssueSweepResult> => {
  const ids = matchingIssueIds(db, scope, filter);

  if (action === 'delete') {
    return { affected: await deleteIssues(db, ids) };
  }

  return { affected: await applyIssueReadStatus(db, ids, action === 'mark-read') };
};

/** Single-issue delete, sharing the sweep's statement so there is one delete path. */
const singleIssueId = (db: Db, editionId: string): IssueIdQuery =>
  db.selectFrom('editions').select('editions.id').where('editions.id', '=', editionId);

const deleteIssueById = async (db: Db, editionId: string): Promise<void> => {
  await deleteIssues(db, singleIssueId(db, editionId));
};

/** Single-issue read toggle, sharing the sweep's monotonic read rule. */
const setIssueReadStatusById = async (db: Db, editionId: string, read: boolean): Promise<string | null> => {
  await applyIssueReadStatus(db, singleIssueId(db, editionId), read);

  const row = await db.selectFrom('editions').select('read_at').where('id', '=', editionId).executeTakeFirstOrThrow();

  return row.read_at;
};

export type { Edition, IssueSweepAction, IssueSweepFilter, IssueSweepResult, IssuesPage, ListIssuesOptions };
export {
  DEFAULT_ISSUES_PAGE_SIZE,
  countMatchingIssues,
  deleteIssueById,
  listIssues,
  runIssueSweep,
  setIssueReadStatusById,
};
