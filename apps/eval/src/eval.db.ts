import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { FileMigrationProvider, Kysely, Migrator, SqliteDialect } from 'kysely';

import type { DatabaseSchema } from '@editions/server/src/database/database.types.ts';
import type { FeedFixture, LabelSet } from './eval.ts';

// --- DB setup ---

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/src/database/migrations',
);

const createEvalDb = async (): Promise<Kysely<DatabaseSchema>> => {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: migrationsFolder }),
  });

  const { error } = await migrator.migrateToLatest();
  if (error) {
    throw error;
  }

  return db;
};

// --- Seed helpers ---

type SeedResult = {
  userId: string;
  sourceId: string;
  articleIds: string[];
  focusIds: Map<string, string>;
  focusSourceModes: Map<string, 'always' | 'match'>;
};

const seedFromFixtures = async (
  db: Kysely<DatabaseSchema>,
  fixture: FeedFixture,
  labelSet: LabelSet,
): Promise<SeedResult> => {
  const userId = crypto.randomUUID();
  const sourceId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create user
  await db
    .insertInto('users')
    .values({
      id: userId,
      username: 'eval',
      password_hash: null,
      role: 'admin',
    })
    .execute();

  // Create source
  await db
    .insertInto('sources')
    .values({
      id: sourceId,
      user_id: userId,
      type: 'rss',
      name: fixture.source.name,
      url: fixture.source.url,
      config: '{}',
      direction: 'ltr',
    })
    .execute();

  // Create focuses
  const focusIds = new Map<string, string>();
  for (const focus of labelSet.focuses) {
    const focusId = crypto.randomUUID();
    focusIds.set(focus.name, focusId);

    await db
      .insertInto('focuses')
      .values({
        id: focusId,
        user_id: userId,
        name: focus.name,
        description: focus.description,
      })
      .execute();

    // Link focus to source (all focuses use 'match' mode for eval)
    await db
      .insertInto('focus_sources')
      .values({
        focus_id: focusId,
        source_id: sourceId,
        mode: 'match',
      })
      .execute();
  }

  // Insert articles
  const articleIds: string[] = [];
  for (const article of fixture.articles) {
    await db
      .insertInto('articles')
      .values({
        id: article.id,
        source_id: sourceId,
        external_id: article.id,
        url: article.url,
        title: article.title,
        content: article.content,
        summary: article.summary,
        author: article.author,
        published_at: article.publishedAt,
        extracted_at: now,
      })
      .execute();
    articleIds.push(article.id);
  }

  return {
    userId,
    sourceId,
    articleIds,
    focusIds,
    focusSourceModes: new Map(labelSet.focuses.map((f) => [f.name, 'match' as const])),
  };
};

// --- Fixture loading ---

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

const loadFeedFixture = async (name: string): Promise<FeedFixture> => {
  const filePath = path.join(fixturesDir, 'feeds', name);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as FeedFixture;
};

const loadLabelSet = async (name: string): Promise<LabelSet> => {
  const filePath = path.join(fixturesDir, 'labels', name);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as LabelSet;
};

const listFixtures = async (): Promise<{ feeds: string[]; labels: string[] }> => {
  const feedsDir = path.join(fixturesDir, 'feeds');
  const labelsDir = path.join(fixturesDir, 'labels');

  const feeds = await fs.readdir(feedsDir).catch(() => [] as string[]);
  const labels = await fs.readdir(labelsDir).catch(() => [] as string[]);

  return {
    feeds: feeds.filter((f) => f.endsWith('.json')),
    labels: labels.filter((f) => f.endsWith('.json')),
  };
};

// --- Exports ---

export type { SeedResult };
export { createEvalDb, seedFromFixtures, loadFeedFixture, loadLabelSet, listFixtures, fixturesDir };
