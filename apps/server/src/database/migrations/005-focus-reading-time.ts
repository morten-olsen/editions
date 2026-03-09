import type { Kysely } from "kysely";

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("focuses")
    .addColumn("min_reading_time_seconds", "integer")
    .execute();

  await db.schema
    .alterTable("focuses")
    .addColumn("max_reading_time_seconds", "integer")
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("focuses")
    .dropColumn("min_reading_time_seconds")
    .execute();

  await db.schema
    .alterTable("focuses")
    .dropColumn("max_reading_time_seconds")
    .execute();
};

export { up, down };
