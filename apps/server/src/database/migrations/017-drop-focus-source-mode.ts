import { sql, type Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  // SQLite doesn't support DROP COLUMN directly in older versions,
  // but Kysely handles the table rebuild internally
  await db.schema.alterTable('focus_sources').dropColumn('mode').execute();

  // Backfill: clear similarity scores that were rubber-stamped as 1.0
  // by the old "always" mode so they get re-scored with real embeddings
  await sql`
    UPDATE article_focuses
    SET similarity = NULL, similarity_model = NULL
    WHERE similarity = 1.0
      AND nli IS NULL
  `.execute(db);
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  // NOTE: This only restores the column. The similarity scores cleared by `up`
  // (where similarity=1.0 and nli=NULL) are not recoverable. After rollback,
  // run a full reconcile to re-score all focuses.
  await db.schema
    .alterTable('focus_sources')
    .addColumn('mode', 'text', (col) => col.notNull().defaultTo('match'))
    .execute();
};

export { up, down };
