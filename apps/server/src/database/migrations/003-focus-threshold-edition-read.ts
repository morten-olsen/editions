import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  // Add min_confidence to focuses — 0.0 means no threshold (include all)
  await db.schema
    .alterTable('focuses')
    .addColumn('min_confidence', 'real', (col) => col.notNull().defaultTo(0))
    .execute();

  // Add read_at to editions — null means unread
  await db.schema.alterTable('editions').addColumn('read_at', 'text').execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  // SQLite doesn't support DROP COLUMN before 3.35.0 — recreate tables
  // For simplicity, use ALTER TABLE DROP COLUMN (SQLite 3.35.0+, 2021)
  await sql`ALTER TABLE focuses DROP COLUMN min_confidence`.execute(db);
  await sql`ALTER TABLE editions DROP COLUMN read_at`.execute(db);
};

export { up, down };
