import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('focus_sources').addColumn('min_confidence', 'real').execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('focus_sources').dropColumn('min_confidence').execute();
};

export { up, down };
