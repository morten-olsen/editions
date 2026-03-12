import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .createTable('bookmarks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id'))
    .addColumn('article_id', 'text', (col) => col.notNull().references('articles.id'))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addUniqueConstraint('bookmarks_user_article', ['user_id', 'article_id'])
    .execute();

  await db.schema
    .createIndex('idx_bookmarks_user_created')
    .on('bookmarks')
    .columns(['user_id', 'created_at'])
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable('bookmarks').execute();
};

export { up, down };
