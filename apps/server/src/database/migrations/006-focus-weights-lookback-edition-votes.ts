import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  // 1. Add weight to focus_sources (default 1.0)
  await db.schema
    .alterTable('focus_sources')
    .addColumn('weight', 'real', (col) => col.notNull().defaultTo(1.0))
    .execute();

  // 2. Add optional lookback_hours to edition_config_focuses (null = use edition config default)
  await db.schema.alterTable('edition_config_focuses').addColumn('lookback_hours', 'integer').execute();

  // 3. Add edition_id to article_votes (nullable)
  await db.schema
    .alterTable('article_votes')
    .addColumn('edition_id', 'text', (col) => col.references('editions.id').onDelete('cascade'))
    .execute();

  // 4. Partial unique index for edition-scoped votes
  await sql`CREATE UNIQUE INDEX idx_article_votes_edition ON article_votes(user_id, article_id, edition_id) WHERE edition_id IS NOT NULL`.execute(
    db,
  );
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await sql`DROP INDEX IF EXISTS idx_article_votes_edition`.execute(db);

  await db.schema.alterTable('article_votes').dropColumn('edition_id').execute();

  await db.schema.alterTable('edition_config_focuses').dropColumn('lookback_hours').execute();

  await db.schema.alterTable('focus_sources').dropColumn('weight').execute();
};

export { up, down };
