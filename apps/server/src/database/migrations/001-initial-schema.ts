import { sql } from 'kysely';
import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  // --- Users ---
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('password_hash', 'text') // null for OAuth-only users (future)
    .addColumn('role', 'text', (col) => col.notNull().defaultTo('user')) // admin | user
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  // --- Sources ---
  await db.schema
    .createTable('sources')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('type', 'text', (col) => col.notNull()) // rss, mastodon, bluesky, youtube, custom
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('config', 'text', (col) => col.notNull().defaultTo('{}')) // JSON, type-specific settings
    .addColumn('last_fetched_at', 'text')
    .addColumn('fetch_error', 'text') // last fetch error, null if ok
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema.createIndex('idx_sources_user_id').on('sources').column('user_id').execute();

  // --- Articles ---
  await db.schema
    .createTable('articles')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('source_id', 'text', (col) => col.notNull().references('sources.id').onDelete('cascade'))
    .addColumn('external_id', 'text', (col) => col.notNull()) // guid/url from feed for dedup
    .addColumn('url', 'text')
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('author', 'text')
    .addColumn('summary', 'text') // from feed
    .addColumn('content', 'text') // extracted full text
    .addColumn('word_count', 'integer')
    .addColumn('reading_time_seconds', 'integer')
    .addColumn('image_url', 'text') // lead image
    .addColumn('published_at', 'text')
    .addColumn('fetched_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('extracted_at', 'text') // null = not yet extracted
    .addColumn('analysed_at', 'text') // null = not yet analysed (embeddings + classification)
    .addColumn('read_at', 'text') // null = unread
    .addColumn('read_progress', 'real', (col) => col.notNull().defaultTo(0)) // 0.0–1.0
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema.createIndex('idx_articles_source_id').on('articles').column('source_id').execute();

  await db.schema
    .createIndex('idx_articles_dedup')
    .on('articles')
    .columns(['source_id', 'external_id'])
    .unique()
    .execute();

  await db.schema.createIndex('idx_articles_published_at').on('articles').column('published_at').execute();

  // --- Focuses ---
  await db.schema
    .createTable('focuses')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema.createIndex('idx_focuses_user_id').on('focuses').column('user_id').execute();

  // --- Focus ↔ Source associations ---
  await db.schema
    .createTable('focus_sources')
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('source_id', 'text', (col) => col.notNull().references('sources.id').onDelete('cascade'))
    .addColumn('mode', 'text', (col) => col.notNull()) // always | match
    .execute();

  await db.schema
    .createIndex('idx_focus_sources_pk')
    .on('focus_sources')
    .columns(['focus_id', 'source_id'])
    .unique()
    .execute();

  await db.schema.createIndex('idx_focus_sources_source_id').on('focus_sources').column('source_id').execute();

  // --- Article ↔ Focus classification ---
  await db.schema
    .createTable('article_focuses')
    .addColumn('article_id', 'text', (col) => col.notNull().references('articles.id').onDelete('cascade'))
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('confidence', 'real', (col) => col.notNull()) // 0.0–1.0
    .addColumn('assigned_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema
    .createIndex('idx_article_focuses_pk')
    .on('article_focuses')
    .columns(['article_id', 'focus_id'])
    .unique()
    .execute();

  await db.schema.createIndex('idx_article_focuses_focus_id').on('article_focuses').column('focus_id').execute();

  // --- Article embeddings (vector storage for semantic search) ---
  await db.schema
    .createTable('article_embeddings')
    .addColumn('article_id', 'text', (col) => col.primaryKey().references('articles.id').onDelete('cascade'))
    .addColumn('embedding', 'blob', (col) => col.notNull())
    .addColumn('model', 'text', (col) => col.notNull()) // model identifier, e.g. "all-MiniLM-L6-v2"
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  // --- Edition configs (rules for generating editions) ---
  await db.schema
    .createTable('edition_configs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('schedule', 'text', (col) => col.notNull()) // cron expression
    .addColumn('lookback_hours', 'integer', (col) => col.notNull()) // time window for article selection (e.g. 24, 168)
    .addColumn('exclude_prior_editions', 'integer', (col) => col.notNull().defaultTo(0)) // boolean — skip articles already in prior editions of this config
    .addColumn('enabled', 'integer', (col) => col.notNull().defaultTo(1)) // boolean
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema.createIndex('idx_edition_configs_user_id').on('edition_configs').column('user_id').execute();

  // --- Which focuses an edition config draws from ---
  await db.schema
    .createTable('edition_config_focuses')
    .addColumn('edition_config_id', 'text', (col) => col.notNull().references('edition_configs.id').onDelete('cascade'))
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull()) // user-controlled order
    .addColumn('budget_type', 'text', (col) => col.notNull()) // time | count
    .addColumn('budget_value', 'integer', (col) => col.notNull()) // minutes or article count
    .execute();

  await db.schema
    .createIndex('idx_edition_config_focuses_pk')
    .on('edition_config_focuses')
    .columns(['edition_config_id', 'focus_id'])
    .unique()
    .execute();

  // --- Per-source budget overrides within an edition config ---
  await db.schema
    .createTable('edition_config_source_budgets')
    .addColumn('edition_config_id', 'text', (col) => col.notNull().references('edition_configs.id').onDelete('cascade'))
    .addColumn('source_id', 'text', (col) => col.notNull().references('sources.id').onDelete('cascade'))
    .addColumn('max_articles', 'integer')
    .addColumn('max_reading_minutes', 'integer')
    .execute();

  await db.schema
    .createIndex('idx_edition_config_source_budgets_pk')
    .on('edition_config_source_budgets')
    .columns(['edition_config_id', 'source_id'])
    .unique()
    .execute();

  // --- Generated editions ---
  await db.schema
    .createTable('editions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('edition_config_id', 'text', (col) => col.notNull().references('edition_configs.id').onDelete('cascade'))
    .addColumn('title', 'text', (col) => col.notNull()) // e.g. "Morning Briefing — Mar 9"
    .addColumn('total_reading_minutes', 'integer')
    .addColumn('article_count', 'integer', (col) => col.notNull())
    .addColumn('current_position', 'integer', (col) => col.notNull().defaultTo(0)) // reading progress — last article position reached
    .addColumn('published_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();

  await db.schema.createIndex('idx_editions_config_id').on('editions').column('edition_config_id').execute();

  await db.schema.createIndex('idx_editions_published_at').on('editions').column('published_at').execute();

  // --- Articles selected for an edition ---
  await db.schema
    .createTable('edition_articles')
    .addColumn('edition_id', 'text', (col) => col.notNull().references('editions.id').onDelete('cascade'))
    .addColumn('article_id', 'text', (col) => col.notNull().references('articles.id').onDelete('cascade'))
    .addColumn('focus_id', 'text', (col) => col.notNull().references('focuses.id').onDelete('cascade'))
    .addColumn('position', 'integer', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_edition_articles_pk')
    .on('edition_articles')
    .columns(['edition_id', 'article_id'])
    .unique()
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  const tables = [
    'edition_articles',
    'editions',
    'edition_config_source_budgets',
    'edition_config_focuses',
    'edition_configs',
    'article_embeddings',
    'article_focuses',
    'focus_sources',
    'focuses',
    'articles',
    'sources',
    'users',
  ];

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
};

export { up, down };
