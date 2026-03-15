import { sql, type Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import type { EmbedFn } from './reconciler.embed.ts';

// --- Types ---

type SimilarityRow = {
  article_id: string;
  focus_id: string;
  name: string;
  description: string | null;
  embedding: unknown;
};

type SimilarityItem = {
  articleId: string;
  focusId: string;
  focusLabel: string;
  embedding: Float32Array | null;
};

// --- Math ---

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] as number) * (b[i] as number);
  }
  return sum;
};

// --- Persistence ---

const batchUpsertSimilarity = async (
  db: Kysely<DatabaseSchema>,
  rows: { articleId: string; focusId: string; similarity: number }[],
  model: string,
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  const values = rows.map((r) => ({
    article_id: r.articleId,
    focus_id: r.focusId,
    similarity: Math.round(r.similarity * 1000) / 1000,
    similarity_model: model,
  }));
  await db
    .insertInto('article_focuses')
    .values(values)
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        similarity: sql`excluded.similarity`,
        similarity_model: sql`excluded.similarity_model`,
        assigned_at: now,
      }),
    )
    .execute();
};

// --- Helpers ---

const buildSimilarityQuery = (
  db: Kysely<DatabaseSchema>,
  embeddingModel: string,
  scopeFilter: ScopeFilter | undefined,
  batchSize: number,
) => {
  // Join articles to focuses through their shared user (via sources), scoring every
  // article against every focus for the same user. focus_sources controls display
  // thresholds, not which pairs get scored.
  let q = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .innerJoin('focuses', 'focuses.user_id', 'sources.user_id')
    .leftJoin('article_focuses', (join) =>
      join.onRef('article_focuses.article_id', '=', 'articles.id').onRef('article_focuses.focus_id', '=', 'focuses.id'),
    )
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .select([
      'articles.id as article_id',
      'focuses.id as focus_id',
      'focuses.name',
      'focuses.description',
      'article_embeddings.embedding',
    ])
    .where('articles.extracted_at', 'is not', null)
    .where((eb) =>
      eb.or([
        eb('article_focuses.similarity', 'is', null),
        eb('article_focuses.similarity_model', 'is', null),
        eb('article_focuses.similarity_model', '!=', embeddingModel),
      ]),
    )
    .limit(batchSize);

  if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
    q = q.where('focuses.id', 'in', scopeFilter.focusIds);
  }
  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
  }

  return q;
};

const rowToSimilarityItem = (row: SimilarityRow): SimilarityItem => {
  const embeddingBuf = row.embedding as Buffer | null;
  return {
    articleId: row.article_id,
    focusId: row.focus_id,
    focusLabel: row.description ? `${row.name}: ${row.description}` : row.name,
    embedding: embeddingBuf
      ? new Float32Array(embeddingBuf.buffer, embeddingBuf.byteOffset, embeddingBuf.byteLength / 4)
      : null,
  };
};

// --- Step factory ---

const createSimilarityStep = (params: {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  embeddingModel: string;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<SimilarityItem> => {
  const { db, embedFn, embeddingModel, scopeFilter, batchSize = 100 } = params;
  const focusEmbeddingCache = new Map<string, Float32Array>();

  return {
    name: 'similarity',
    fetchBatch: async function* (): AsyncGenerator<SimilarityItem[]> {
      while (true) {
        const rows = (await buildSimilarityQuery(
          db,
          embeddingModel,
          scopeFilter,
          batchSize,
        ).execute()) as SimilarityRow[];
        if (rows.length === 0) {
          break;
        }

        yield rows.map(rowToSimilarityItem);
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: SimilarityItem[]): Promise<void> => {
      const upsertRows: { articleId: string; focusId: string; similarity: number }[] = [];

      for (const item of batch) {
        if (!item.embedding) {
          continue;
        }

        let focusEmbedding = focusEmbeddingCache.get(item.focusLabel);
        if (!focusEmbedding) {
          focusEmbedding = await embedFn(item.focusLabel);
          focusEmbeddingCache.set(item.focusLabel, focusEmbedding);
        }

        upsertRows.push({
          articleId: item.articleId,
          focusId: item.focusId,
          similarity: dotProduct(item.embedding, focusEmbedding),
        });
      }

      await batchUpsertSimilarity(db, upsertRows, embeddingModel);
    },
  };
};

// --- Exports ---

export { createSimilarityStep };
