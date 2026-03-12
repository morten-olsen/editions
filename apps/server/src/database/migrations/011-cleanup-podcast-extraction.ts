import { sql } from 'kysely';
import type { Kysely } from 'kysely';

/**
 * Clean up podcast articles that were incorrectly run through HTML extraction.
 * Resets their content to null (the feed summary is in the summary column)
 * and clears extracted_at/analysed_at so they get re-analysed using the summary.
 */
const up = async (db: Kysely<unknown>): Promise<void> => {
  await sql`
    UPDATE articles
    SET content = NULL,
        extracted_at = datetime('now'),
        analysed_at = NULL
    WHERE source_id IN (SELECT id FROM sources WHERE type = 'podcast')
      AND content IS NOT NULL
  `.execute(db);
};

const down = async (_db: Kysely<unknown>): Promise<void> => {
  // Cannot restore extracted content — this is a data cleanup
};

export { up, down };
