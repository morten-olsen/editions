import type { Kysely } from 'kysely';

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable('edition_config_focuses')
    .addColumn('weight', 'real', (col) => col.notNull().defaultTo(1.0))
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('edition_config_focuses').dropColumn('weight').execute();
};

export { up, down };
