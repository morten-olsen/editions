import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';

// --- Step factory ---

const createMarkAnalysedStep = (params: {
  db: Kysely<DatabaseSchema>;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<{ id: string }> => {
  const { db, scopeFilter, batchSize = 100 } = params;

  return {
    name: 'mark_analysed',
    fetchBatch: async function* (): AsyncGenerator<{ id: string }[]> {
      while (true) {
        let q = db
          .selectFrom('articles')
          .select('articles.id')
          .where('articles.extracted_at', 'is not', null)
          .where('articles.analysed_at', 'is', null)
          .limit(batchSize);

        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) {
          break;
        }
        yield rows.map((r) => ({ id: r.id }));
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: { id: string }[]): Promise<void> => {
      const ids = batch.map((b) => b.id);
      await db.updateTable('articles').set({ analysed_at: new Date().toISOString() }).where('id', 'in', ids).execute();
    },
  };
};

// --- Exports ---

export { createMarkAnalysedStep };
