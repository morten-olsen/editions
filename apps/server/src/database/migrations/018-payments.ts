import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const addColumnIfNotExists = async (db: Kysely<unknown>, table: string, column: string, type: string): Promise<void> => {
  const rows = await sql<{ name: string }>`PRAGMA table_info(${sql.ref(table)})`.execute(db);
  const exists = rows.rows.some((r) => r.name === column);
  if (!exists) {
    await sql`ALTER TABLE ${sql.ref(table)} ADD COLUMN ${sql.ref(column)} ${sql.raw(type)}`.execute(db);
  }
};

const up = async (db: Kysely<unknown>): Promise<void> => {
  await addColumnIfNotExists(db, 'users', 'access_expires_at', 'text');
  await addColumnIfNotExists(db, 'users', 'stripe_customer_id', 'text');

  await db.schema
    .createTable('subscriptions')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('stripe_subscription_id', 'text', (col) => col.notNull().unique())
    .addColumn('stripe_price_id', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('interval', 'text', (col) => col.notNull())
    .addColumn('current_period_start', 'text', (col) => col.notNull())
    .addColumn('current_period_end', 'text', (col) => col.notNull())
    .addColumn('cancel_at_period_end', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  // Create index only if it doesn't exist (use raw SQL since Kysely createIndex has no ifNotExists)
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`.execute(db);

  await db.schema
    .createTable('settings')
    .ifNotExists()
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable('settings').execute();
  await db.schema.dropTable('subscriptions').execute();
  await db.schema.alterTable('users').dropColumn('stripe_customer_id').execute();
  await db.schema.alterTable('users').dropColumn('access_expires_at').execute();
};

export { up, down };
