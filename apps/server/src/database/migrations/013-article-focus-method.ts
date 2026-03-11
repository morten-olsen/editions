import type { Kysely } from "kysely";

// Tracks which classifier strategy produced each article–focus assignment.
// null for rows created before this migration (implicitly NLI or 'always').
// Values: 'always', 'nli', 'similarity'

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("article_focuses")
    .addColumn("method", "text")
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .alterTable("article_focuses")
    .dropColumn("method")
    .execute();
};

export { up, down };
