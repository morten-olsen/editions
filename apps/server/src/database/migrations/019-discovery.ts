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
  // Add origin_id to focuses — links to the discovery template this was adopted from
  await addColumnIfNotExists(db, 'focuses', 'origin_id', 'text');
  await sql`CREATE INDEX IF NOT EXISTS idx_focuses_origin ON focuses(user_id, origin_id)`.execute(db);

  // Add origin_id to edition_configs — same concept
  await addColumnIfNotExists(db, 'edition_configs', 'origin_id', 'text');
  await sql`CREATE INDEX IF NOT EXISTS idx_edition_configs_origin ON edition_configs(user_id, origin_id)`.execute(db);
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`DROP INDEX IF EXISTS idx_edition_configs_origin`.execute(db);
  await db.schema.alterTable('edition_configs').dropColumn('origin_id').execute();
  await sql`DROP INDEX IF EXISTS idx_focuses_origin`.execute(db);
  await db.schema.alterTable('focuses').dropColumn('origin_id').execute();
};

export { up, down };
