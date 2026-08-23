import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .createTable('api_keys')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    // The public half of the key — enough to identify the row without revealing
    // the secret, so it can be shown in the UI and used for the lookup.
    .addColumn('key_prefix', 'text', (col) => col.notNull().unique())
    .addColumn('key_hash', 'text', (col) => col.notNull())
    .addColumn('scope', 'text', (col) => col.notNull())
    .addColumn('last_used_at', 'text')
    .addColumn('expires_at', 'text')
    .addColumn('revoked_at', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`.execute(db);
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`DROP INDEX IF EXISTS idx_api_keys_user`.execute(db);
  await db.schema.dropTable('api_keys').execute();
};

export { up, down };
