import { sql, type Kysely } from "kysely";

const up = async (db: Kysely<unknown>): Promise<void> => {
  // --- articles: rename reading_time_seconds → consumption_time_seconds ---
  await db.schema
    .alterTable("articles")
    .addColumn("consumption_time_seconds", "integer")
    .execute();
  await sql`UPDATE articles SET consumption_time_seconds = reading_time_seconds`.execute(db);
  await db.schema.alterTable("articles").dropColumn("reading_time_seconds").execute();

  // --- articles: rename read_progress → progress ---
  await db.schema
    .alterTable("articles")
    .addColumn("progress", "real", (col) => col.notNull().defaultTo(0))
    .execute();
  await sql`UPDATE articles SET progress = read_progress`.execute(db);
  await db.schema.alterTable("articles").dropColumn("read_progress").execute();

  // --- articles: drop word_count ---
  await db.schema.alterTable("articles").dropColumn("word_count").execute();

  // --- articles: add media columns ---
  await db.schema
    .alterTable("articles")
    .addColumn("media_url", "text")
    .execute();
  await db.schema
    .alterTable("articles")
    .addColumn("media_type", "text")
    .execute();

  // --- sources: add direction ---
  await db.schema
    .alterTable("sources")
    .addColumn("direction", "text", (col) => col.notNull().defaultTo("newest"))
    .execute();

  // --- focuses: rename reading time filter columns ---
  await db.schema
    .alterTable("focuses")
    .addColumn("min_consumption_time_seconds", "integer")
    .execute();
  await sql`UPDATE focuses SET min_consumption_time_seconds = min_reading_time_seconds`.execute(db);
  await db.schema.alterTable("focuses").dropColumn("min_reading_time_seconds").execute();

  await db.schema
    .alterTable("focuses")
    .addColumn("max_consumption_time_seconds", "integer")
    .execute();
  await sql`UPDATE focuses SET max_consumption_time_seconds = max_reading_time_seconds`.execute(db);
  await db.schema.alterTable("focuses").dropColumn("max_reading_time_seconds").execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  // --- focuses: restore reading time columns ---
  await db.schema
    .alterTable("focuses")
    .addColumn("max_reading_time_seconds", "integer")
    .execute();
  await sql`UPDATE focuses SET max_reading_time_seconds = max_consumption_time_seconds`.execute(db);
  await db.schema.alterTable("focuses").dropColumn("max_consumption_time_seconds").execute();

  await db.schema
    .alterTable("focuses")
    .addColumn("min_reading_time_seconds", "integer")
    .execute();
  await sql`UPDATE focuses SET min_reading_time_seconds = min_consumption_time_seconds`.execute(db);
  await db.schema.alterTable("focuses").dropColumn("min_consumption_time_seconds").execute();

  // --- sources: drop direction ---
  await db.schema.alterTable("sources").dropColumn("direction").execute();

  // --- articles: drop media columns ---
  await db.schema.alterTable("articles").dropColumn("media_type").execute();
  await db.schema.alterTable("articles").dropColumn("media_url").execute();

  // --- articles: restore word_count ---
  await db.schema
    .alterTable("articles")
    .addColumn("word_count", "integer")
    .execute();

  // --- articles: restore read_progress ---
  await db.schema
    .alterTable("articles")
    .addColumn("read_progress", "real", (col) => col.notNull().defaultTo(0))
    .execute();
  await sql`UPDATE articles SET read_progress = progress`.execute(db);
  await db.schema.alterTable("articles").dropColumn("progress").execute();

  // --- articles: restore reading_time_seconds ---
  await db.schema
    .alterTable("articles")
    .addColumn("reading_time_seconds", "integer")
    .execute();
  await sql`UPDATE articles SET reading_time_seconds = consumption_time_seconds`.execute(db);
  await db.schema.alterTable("articles").dropColumn("consumption_time_seconds").execute();
};

export { up, down };
