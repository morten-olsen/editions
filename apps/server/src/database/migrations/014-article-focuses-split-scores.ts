import type { Kysely } from 'kysely';

// Replace article_focuses.confidence + method with split similarity + nli columns.
// Drop and recreate the table since SQLite can't drop columns easily.
// Clears analysed_at on all articles to force re-analysis with the new schema.

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable('article_focuses').execute();

  await db.schema
    .createTable('article_focuses')
    .addColumn('article_id', 'text', (col) => col.notNull().references('articles.id').onDelete('cascade'))
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('similarity', 'real')
    .addColumn('nli', 'real')
    .addColumn('assigned_at', 'text', (col) => col.notNull().defaultTo("datetime('now')"))
    .addUniqueConstraint('article_focuses_unique', ['article_id', 'focus_id'])
    .execute();

  await db.schema.createIndex('idx_article_focuses_focus_id').on('article_focuses').column('focus_id').execute();

  // Force re-analysis of all articles
  await db
    .updateTable('articles' as never)
    .set({ analysed_at: null } as never)
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable('article_focuses').execute();

  await db.schema
    .createTable('article_focuses')
    .addColumn('article_id', 'text', (col) => col.notNull().references('articles.id').onDelete('cascade'))
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('confidence', 'real', (col) => col.notNull())
    .addColumn('method', 'text')
    .addColumn('assigned_at', 'text', (col) => col.notNull().defaultTo("datetime('now')"))
    .addUniqueConstraint('article_focuses_unique', ['article_id', 'focus_id'])
    .execute();

  await db.schema.createIndex('idx_article_focuses_focus_id').on('article_focuses').column('focus_id').execute();
};

export { up, down };
