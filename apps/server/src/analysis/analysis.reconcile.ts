import type { Kysely } from "kysely";

import type { DatabaseSchema } from "../database/database.types.ts";

// --- Dependency function types ---

/**
 * Produces a normalised embedding vector for text.
 * Typically backed by a worker-thread running a sentence-transformer model.
 */
type EmbedFn = (text: string) => Promise<Float32Array>;

/**
 * Zero-shot NLI classification: given text and candidate labels,
 * returns scores sorted descending.
 */
type ClassifyFn = (
  text: string,
  labels: string[],
) => Promise<Array<{ label: string; score: number }>>;

// --- Domain types ---

type FocusTarget = {
  focusId: string;
  name: string;
  description: string | null;
};

type PreparedArticle = {
  id: string;
  sourceId: string;
  sourceType: string;
  title: string;
  content: string | null;
  summary: string | null;
  preparedText: string | null;
};

type ReconcileResult = {
  articlesLoaded: number;
  articlesEmbedded: number;
  assignmentsCreated: number;
};

// --- Classifier strategy ---

type ClassifyResult = {
  focusId: string;
  confidence: number;
  method: string;
};

type ClassifierStrategy = {
  classify: (params: {
    text: string | null;
    embedding: Float32Array | null;
    focuses: FocusTarget[];
  }) => Promise<ClassifyResult[]>;
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

const upsertAssignment = async (
  db: Kysely<DatabaseSchema>,
  articleId: string,
  focusId: string,
  confidence: number,
  method: string,
): Promise<void> => {
  const rounded = Math.round(confidence * 1000) / 1000;
  await db
    .insertInto("article_focuses")
    .values({
      article_id: articleId,
      focus_id: focusId,
      confidence: rounded,
      method,
    })
    .onConflict((oc) =>
      oc.columns(["article_id", "focus_id"]).doUpdateSet({
        confidence: rounded,
        method,
        assigned_at: new Date().toISOString(),
      }),
    )
    .execute();
};

// --- Reconciliation steps ---

const ensureEmbeddings = async (
  articles: PreparedArticle[],
  db: Kysely<DatabaseSchema>,
  embedFn: EmbedFn,
  model: string,
): Promise<number> => {
  const embeddable = articles.filter((a) => a.preparedText);
  if (embeddable.length === 0) return 0;

  const ids = embeddable.map((a) => a.id);
  const existing = await db
    .selectFrom("article_embeddings")
    .select("article_id")
    .where("article_id", "in", ids)
    .execute();

  const hasEmbedding = new Set(existing.map((e) => e.article_id));
  const missing = embeddable.filter((a) => !hasEmbedding.has(a.id));
  if (missing.length === 0) return 0;

  for (const article of missing) {
    const embedding = await embedFn(article.preparedText!);
    const buffer = Buffer.from(embedding.buffer);

    await db
      .insertInto("article_embeddings")
      .values({
        article_id: article.id,
        embedding: buffer,
        model,
      })
      .onConflict((oc) =>
        oc.column("article_id").doUpdateSet({
          embedding: buffer,
          model,
          created_at: new Date().toISOString(),
        }),
      )
      .execute();
  }

  return missing.length;
};

const ensureFocusClassifications = async (
  articles: PreparedArticle[],
  db: Kysely<DatabaseSchema>,
  strategy: ClassifierStrategy,
  threshold: number,
  scopedFocusIds?: string[],
): Promise<number> => {
  if (articles.length === 0) return 0;

  const sourceIds = [...new Set(articles.map((a) => a.sourceId))];

  // Load focus–source links (optionally scoped to specific focuses)
  let linkQuery = db
    .selectFrom("focus_sources")
    .innerJoin("focuses", "focuses.id", "focus_sources.focus_id")
    .select([
      "focus_sources.focus_id",
      "focus_sources.source_id",
      "focus_sources.mode",
      "focuses.name",
      "focuses.description",
    ])
    .where("focus_sources.source_id", "in", sourceIds);

  if (scopedFocusIds && scopedFocusIds.length > 0) {
    linkQuery = linkQuery.where(
      "focus_sources.focus_id",
      "in",
      scopedFocusIds,
    );
  }

  const links = await linkQuery.execute();
  if (links.length === 0) return 0;

  // Index: source → its focus links
  const linksBySource = new Map<string, typeof links>();
  for (const link of links) {
    const arr = linksBySource.get(link.source_id) ?? [];
    arr.push(link);
    linksBySource.set(link.source_id, arr);
  }

  // Load existing assignments so we skip articles already classified
  const articleIds = articles.map((a) => a.id);
  const allFocusIds = [...new Set(links.map((l) => l.focus_id))];

  const existingRows = await db
    .selectFrom("article_focuses")
    .select(["article_id", "focus_id"])
    .where("article_id", "in", articleIds)
    .where("focus_id", "in", allFocusIds)
    .execute();

  const assigned = new Set(
    existingRows.map((r) => `${r.article_id}:${r.focus_id}`),
  );

  // Pre-load embeddings for the whole batch (used by similarity / hybrid)
  const embeddings = await loadEmbeddings(db, articleIds);

  let totalAssigned = 0;

  for (const article of articles) {
    const sourceLinks = linksBySource.get(article.sourceId) ?? [];

    // "always" mode: assign confidence 1.0, no classifier needed
    const alwaysNeeded = sourceLinks.filter(
      (l) =>
        l.mode === "always" && !assigned.has(`${article.id}:${l.focus_id}`),
    );
    for (const link of alwaysNeeded) {
      await upsertAssignment(db, article.id, link.focus_id, 1.0, "always");
      totalAssigned++;
    }

    // "match" mode: classify against all missing focuses at once
    const matchNeeded = sourceLinks.filter(
      (l) =>
        l.mode === "match" && !assigned.has(`${article.id}:${l.focus_id}`),
    );
    if (matchNeeded.length === 0 || !article.preparedText) continue;

    const focusTargets: FocusTarget[] = matchNeeded.map((l) => ({
      focusId: l.focus_id,
      name: l.name,
      description: l.description,
    }));

    const embedding = embeddings.get(article.id) ?? null;
    const results = await strategy.classify({
      text: article.preparedText,
      embedding,
      focuses: focusTargets,
    });

    for (const { focusId, confidence, method } of results) {
      if (confidence >= threshold) {
        await upsertAssignment(db, article.id, focusId, confidence, method);
        totalAssigned++;
      }
    }
  }

  return totalAssigned;
};

// --- Main reconcile function ---

const reconcile = async (
  articleIds: string[],
  db: Kysely<DatabaseSchema>,
  embedFn: EmbedFn,
  strategy: ClassifierStrategy,
  options: {
    embeddingModel: string;
    confidenceThreshold: number;
    focusIds?: string[];
    skipEmbedding?: boolean;
  },
): Promise<ReconcileResult> => {
  const articles = await loadArticles(db, articleIds);
  if (articles.length === 0) {
    return { articlesLoaded: 0, articlesEmbedded: 0, assignmentsCreated: 0 };
  }

  // Step 1: ensure every article with text has an embedding
  let articlesEmbedded = 0;
  if (!options.skipEmbedding) {
    articlesEmbedded = await ensureEmbeddings(
      articles,
      db,
      embedFn,
      options.embeddingModel,
    );
  }

  // Step 2: ensure every article is classified for every linked focus
  const assignmentsCreated = await ensureFocusClassifications(
    articles,
    db,
    strategy,
    options.confidenceThreshold,
    options.focusIds,
  );

  // Step 3: mark articles as analysed
  const loadedIds = articles.map((a) => a.id);
  await db
    .updateTable("articles")
    .set({ analysed_at: new Date().toISOString() })
    .where("id", "in", loadedIds)
    .execute();

  return {
    articlesLoaded: articles.length,
    articlesEmbedded,
    assignmentsCreated,
  };
};

// --- Classifier strategies ---

/**
 * Zero-shot NLI: classifies article text against focus labels.
 * Most accurate, but slowest (~0.5s per article per focus set).
 */
const createNliStrategy = (classifyFn: ClassifyFn): ClassifierStrategy => ({
  classify: async ({ text, focuses }) => {
    if (!text || focuses.length === 0) return [];

    const labels = focuses.map((f) =>
      f.description ? `${f.name}: ${f.description}` : f.name,
    );

    const results = await classifyFn(text, labels);

    return results
      .map(({ label, score }) => {
        const idx = labels.indexOf(label);
        if (idx === -1) return null;
        return { focusId: focuses[idx]!.focusId, confidence: score, method: "nli" };
      })
      .filter((r): r is ClassifyResult => r !== null);
  },
});

/**
 * Embedding similarity: cosine similarity between article and focus embeddings.
 * Very fast (~sub-ms per article) but less nuanced than NLI.
 * Requires articles to already have embeddings stored.
 * Focus label embeddings are cached for the lifetime of the strategy instance.
 */
const createSimilarityStrategy = (embedFn: EmbedFn): ClassifierStrategy => {
  const focusEmbeddingCache = new Map<string, Float32Array>();

  return {
    classify: async ({ embedding, focuses }) => {
      if (!embedding || focuses.length === 0) return [];

      const results: ClassifyResult[] = [];
      for (const focus of focuses) {
        const label = focus.description
          ? `${focus.name}: ${focus.description}`
          : focus.name;

        let focusEmbedding = focusEmbeddingCache.get(label);
        if (!focusEmbedding) {
          focusEmbedding = await embedFn(label);
          focusEmbeddingCache.set(label, focusEmbedding);
        }

        results.push({
          focusId: focus.focusId,
          confidence: dotProduct(embedding, focusEmbedding),
          method: "similarity",
        });
      }

      return results;
    },
  };
};

/**
 * Hybrid: fast similarity pass, then NLI refinement for ambiguous results.
 *
 * Articles clearly above or below the ambiguous range keep their similarity
 * scores (fast). Articles in the ambiguous zone get a second NLI pass for
 * higher accuracy. This gives near-instant results for most articles while
 * preserving NLI quality where it matters.
 */
const createHybridStrategy = (
  embedFn: EmbedFn,
  classifyFn: ClassifyFn,
  ambiguousRange: [number, number] = [0.25, 0.65],
): ClassifierStrategy => {
  const similarity = createSimilarityStrategy(embedFn);
  const nli = createNliStrategy(classifyFn);

  return {
    classify: async (params) => {
      // No embedding → fall back to NLI only
      if (!params.embedding) {
        return nli.classify(params);
      }

      // Phase 1: similarity (fast)
      const simResults = await similarity.classify(params);

      // No text available → can't refine with NLI
      if (!params.text) return simResults;

      // Phase 2: NLI for ambiguous results only
      const [lo, hi] = ambiguousRange;
      const ambiguousFocuses = params.focuses.filter((f) => {
        const sim = simResults.find((r) => r.focusId === f.focusId);
        return sim && sim.confidence >= lo && sim.confidence <= hi;
      });

      if (ambiguousFocuses.length === 0) return simResults;

      const nliResults = await nli.classify({
        ...params,
        focuses: ambiguousFocuses,
      });

      // Merge: NLI results replace similarity results for ambiguous focuses
      const nliMap = new Map(
        nliResults.map((r) => [r.focusId, r]),
      );
      return simResults.map((r) => {
        const refined = nliMap.get(r.focusId);
        return refined ?? r;
      });
    },
  };
};

// --- Exports ---

export type {
  EmbedFn,
  ClassifyFn,
  FocusTarget,
  PreparedArticle,
  ClassifyResult,
  ClassifierStrategy,
  ReconcileResult,
};
export {
  reconcile,
  prepareText,
  stripHtml,
  dotProduct,
  loadArticles,
  loadEmbeddings,
  ensureEmbeddings,
  ensureFocusClassifications,
  createNliStrategy,
  createSimilarityStrategy,
  createHybridStrategy,
};
