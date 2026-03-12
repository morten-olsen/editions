import { extract } from "@extractus/article-extractor";

import type { Kysely } from "kysely";

import type { DatabaseSchema, FocusSourceMode } from "../database/database.types.ts";

// --- Dependency function types ---

type EmbedFn = (text: string) => Promise<Float32Array>;

type ClassifyFn = (
  text: string,
  labels: string[],
) => Promise<Array<{ label: string; score: number }>>;

// --- Step abstraction ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReconcileStep<T = any> = {
  name: string;
  fetchBatch: () => AsyncGenerator<T[]>;
  processBatch: (batch: T[]) => Promise<void>;
};

type ReconcileProgress = { phase: string; completed: number; total: number };
type ProgressCallback = (progress: ReconcileProgress) => void;

type ScopeFilter = {
  sourceIds?: string[];
  focusIds?: string[];
};

// --- Text preparation ---

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const prepareText = (article: {
  title: string;
  content: string | null;
  summary: string | null;
  sourceType: string;
}): string | null => {
  const raw =
    article.content ??
    (article.sourceType === "podcast" ? article.summary : null);
  if (!raw) return null;
  return `${article.title}. ${stripHtml(raw)}`.slice(0, 2000);
};

// --- Math ---

const dotProduct = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
};

// --- Data loading ---

type PreparedArticle = {
  id: string;
  sourceId: string;
  sourceType: string;
  title: string;
  content: string | null;
  summary: string | null;
  preparedText: string | null;
};

const loadArticles = async (
  db: Kysely<DatabaseSchema>,
  articleIds: string[],
): Promise<PreparedArticle[]> => {
  if (articleIds.length === 0) return [];

  const rows = await db
    .selectFrom("articles")
    .innerJoin("sources", "sources.id", "articles.source_id")
    .select([
      "articles.id",
      "articles.source_id",
      "articles.title",
      "articles.summary",
      "articles.content",
      "sources.type as source_type",
    ])
    .where("articles.id", "in", articleIds)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    title: row.title,
    content: row.content,
    summary: row.summary,
    preparedText: prepareText({
      title: row.title,
      content: row.content,
      summary: row.summary,
      sourceType: row.source_type,
    }),
  }));
};

const loadEmbeddings = async (
  db: Kysely<DatabaseSchema>,
  articleIds: string[],
): Promise<Map<string, Float32Array>> => {
  if (articleIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("article_embeddings")
    .select(["article_id", "embedding"])
    .where("article_id", "in", articleIds)
    .execute();

  const map = new Map<string, Float32Array>();
  for (const row of rows) {
    const buf = row.embedding as Buffer;
    map.set(
      row.article_id,
      new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4),
    );
  }
  return map;
};

// --- Persistence helpers ---

const WORDS_PER_MINUTE = 238;

