import { sql } from "kysely";

import type { Kysely } from "kysely";

const up = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema
    .createTable("article_votes")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("article_id", "text", (col) =>
      col.notNull().references("articles.id").onDelete("cascade"),
    )
    .addColumn("focus_id", "text", (col) =>
      col.references("focuses.id").onDelete("cascade"),
    )
    .addColumn("value", "integer", (col) => col.notNull()) // -1 or 1
    .addColumn("created_at", "text", (col) =>
      col.notNull().defaultTo(sql`(datetime('now'))`),
    )
    .execute();

  // Partial unique indexes — SQLite treats NULLs as distinct in regular UNIQUE constraints
  await sql`
    CREATE UNIQUE INDEX idx_article_votes_global
      ON article_votes(user_id, article_id)
      WHERE focus_id IS NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX idx_article_votes_focus
      ON article_votes(user_id, article_id, focus_id)
      WHERE focus_id IS NOT NULL
  `.execute(db);

  await db.schema
    .createIndex("idx_article_votes_user_id")
    .on("article_votes")
    .column("user_id")
    .execute();
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  await db.schema.dropTable("article_votes").ifExists().execute();
};

export { up, down };
