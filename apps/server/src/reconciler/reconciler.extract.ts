import { extract } from '@extractus/article-extractor';
import type { Kysely } from 'kysely';
import TurndownService from 'turndown';

import type { DatabaseSchema } from '../database/database.types.ts';

import type { ReconcileStep } from './reconciler.runner.ts';
import type { ScopeFilter } from './reconciler.utils.ts';

// --- HTML → Markdown ---

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

const htmlToMarkdown = (html: string): string => turndown.turndown(html);

// --- Types ---

type ExtractItem = {
  id: string;
  url: string;
  title: string;
  content: string | null;
  sourceType: string;
};

// --- Constants ---

const WORDS_PER_MINUTE = 238;

// --- Helpers ---

const computeReadingTime = (markdown: string): number => {
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  return Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
};

const saveFallbackContent = async (db: Kysely<DatabaseSchema>, itemId: string, htmlContent: string): Promise<void> => {
  const markdown = htmlToMarkdown(htmlContent);
  await db
    .updateTable('articles')
    .set({
      content: markdown,
      consumption_time_seconds: computeReadingTime(markdown),
      extracted_at: new Date().toISOString(),
    })
    .where('id', '=', itemId)
    .execute();
};

const saveExtractedContent = async (
  db: Kysely<DatabaseSchema>,
  item: ExtractItem,
  result: { content: string; title?: string; author?: string; description?: string; image?: string },
): Promise<void> => {
  const markdown = htmlToMarkdown(result.content);
  const updates: Record<string, unknown> = {
    content: markdown,
    consumption_time_seconds: computeReadingTime(markdown),
    image_url: result.image ?? undefined,
    extracted_at: new Date().toISOString(),
  };

  if (result.title && item.title === item.url) {
    updates.title = result.title;
  }
  if (result.author) {
    updates.author = result.author;
  }
  if (result.description) {
    updates.summary = result.description;
  }

  await db.updateTable('articles').set(updates).where('id', '=', item.id).execute();
};

const processExtractItem = async (db: Kysely<DatabaseSchema>, item: ExtractItem): Promise<void> => {
  if (item.sourceType === 'podcast') {
    return;
  }

  try {
    const result = await extract(item.url);
    if (result?.content) {
      await saveExtractedContent(db, item, { ...result, content: result.content });
    } else if (item.content) {
      await saveFallbackContent(db, item.id, item.content);
    }
  } catch {
    if (item.content) {
      await saveFallbackContent(db, item.id, item.content);
    }
  }
};

// --- Step factory ---

const createExtractStep = (params: {
  db: Kysely<DatabaseSchema>;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<ExtractItem> => {
  const { db, scopeFilter, batchSize = 4 } = params;

  return {
    name: 'extract',
    fetchBatch: async function* (): AsyncGenerator<ExtractItem[]> {
      let lastId = '';
      while (true) {
        let q = db
          .selectFrom('articles')
          .innerJoin('sources', 'sources.id', 'articles.source_id')
          .select(['articles.id', 'articles.url', 'articles.title', 'articles.content', 'sources.type as source_type'])
          .where('articles.extracted_at', 'is', null)
          .where('articles.url', 'is not', null)
          .where('articles.id', '>', lastId)
          .orderBy('articles.id')
          .limit(batchSize);

        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where('articles.source_id', 'in', scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) {
          break;
        }

        const items: ExtractItem[] = rows
          .filter((r) => r.url !== null)
          .map((r) => ({
            id: r.id,
            url: r.url as string,
            title: r.title,
            content: r.content,
            sourceType: r.source_type,
          }));

        if (items.length > 0) {
          yield items;
        }
        lastId = (rows[rows.length - 1] as (typeof rows)[number]).id;
        if (rows.length < batchSize) {
          break;
        }
      }
    },
    processBatch: async (batch: ExtractItem[]): Promise<void> => {
      await Promise.all(batch.map((item) => processExtractItem(db, item)));
    },
  };
};

// --- Exports ---

export { createExtractStep };