const upsertSimilarity = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  similarity: number,
): Promise<void> => {
  const rounded = Math.round(similarity * 1000) / 1000;
  await db
    .insertInto("article_focuses")
    .values({
      article_id: articleId,
      focus_id: focusId,
      similarity: rounded,
    })
    .onConflict((oc) =>
      oc.columns(["article_id", "focus_id"]).doUpdateSet({
        similarity: rounded,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

const upsertNli = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  nli: number,
): Promise<void> => {
  const rounded = Math.round(nli * 1000) / 1000;
  await db
    .insertInto("article_focuses")
    .values({
      article_id: articleId,
      focus_id: focusId,
      nli: rounded,
    })
    .onConflict((oc) =>
      oc.columns(["article_id", "focus_id"]).doUpdateSet({
        nli: rounded,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

// --- Step runner ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runReconcileSteps = async (
  steps: ReconcileStep<any>[],
  onProgress?: ProgressCallback,
): Promise<void> => {
  for (const step of steps) {
    let completed = 0;
    for await (const batch of step.fetchBatch()) {
      await step.processBatch(batch);
      completed += batch.length;
      onProgress?.({ phase: step.name, completed, total: 0 });
    }
  }
};

// --- Step factories ---

type ExtractItem = {
  id: string;
  url: string;
  title: string;
  content: string | null;
  sourceType: string;
};

const createExtractStep = (params: {
  db: Kysely<DatabaseSchema>;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<ExtractItem> => {
  const { db, scopeFilter, batchSize = 4 } = params;

  return {
    name: "extract",
    fetchBatch: async function* (): AsyncGenerator<ExtractItem[]> {
      let lastId = "";
      while (true) {
        let q = db
          .selectFrom("articles")
          .innerJoin("sources", "sources.id", "articles.source_id")
          .select([
            "articles.id",
            "articles.url",
            "articles.title",
            "articles.content",
            "sources.type as source_type",
          ])
          .where("articles.extracted_at", "is", null)
          .where("articles.url", "is not", null)
          .where("articles.id", ">", lastId)
          .orderBy("articles.id")
          .limit(batchSize);

        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where("articles.source_id", "in", scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) break;

        const items: ExtractItem[] = rows
          .filter((r) => r.url !== null)
          .map((r) => ({
            id: r.id,
            url: r.url!,
            title: r.title,
            content: r.content,
            sourceType: r.source_type,
          }));

        if (items.length > 0) yield items;
        lastId = rows[rows.length - 1]!.id;
        if (rows.length < batchSize) break;
      }
    },
    processBatch: async (batch: ExtractItem[]): Promise<void> => {
      await Promise.all(
        batch.map(async (item) => {
          // Podcast episodes are handled at fetch time
          if (item.sourceType === "podcast") return;

          try {
            const result = await extract(item.url);
            if (result?.content) {
              const wordCount = result.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
              const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

              const updates: Record<string, unknown> = {
                content: result.content,
                consumption_time_seconds: consumptionTimeSeconds,
                image_url: result.image ?? undefined,
                extracted_at: new Date().toISOString(),
              };

              if (result.title && item.title === item.url) {
                updates.title = result.title;
              }
              if (result.author) updates.author = result.author;
              if (result.description) updates.summary = result.description;

              await db
                .updateTable("articles")
                .set(updates)
                .where("id", "=", item.id)
                .execute();
            } else if (item.content) {
              const wordCount = item.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
              const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

              await db
                .updateTable("articles")
                .set({
                  consumption_time_seconds: consumptionTimeSeconds,
                  extracted_at: new Date().toISOString(),
                })
                .where("id", "=", item.id)
                .execute();
            }
          } catch {
            if (item.content) {
              const wordCount = item.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
              const consumptionTimeSeconds = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);

              await db
                .updateTable("articles")
                .set({
                  consumption_time_seconds: consumptionTimeSeconds,
                  extracted_at: new Date().toISOString(),
                })
                .where("id", "=", item.id)
                .execute();
            }
          }
        }),
      );
    },
  };
};

type EmbedItem = {
  id: string;
  preparedText: string;
};

const createEmbedStep = (params: {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  embeddingModel: string;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<EmbedItem> => {
  const { db, embedFn, embeddingModel, scopeFilter, batchSize = 32 } = params;

  return {
    name: "embed",
    fetchBatch: async function* (): AsyncGenerator<EmbedItem[]> {
      let lastId = "";
      while (true) {
        let q = db
          .selectFrom("articles")
          .innerJoin("sources", "sources.id", "articles.source_id")
          .leftJoin("article_embeddings", "article_embeddings.article_id", "articles.id")
          .select([
            "articles.id",
            "articles.title",
            "articles.content",
            "articles.summary",
            "sources.type as source_type",
          ])
          .where("articles.extracted_at", "is not", null)
          .where("article_embeddings.article_id", "is", null)
          .where("articles.id", ">", lastId)
          .orderBy("articles.id")
          .limit(batchSize);

        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where("articles.source_id", "in", scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) break;

        const items: EmbedItem[] = [];
        for (const row of rows) {
          const text = prepareText({
            title: row.title,
            content: row.content,
            summary: row.summary,
            sourceType: row.source_type,
          });
          if (text) items.push({ id: row.id, preparedText: text });
        }

        if (items.length > 0) yield items;
        lastId = rows[rows.length - 1]!.id;
        if (rows.length < batchSize) break;
      }
    },
    processBatch: async (batch: EmbedItem[]): Promise<void> => {
      for (const item of batch) {
        const embedding = await embedFn(item.preparedText);
        const buffer = Buffer.from(embedding.buffer);

        await db
          .insertInto("article_embeddings")
          .values({
            article_id: item.id,
            embedding: buffer,
            model: embeddingModel,
          })
          .onConflict((oc) =>
            oc.column("article_id").doUpdateSet({
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

type SimilarityItem = {
  articleId: string;
  focusId: string;
  mode: FocusSourceMode;
  focusLabel: string;
  embedding: Float32Array | null;
};

const createSimilarityStep = (params: {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<SimilarityItem> => {
  const { db, embedFn, scopeFilter, batchSize = 100 } = params;
  const focusEmbeddingCache = new Map<string, Float32Array>();

  return {
    name: "similarity",
    fetchBatch: async function* (): AsyncGenerator<SimilarityItem[]> {
      // Find all (article, focus) pairs that need similarity scores
      // This includes "always" mode pairs (similarity = 1.0) and "match" mode pairs
      let offset = 0;
      while (true) {
        let q = db
          .selectFrom("focus_sources")
          .innerJoin("articles", "articles.source_id", "focus_sources.source_id")
          .innerJoin("focuses", "focuses.id", "focus_sources.focus_id")
          .leftJoin("article_focuses", (join) =>
            join
              .onRef("article_focuses.article_id", "=", "articles.id")
              .onRef("article_focuses.focus_id", "=", "focus_sources.focus_id"),
          )
          .leftJoin("article_embeddings", "article_embeddings.article_id", "articles.id")
          .select([
            "articles.id as article_id",
            "focus_sources.focus_id",
            "focus_sources.mode",
            "focuses.name",
            "focuses.description",
            "article_embeddings.embedding",
          ])
          .where("articles.extracted_at", "is not", null)
          .where("article_focuses.similarity", "is", null)
          .limit(batchSize)
          .offset(offset);

        if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
          q = q.where("focus_sources.focus_id", "in", scopeFilter.focusIds);
        }
        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where("focus_sources.source_id", "in", scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) break;

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
        if (rows.length < batchSize) break;
      }
    },
    processBatch: async (batch: SimilarityItem[]): Promise<void> => {
      for (const item of batch) {
        if (item.mode === "always") {
          await upsertSimilarity(db, item.articleId, item.focusId, 1.0);
          continue;
        }

        // "match" mode: compute cosine similarity
        if (!item.embedding) continue;

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

type NliItem = {
  articleId: string;
  focusId: string;
  focusLabel: string;
  preparedText: string;
};

const createNliStep = (params: {
  db: Kysely<DatabaseSchema>;
  classifyFn: ClassifyFn;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<NliItem> => {
  const { db, classifyFn, scopeFilter, batchSize = 16 } = params;

  return {
    name: "nli",
    fetchBatch: async function* (): AsyncGenerator<NliItem[]> {
      while (true) {
        let q = db
          .selectFrom("focus_sources")
          .innerJoin("articles", "articles.source_id", "focus_sources.source_id")
          .innerJoin("focuses", "focuses.id", "focus_sources.focus_id")
          .innerJoin("sources", "sources.id", "articles.source_id")
          .leftJoin("article_focuses", (join) =>
            join
              .onRef("article_focuses.article_id", "=", "articles.id")
              .onRef("article_focuses.focus_id", "=", "focus_sources.focus_id"),
          )
          .select([
            "articles.id as article_id",
            "articles.title",
            "articles.content",
            "articles.summary",
            "sources.type as source_type",
            "focus_sources.focus_id",
            "focus_sources.mode",
            "focuses.name",
            "focuses.description",
          ])
          .where("articles.extracted_at", "is not", null)
          .where("focus_sources.mode", "=", "match")
          // Only items that have a similarity score but no NLI score yet
          .where("article_focuses.similarity", "is not", null)
          .where("article_focuses.nli", "is", null)
          .limit(batchSize);

        if (scopeFilter?.focusIds && scopeFilter.focusIds.length > 0) {
          q = q.where("focus_sources.focus_id", "in", scopeFilter.focusIds);
        }
        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where("focus_sources.source_id", "in", scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) break;

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

        if (items.length > 0) yield items;
        if (rows.length < batchSize) break;
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

// --- Mark analysed step ---

const createMarkAnalysedStep = (params: {
  db: Kysely<DatabaseSchema>;
  scopeFilter?: ScopeFilter;
  batchSize?: number;
}): ReconcileStep<{ id: string }> => {
  const { db, scopeFilter, batchSize = 100 } = params;

  return {
    name: "mark_analysed",
    fetchBatch: async function* (): AsyncGenerator<{ id: string }[]> {
      while (true) {
        let q = db
          .selectFrom("articles")
          .select("articles.id")
          .where("articles.extracted_at", "is not", null)
          .where("articles.analysed_at", "is", null)
          .limit(batchSize);

        if (scopeFilter?.sourceIds && scopeFilter.sourceIds.length > 0) {
          q = q.where("articles.source_id", "in", scopeFilter.sourceIds);
        }

        const rows = await q.execute();
        if (rows.length === 0) break;
        yield rows.map((r) => ({ id: r.id }));
        if (rows.length < batchSize) break;
      }
    },
    processBatch: async (batch: { id: string }[]): Promise<void> => {
      const ids = batch.map((b) => b.id);
      await db
        .updateTable("articles")
        .set({ analysed_at: new Date().toISOString() })
        .where("id", "in", ids)
        .execute();
    },
  };
};

// --- Factory: build all steps based on config ---

type ReconcileStepConfig = {
  db: Kysely<DatabaseSchema>;
  embedFn: EmbedFn;
  classifyFn?: ClassifyFn;
  embeddingModel: string;
  classifier: "nli" | "similarity" | "hybrid";
  scopeFilter?: ScopeFilter;
  skipExtract?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createReconcileSteps = (params: ReconcileStepConfig): ReconcileStep<any>[] => {
  const { db, embedFn, classifyFn, embeddingModel, classifier, scopeFilter, skipExtract } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: ReconcileStep<any>[] = [];

  if (!skipExtract) {
    steps.push(createExtractStep({ db, scopeFilter }));
  }

  steps.push(createEmbedStep({ db, embedFn, embeddingModel, scopeFilter }));
  steps.push(createSimilarityStep({ db, embedFn, scopeFilter }));

  if ((classifier === "nli" || classifier === "hybrid") && classifyFn) {
    steps.push(createNliStep({ db, classifyFn, scopeFilter }));
  }

  steps.push(createMarkAnalysedStep({ db, scopeFilter }));

  return steps;
};

// --- Exports ---

export type {
  EmbedFn,
  ClassifyFn,
  ReconcileStep,
  ReconcileProgress,
  ProgressCallback,
  ScopeFilter,
  ReconcileStepConfig,
};
export {
  runReconcileSteps,
  createReconcileSteps,
  createExtractStep,
  createEmbedStep,
  createSimilarityStep,
  createNliStep,
  createMarkAnalysedStep,
};
