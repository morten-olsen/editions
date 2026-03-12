import type { Kysely } from 'kysely';

import type { DatabaseSchema, FocusSourceMode } from '../database/database.types.ts';

import type { EmbedFn, ReconcileStep, ScopeFilter } from './analysis.reconcile.ts';
import { dotProduct, upsertSimilarity } from './analysis.reconcile.ts';

// --- Types ---

type SimilarityItem = {
  articleId: string;
  focusId: string;
  mode: FocusSourceMode;
  focusLabel: string;
  embedding: Float32Array | null;
};

// --- Step factory ---

const createSimilarityStep = (params: {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<SimilarityItem> => {
  const { db, embedFn, scopeFilter, batchSize = 100 } = params;
  const focusEmbeddingCache = new Map<string, Float32Array>();

  return {
    name: 'similarity',
    fetchBatch: async function* (): AsyncGenerator<SimilarityItem[]> {
      // Find all (article, focus) pairs that need similarity scores
      // This includes "always" mode pairs (similarity = 1.0) and "match" mode pairs
      const offset = 0;
      while (true) {
        let q = db
          .selectFrom('focus_sources')
          .innerJoin('articles', 'articles.source_id', 'focus_sources.source_id')
          .innerJoin('focuses', 'focuses.id', 'focus_sources.focus_id')
          .leftJoin('article_focuses', (join) =>
            join
              .onRef('article_focuses.article_id', '=', 'articles.id')
              .onRef('article_focuses.focus_id', '=', 'focus_sources.focus_id'),
          )
          .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
          .select([
            'articles.id as article_id',
            'focus_sources.focus_id',
            'focus_sources.mode',
            'focuses.name',
            'focuses.description',
            'article_embeddings.embedding',
          ])
          .where('articles.extracted_at', 'is not', null)
          .where('article_focuses.similarity', 'is', null)
          .limit(batchSize)
          .offset(offset);

        if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
          q = q.where('focus_sources.focus_id', 'in', scopeFilter.focusIds);
        }
        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where('focus_sources.source_id', 'in', scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) {
          break;
        }

        const items: SimilarityItem[] = rows.map((row) => {
          const embeddingBuf = row.embedding as Buffer | null;
          return {
            articleId: row.article_id,
            focusId: row.focus_id,
            mode: row.mode as FocusSourceMode,
            focusLabel: row.description ? `${row.name}: ${row.description}` : row.name,
            embedding: embeddingBuf
              ? new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)
              : null,
          };
        });

        yield items;
        // Don't increment offset because processed items won't match the WHERE clause next time
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: SimilarityItem[]): Promise<void> => {
      for (const item of batch) {
        if (item.mode === 'always') {
          await upsertSimilarity(db, item.articleId, item.focusId, 1.0);
          continue;
        }

        // "match" mode: compute cosine similarity
        if (!item.embedding) {
          continue;
        }

        let focusEmbedding = focusEmbeddingCache.get(item.focusLabel);
        if (!focusEmbedding) {
          focusEmbedding = await embedFn(item.focusLabel);
          focusEmbeddingCache.set(item.focusLabel, focusEmbedding);
        }

        const sim = dotProduct(item.embedding, focusEmbedding);
        await upsertSimilarity(db, item.articleId, item.focusId, sim);
      }
    },
  };
};

// --- Exports ---

export { createSimilarityStep };
