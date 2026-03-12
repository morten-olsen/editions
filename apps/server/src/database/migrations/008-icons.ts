import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('focuses').addColumn('icon', 'text').execute();

  await db.schema.alterTable('edition_configs').addColumn('icon', 'text').execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('focuses').dropColumn('icon').execute();

  await db.schema.alterTable('edition_configs').dropColumn('icon').execute();
};

export { up, down };
