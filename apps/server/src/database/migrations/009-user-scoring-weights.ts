import type { Kysely } from "kysely";

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("users")
    .addColumn("scoring_weights", "text")
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("users")
    .dropColumn("scoring_weights")
    .execute();
};

export { up, down };
