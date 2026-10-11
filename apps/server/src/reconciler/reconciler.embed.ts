import { setImmediate } from 'node:timers/promises';

import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';
import { decodeEmbedding } from '../ranking/ranking.ts';

import { ReconcileItemError } from './reconciler.runner.ts';
import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import { prepareText, isValidEmbedding } from './reconciler.utils.ts';

// --- Types ---

type EmbedFn = (text: string) => Promise<Float32Array>;

type EmbedItem = {
  id: string;
  preparedText: string;
};

// --- Helpers ---

const buildEmbedScope = (db: Kysely<DatabaseSchema>, scopeFilter: ScopeFilter | undefined) => {
  let q = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .where('articles.extracted_at', 'is not', null);

  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
  }

  if (scopeFilter?.pendingOnly) q = q.where('articles.analysed_at', 'is', null);
  return q;
};

// Scan stored vectors in bounded pages, including current-model vectors: an
// earlier model run may have persisted NaN. Only missing/stale/invalid vectors
// need inference; valid vectors and article content are left untouched.
const pendingEmbeddingIds = async function* (
  db: Kysely<DatabaseSchema>,
  embeddingModel: string,
  scopeFilter: ScopeFilter | undefined,
  batchSize: number,
): AsyncGenerator<string[]> {
  let lastId = '';
  while (true) {
    // Sort only IDs. Sorting joined embedding BLOBs before LIMIT makes a
    // scoped backlog allocate native SQLite work proportional to the corpus.
    const page = buildEmbedScope(db, scopeFilter)
      .select('articles.id')
      .where('articles.id', '>', lastId)
      .orderBy('articles.id')
      .limit(batchSize);
    const rows = await db
      .selectFrom('articles')
      .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
      .select(['articles.id', 'article_embeddings.embedding', 'article_embeddings.model'])
      .where('articles.id', 'in', page)
      .orderBy('articles.id')
      .execute();
    if (rows.length === 0) {
      return;
    }
    const ids = rows
      .filter((row) => row.model !== embeddingModel || !isValidEmbedding(decodeEmbedding(row.embedding)))
      .map((row) => row.id);
    if (ids.length > 0) {
      yield ids;
    }
    lastId = (rows[rows.length - 1] as (typeof rows)[number]).id;
    if (rows.length < batchSize) {
      return;
    }
    // SQLite resolves queries synchronously; allow timers and native finalizers
    // to run even when every vector on a large page is already valid.
    await setImmediate();
  }
};

const upsertEmbedding = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  buffer: Buffer,
  model: string,
): Promise<void> => {
  await db
    .insertInto('article_embeddings')
    .values({ article_id: articleId, embedding: buffer, model })
    .onConflict((oc) =>
      oc.column('article_id').doUpdateSet({
        embedding: buffer,
        model,
        created_at: new Date().toISOString(),
      }),
    )
    .execute();
};

// --- Step factory ---

const createEmbedStep = (params: {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  embeddingModel: string;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<EmbedItem> => {
  const { db, embedFn, embeddingModel, scopeFilter, batchSize = 32 } = params;

  return {
    name: 'embed',
    countRemaining: async (): Promise<number> => {
      let count = 0;
      for await (const ids of pendingEmbeddingIds(db, embeddingModel, scopeFilter, batchSize)) {
        count += ids.length;
      }
      return count;
    },
    fetchBatch: async function* (): AsyncGenerator<EmbedItem[]> {
      for await (const ids of pendingEmbeddingIds(db, embeddingModel, scopeFilter, batchSize)) {
        const rows = await db
          .selectFrom('articles')
          .innerJoin('sources', 'sources.id', 'articles.source_id')
          .select([
            'articles.id',
            'articles.title',
            'articles.content',
            'articles.summary',
            'sources.type as source_type',
          ])
          .where('articles.id', 'in', ids)
          .orderBy('articles.id')
          .execute();
        const items: EmbedItem[] = [];
        for (const row of rows) {
          const text = prepareText({
            title: row.title,
            content: row.content,
            summary: row.summary,
            sourceType: row.source_type,
          });
          if (text) {
            items.push({ id: row.id, preparedText: text });
          }
        }
        if (items.length > 0) {
          yield items;
        }
      }
    },
    processBatch: async (batch: EmbedItem[]): Promise<void> => {
      let rejected = 0;
      let firstRejected = '';
      for (const item of batch) {
        const embedding = await embedFn(item.preparedText);
        if (!isValidEmbedding(embedding)) {
          rejected++;
          firstRejected ||= item.id;
          continue;
        }
        const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

        await upsertEmbedding(db, item.id, buffer, embeddingModel);
      }
      if (rejected > 0) {
        throw new ReconcileItemError(rejected, `Invalid embedding for article ${firstRejected}`);
      }
    },
  };
};

// --- Exports ---

export type { EmbedFn };
export { createEmbedStep };
