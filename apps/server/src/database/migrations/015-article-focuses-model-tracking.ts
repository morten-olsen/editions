import { sql } from 'kysely';
import type { Kysely } from 'kysely';

// Add model tracking columns to article_focuses so the reconciler can detect
// when scores were produced by a different model and need rescoring.

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('article_focuses').addColumn('similarity_model', 'text').execute();

  await db.schema.alterTable('article_focuses').addColumn('nli_model', 'text').execute();

  // Clear existing scores so they get recomputed with model tracking
  await sql`
    UPDATE article_focuses
    SET similarity = NULL, nli = NULL
  `.execute(db);
};

const down = async (_db: Kysely<unknown>): Promise<void> => {
  // SQLite can't drop columns — the columns are nullable so they're harmless if unused
};

export { up, down };
