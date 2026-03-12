import type { Kysely } from 'kysely';

// Adds per-focus override for excludePriorEditions.
// null  = inherit from the edition config
// 1     = always exclude prior articles for this focus
// 0     = never exclude prior articles for this focus

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('edition_config_focuses').addColumn('exclude_prior_editions', 'integer').execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.alterTable('edition_config_focuses').dropColumn('exclude_prior_editions').execute();
};

export { up, down };
