import { sql, type Kysely } from 'kysely';

import type { DatabaseSchema } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';
import { prepareText } from './reconciler.utils.ts';

// --- Types ---

type ClassifyFn = (text: string, labels: string[]) => Promise<{ label: string; score: number }[]>;

type NliRow = {
  article_id: string;
  title: string;
  content: string | null;
  summary: string | null;
  source_type: string;
  focus_id: string;
  name: string;
  description: string | null;
};

type NliItem = {
  articleId: string;
  focusId: string;
  focusLabel: string;
  preparedText: string;
};

// --- Persistence ---

const batchUpsertNli = async (
  db: Kysely<DatabaseSchema>,
  rows: { articleId: string; focusId: string; nli: number }[],
  model: string,
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  const values = rows.map((r) => ({
    article_id: r.articleId,
    focus_id: r.focusId,
    nli: Math.round(r.nli * 1000) / 1000,
    nli_model: model,
  }));
  await db
    .insertInto('article_focuses')
    .values(values)
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        nli: sql`excluded.nli`,
        nli_model: sql`excluded.nli_model`,
        assigned_at: now,
      }),
    )
    .execute();
};

// --- Helpers ---

const buildNliQuery = (
  db: Kysely<DatabaseSchema>,
  classifierModel: string,
  scopeFilter: ScopeFilter | undefined,
  batchSize: number,
) => {
  // Query articles × focuses that have similarity scores but need NLI
  // No focus_sources join — NLI runs for all article-focus pairs
  let q = db
    .selectFrom('article_focuses')
    .innerJoin('articles', 'articles.id', 'article_focuses.article_id')
    .innerJoin('focuses', 'focuses.id', 'article_focuses.focus_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .select([
      'articles.id as article_id',
      'articles.title',
      'articles.content',
      'articles.summary',
      'sources.type as source_type',
      'article_focuses.focus_id',
      'focuses.name',
      'focuses.description',
    ])
    .where('articles.extracted_at', 'is not', null)
    .where('article_focuses.similarity', 'is not', null)
    .where((eb) =>
      eb.or([
        eb('article_focuses.nli', 'is', null),
        eb('article_focuses.nli_model', 'is', null),
        eb('article_focuses.nli_model', '!=', classifierModel),
      ]),
    )
    .limit(batchSize);

  if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
    q = q.where('article_focuses.focus_id', 'in', scopeFilter.focusIds);
  }
  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
  }

  return q;
};

const rowsToNliItems = (rows: NliRow[]): NliItem[] => {
  const items: NliItem[] = [];
  for (const row of rows) {
    const text = prepareText({
      title: row.title,
      content: row.content,
      summary: row.summary,
      sourceType: row.source_type,
    });
    if (text) {
      items.push({
        articleId: row.article_id,
        focusId: row.focus_id,
        focusLabel: row.description ? `${row.name}: ${row.description}` : row.name,
        preparedText: text,
      });
    }
  }
  return items;
};

// --- Step factory ---

const createNliStep = (params: {
  db: Kysely<DatabaseSchema>;
  classifyFn: ClassifyFn;
  classifierModel: string;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<NliItem> => {
  const { db, classifyFn, classifierModel, scopeFilter, batchSize = 16 } = params;

  return {
    name: 'nli',
    fetchBatch: async function* (): AsyncGenerator<NliItem[]> {
      while (true) {
        const rows = (await buildNliQuery(db, classifierModel, scopeFilter, batchSize).execute()) as NliRow[];
        if (rows.length === 0) {
          break;
        }

        const items = rowsToNliItems(rows);
        if (items.length > 0) {
          yield items;
        }
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: NliItem[]): Promise<void> => {
      const upsertRows: { articleId: string; focusId: string; nli: number }[] = [];

      for (const item of batch) {
        const results = await classifyFn(item.preparedText, [item.focusLabel]);
        const score = results[0]?.score ?? 0;
        upsertRows.push({ articleId: item.articleId, focusId: item.focusId, nli: score });
      }

      await batchUpsertNli(db, upsertRows, classifierModel);
    },
  };
};

// --- Exports ---

export type { ClassifyFn };
export { createNliStep };
