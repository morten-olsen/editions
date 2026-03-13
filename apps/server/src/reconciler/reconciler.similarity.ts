import type { Kysely } from 'kysely';

import type { DatabaseSchema, FocusSourceMode } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import type { EmbedFn } from './reconciler.embed.ts';

// --- Types ---

type SimilarityRow = {
  article_id: string;
  focus_id: string;
  mode: string;
  name: string;
  description: string | null;
  embedding: unknown;
};

type SimilarityItem = {
  articleId: string;
  focusId: string;
  mode: FocusSourceMode;
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

const upsertSimilarity = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  similarity: number,
  model: string,
): Promise<void> => {
  const rounded = Math.round(similarity * 1000) / 1000;
  await db
    .insertInto('article_focuses')
    .values({
      article_id: articleId,
      focus_id: focusId,
      similarity: rounded,
      similarity_model: model,
    })
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        similarity: rounded,
        similarity_model: model,
        assigned_at: new Date().toISOString(),
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
    .where((eb) =>
      eb.or([
        eb('article_focuses.similarity', 'is', null),
        eb('article_focuses.similarity_model', 'is', null),
        eb('article_focuses.similarity_model', '!=', embeddingModel),
      ]),
    )
    .limit(batchSize);

  if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
    q = q.where('focus_sources.focus_id', 'in', scopeFilter.focusIds);
  }
  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('focus_sources.source_id', 'in', scopeFilter.sourceIds);
  }

  return q;
};

const rowToSimilarityItem = (row: SimilarityRow): SimilarityItem => {
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
        const rows = (await buildSimilarityQuery(db, embeddingModel, scopeFilter, batchSize).execute()) as SimilarityRow[];
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
      for (const item of batch) {
        if (item.mode === 'always') {
          await upsertSimilarity(db, item.articleId, item.focusId, 1.0, embeddingModel);
          continue;
        }

        if (!item.embedding) {
          continue;
        }

        let focusEmbedding = focusEmbeddingCache.get(item.focusLabel);
        if (!focusEmbedding) {
          focusEmbedding = await embedFn(item.focusLabel);
          focusEmbeddingCache.set(item.focusLabel, focusEmbedding);
        }

        const sim = dotProduct(item.embedding, focusEmbedding);
        await upsertSimilarity(db, item.articleId, item.focusId, sim, embeddingModel);
      }
    },
  };
};

// --- Exports ---

export { createSimilarityStep };
