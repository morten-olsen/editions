import type { Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import { prepareText } from './reconciler.utils.ts';

// --- Types ---

type EmbedFn = (text: string) => Promise<Float32Array>;

type EmbedItem = {
  id: string;
  preparedText: string;
};

// --- Helpers ---

const buildEmbedScope = (db: Kysely<DatabaseSchema>, embeddingModel: string, scopeFilter: ScopeFilter | undefined) => {
  let q = db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .leftJoin('article_embeddings', 'article_embeddings.article_id', 'articles.id')
    .where('articles.extracted_at', 'is not', null)
    .where((eb) =>
      eb.or([eb('article_embeddings.article_id', 'is', null), eb('article_embeddings.model', '!=', embeddingModel)]),
    );

  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
  }

  return q;
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
      const row = await buildEmbedScope(db, embeddingModel, scopeFilter)
        .select(db.fn.countAll().as('count'))
        .executeTakeFirst();
      return Number(row?.count ?? 0);
    },
    fetchBatch: async function* (): AsyncGenerator<EmbedItem[]> {
      let lastId = '';
      while (true) {
        const q = buildEmbedScope(db, embeddingModel, scopeFilter)
          .select([
            'articles.id',
            'articles.title',
            'articles.content',
            'articles.summary',
            'sources.type as source_type',
          ])
          .where('articles.id', '>', lastId)
          .orderBy('articles.id')
          .limit(batchSize);

        const rows = await q.execute();
        if (rows.length === 0) {
          break;
        }

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
        lastId = (rows[rows.length - 1] as (typeof rows)[number]).id;
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: EmbedItem[]): Promise<void> => {
      for (const item of batch) {
        const embedding = await embedFn(item.preparedText);
        const buffer = Buffer.from(embedding.buffer);

        await db
          .insertInto('article_embeddings')
          .values({
            article_id: item.id,
            embedding: buffer,
            model: embeddingModel,
          })
          .onConflict((oc) =>
            oc.column('article_id').doUpdateSet({
              embedding: buffer,
              model: embeddingModel,
              created_at: new Date().toISOString(),
            }),
          )
          .execute();
      }
    },
  };
};

// --- Exports ---

export type { EmbedFn };
export { createEmbedStep };
