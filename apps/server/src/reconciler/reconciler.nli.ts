import type { Kysely } from 'kysely';

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

const upsertNli = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  nli: number,
): Promise<void> => {
  const rounded = Math.round(nli * 1000) / 1000;
  await db
    .insertInto('article_focuses')
    .values({
      article_id: articleId,
      focus_id: focusId,
      nli: rounded,
    })
    .onConflict((oc) =>
      oc.columns(['article_id', 'focus_id']).doUpdateSet({
        nli: rounded,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

// --- Helpers ---

const buildNliQuery = (db: Kysely<DatabaseSchema>, scopeFilter: ScopeFilter | undefined, batchSize: number) => {
  let q = db
    .selectFrom('focus_sources')
    .innerJoin('articles', 'articles.source_id', 'focus_sources.source_id')
    .innerJoin('focuses', 'focuses.id', 'focus_sources.focus_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .leftJoin('article_focuses', (join) =>
      join
        .onRef('article_focuses.article_id', '=', 'articles.id')
        .onRef('article_focuses.focus_id', '=', 'focus_sources.focus_id'),
    )
    .select([
      'articles.id as article_id',
      'articles.title',
      'articles.content',
      'articles.summary',
      'sources.type as source_type',
      'focus_sources.focus_id',
      'focus_sources.mode',
      'focuses.name',
      'focuses.description',
    ])
    .where('articles.extracted_at', 'is not', null)
    .where('focus_sources.mode', '=', 'match')
    .where('article_focuses.similarity', 'is not', null)
    .where('article_focuses.nli', 'is', null)
    .limit(batchSize);

  if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
    q = q.where('focus_sources.focus_id', 'in', scopeFilter.focusIds);
  }
  if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
    q = q.where('focus_sources.source_id', 'in', scopeFilter.sourceIds);
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
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<NliItem> => {
  const { db, classifyFn, scopeFilter, batchSize = 16 } = params;

  return {
    name: 'nli',
    fetchBatch: async function* (): AsyncGenerator<NliItem[]> {
      while (true) {
        const rows = (await buildNliQuery(db, scopeFilter, batchSize).execute()) as NliRow[];
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
      for (const item of batch) {
        const results = await classifyFn(item.preparedText, [item.focusLabel]);
        const score = results[0]?.score ?? 0;
        await upsertNli(db, item.articleId, item.focusId, score);
      }
    },
  };
};

// --- Exports ---

export type { ClassifyFn };
export { createNliStep };
