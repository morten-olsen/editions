import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';
import { toPage } from '../pagination/pagination.ts';
import type { Page, PageOptions } from '../pagination/pagination.ts';

type UserRow = {
  id: string;
  username: string;
  role: string;
  access_expires_at: string | null;
};

type SubscriptionRow = {
  status: string;
  interval: string;
  current_period_end: string;
  cancel_at_period_end: number;
};

/**
 * Combines a user row with its subscription into the admin view. Owned by
 * BillingService (it needs the access-status rule), passed in here so the
 * paging query doesn't have to reimplement it.
 */
type FormatUserAccessFn<T = unknown> = (user: UserRow, subscription: SubscriptionRow | undefined) => T;

const DEFAULT_ADMIN_USERS_LIMIT = 50;

/**
 * One page of users with their access state. Subscriptions are loaded for the
 * page's users only, so the query cost doesn't grow with the whole user table.
 */
const listUsersPage = async <T>(
  db: Kysely<DatabaseSchema>,
  formatUserAccess: FormatUserAccessFn<T>,
  { offset = 0, limit = DEFAULT_ADMIN_USERS_LIMIT }: PageOptions = {},
): Promise<Page<T>> => {
  const countResult = await db.selectFrom('users').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();

  const users = await db
    .selectFrom('users')
    .select(['id', 'username', 'role', 'access_expires_at'])
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit)
    .execute();

  const subs =
    users.length > 0
      ? await db
          .selectFrom('subscriptions')
          .selectAll()
          .where(
            'user_id',
            'in',
            users.map((u) => u.id),
          )
          .execute()
      : [];

  const subsByUser = new Map(subs.map((s) => [s.user_id, s]));

  return toPage({
    items: users.map((u) => formatUserAccess(u, subsByUser.get(u.id))),
    total: countResult.count,
    offset,
    limit,
  });
};

export type { FormatUserAccessFn };
export { listUsersPage, DEFAULT_ADMIN_USERS_LIMIT };
