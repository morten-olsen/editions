import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { DatabaseService } from "../database/database.ts";
import { TaskService } from "../tasks/tasks.ts";
import { destroySymbol } from "../services/services.ts";

import type { WorkerResponse } from "./analysis.worker.ts";
import type { Services } from "../services/services.ts";

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_CONFIDENCE_THRESHOLD = 0.3;

const WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "analysis.worker.ts",
);

// --- Types ---

type AnalyseArticlePayload = {
  articleId: string;
};

type AnalysisResult = {
  articleId: string;
  embeddingDimensions: number;
  focusMatches: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

// --- Service ---

class AnalysisService {
  #services: Services;
  #worker: Worker | null = null;
  #pending = new Map<string, PendingRequest>();

  constructor(services: Services) {
    this.#services = services;
  }

  #getWorker = (): Worker => {
    if (!this.#worker) {
      this.#worker = new Worker(WORKER_PATH);

      this.#worker.on("message", (msg: WorkerResponse) => {
        const pending = this.#pending.get(msg.id);
        if (!pending) return;
        this.#pending.delete(msg.id);

        if (msg.type === "error") {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg);
        }
      });

      this.#worker.on("error", (err: Error) => {
        // Reject all pending requests
        for (const [id, pending] of this.#pending) {
          pending.reject(err);
          this.#pending.delete(id);
        }
        this.#worker = null;
      });

      this.#worker.on("exit", () => {
        // Reject any remaining pending requests
        for (const [id, pending] of this.#pending) {
          pending.reject(new Error("Analysis worker exited unexpectedly"));
          this.#pending.delete(id);
        }
        this.#worker = null;
      });
    }

    return this.#worker;
  };

  #request = (msg: Record<string, unknown>): Promise<WorkerResponse> => {
    const id = crypto.randomUUID();

    return new Promise<WorkerResponse>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.#getWorker().postMessage({ ...msg, id });
    });
  };

  /**
   * Compute a normalised embedding for the given text.
   * Returns a Float32Array suitable for storage as a blob.
   * Runs in a worker thread to avoid blocking the event loop.
   */
  embed = async (text: string): Promise<Float32Array> => {
    const response = await this.#request({ type: "embed", text });
    if (response.type !== "embed") throw new Error("Unexpected response type");
    return response.embedding;
  };

  /**
   * Classify text against candidate labels using zero-shot NLI.
   * Returns an array of { label, score } sorted by score descending.
   * Runs in a worker thread to avoid blocking the event loop.
   */
  classify = async (
    text: string,
    labels: string[],
  ): Promise<Array<{ label: string; score: number }>> => {
    if (labels.length === 0) return [];

    const response = await this.#request({ type: "classify", text, labels });
    if (response.type !== "classify") throw new Error("Unexpected response type");
    return response.results;
  };

  /**
   * Re-enqueue analysis for all extracted-but-unanalysed articles.
   * Called on startup to recover from interrupted analysis.
   */
  recoverPendingAnalysis = async (): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const taskService = this.#services.get(TaskService);

    const pending = await db
      .selectFrom("articles")
      .select("id")
      .where("extracted_at", "is not", null)
      .where("analysed_at", "is", null)
      .execute();

    for (const article of pending) {
      taskService.enqueue<AnalyseArticlePayload>("analyse_article", {
        articleId: article.id,
      });
    }

    return pending.length;
  };

  /**
   * Mark all articles for a source as needing re-analysis.
   * Clears existing focus classifications and re-enqueues analysis tasks.
   */
  reanalyseSource = async (sourceId: string, userId?: string): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const taskService = this.#services.get(TaskService);

    // Backfill extracted_at for articles that have feed content (content or summary)
    // but were never marked as extracted. This handles podcast episodes stored before
    // the podcast feature was added, or sources created with an incorrect type.
    await db
      .updateTable("articles")
      .set({ extracted_at: new Date().toISOString() })
      .where("source_id", "=", sourceId)
      .where("extracted_at", "is", null)
      .where((eb) => eb.or([
        eb("content", "is not", null),
        eb("summary", "is not", null),
      ]))
      .execute();

    // Get all extracted articles for this source
    const articles = await db
      .selectFrom("articles")
      .select("id")
      .where("source_id", "=", sourceId)
      .where("extracted_at", "is not", null)
      .execute();

    if (articles.length === 0) return 0;

    const articleIds = articles.map((a) => a.id);

    // Clear existing classifications for these articles
    await db
      .deleteFrom("article_focuses")
      .where("article_id", "in", articleIds)
      .execute();

    // Reset analysed_at so they get picked up
    await db
      .updateTable("articles")
      .set({ analysed_at: null })
      .where("id", "in", articleIds)
      .execute();

    // Enqueue analysis tasks
    for (const article of articles) {
      taskService.enqueue<AnalyseArticlePayload>("analyse_article", {
        articleId: article.id,
      }, { userId });
    }

    return articles.length;
  };

  /**
   * Re-analyse all extracted articles across all sources.
   * Clears existing focus classifications and re-enqueues analysis tasks.
   */
  reanalyseAll = async (userId?: string): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const taskService = this.#services.get(TaskService);

    const articles = await db
      .selectFrom("articles")
      .select("id")
      .where("extracted_at", "is not", null)
      .execute();

    if (articles.length === 0) return 0;

    const articleIds = articles.map((a) => a.id);

    await db
      .deleteFrom("article_focuses")
      .where("article_id", "in", articleIds)
      .execute();

    await db
      .updateTable("articles")
      .set({ analysed_at: null })
      .where("id", "in", articleIds)
      .execute();

    for (const article of articles) {
      taskService.enqueue<AnalyseArticlePayload>("analyse_article", {
        articleId: article.id,
      }, { userId });
    }

    return articles.length;
  };

  [destroySymbol] = async (): Promise<void> => {
    if (this.#worker) {
      this.#worker.postMessage({ type: "shutdown" });
      await this.#worker.terminate();
      this.#worker = null;
    }
    // Reject any remaining pending requests
    for (const [id, pending] of this.#pending) {
      pending.reject(new Error("Analysis service destroyed"));
      this.#pending.delete(id);
    }
  };
}

// --- Task handler ---

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const handleAnalyseArticle = async (
  payload: AnalyseArticlePayload,
  services: Services,
): Promise<AnalysisResult | undefined> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysisService = services.get(AnalysisService);

  // Load article with source info
  const article = await db
    .selectFrom("articles")
    .innerJoin("sources", "sources.id", "articles.source_id")
    .select([
      "articles.id",
      "articles.source_id",
      "articles.title",
      "articles.summary",
      "articles.content",
      "articles.analysed_at",
      "sources.type as source_type",
    ])
    .where("articles.id", "=", payload.articleId)
    .executeTakeFirst();

  if (!article) return undefined;

  // Skip if already analysed
  if (article.analysed_at) return undefined;

  // --- Focus classification ---

  // Find all focuses that reference this article's source
  const focusLinks = await db
    .selectFrom("focus_sources")
    .innerJoin("focuses", "focuses.id", "focus_sources.focus_id")
    .select([
      "focus_sources.focus_id",
      "focus_sources.mode",
      "focuses.name",
      "focuses.description",
    ])
    .where("focus_sources.source_id", "=", article.source_id)
    .execute();

  let focusMatches = 0;
  let embeddingDimensions = 0;

  // Handle "always" mode — direct assignment with confidence 1.0, no text needed
  const alwaysFocuses = focusLinks.filter((f) => f.mode === "always");
  for (const focus of alwaysFocuses) {
    await db
      .insertInto("article_focuses")
      .values({
        article_id: article.id,
        focus_id: focus.focus_id,
        confidence: 1.0,
      })
      .onConflict((oc) =>
        oc.columns(["article_id", "focus_id"]).doUpdateSet({
          confidence: 1.0,
          assigned_at: new Date().toISOString(),
        }),
      )
      .execute();
    focusMatches++;
  }

  // Podcast episodes use summary/show notes from the feed rather than extracted page content
  const textSource = article.content ?? (article.source_type === "podcast" ? article.summary : null);

  const matchFocuses = focusLinks.filter((f) => f.mode === "match");

  if (textSource) {
    const plainText = stripHtml(textSource);
    // Prepend title for better topic signal
    const inputText = `${article.title}. ${plainText}`.slice(0, 2000);

    // --- Embedding (runs in worker) ---
    const embedding = await analysisService.embed(inputText);
    embeddingDimensions = embedding.length;
    const embeddingBuffer = Buffer.from(embedding.buffer);

    // Store embedding (upsert)
    await db
      .insertInto("article_embeddings")
      .values({
        article_id: article.id,
        embedding: embeddingBuffer,
        model: DEFAULT_EMBEDDING_MODEL,
      })
      .onConflict((oc) =>
        oc.column("article_id").doUpdateSet({
          embedding: embeddingBuffer,
          model: DEFAULT_EMBEDDING_MODEL,
          created_at: new Date().toISOString(),
        }),
      )
      .execute();

    // Handle "match" mode — zero-shot classification (runs in worker)
    if (matchFocuses.length > 0) {
      // Build labels from focus name + description
      const labels = matchFocuses.map((f) =>
        f.description ? `${f.name}: ${f.description}` : f.name,
      );

      const scores = await analysisService.classify(inputText, labels);

      // Map scores back to focuses and insert above threshold
      for (const { label, score } of scores) {
        if (score < DEFAULT_CONFIDENCE_THRESHOLD) continue;

        const focusIndex = labels.indexOf(label);
        if (focusIndex === -1) continue;

        const focus = matchFocuses[focusIndex]!;
        await db
          .insertInto("article_focuses")
          .values({
            article_id: article.id,
            focus_id: focus.focus_id,
            confidence: Math.round(score * 1000) / 1000, // 3 decimal places
          })
          .onConflict((oc) =>
            oc.columns(["article_id", "focus_id"]).doUpdateSet({
              confidence: Math.round(score * 1000) / 1000,
              assigned_at: new Date().toISOString(),
            }),
          )
          .execute();
        focusMatches++;
      }
    }
  }

  // Mark article as analysed
  await db
    .updateTable("articles")
    .set({ analysed_at: new Date().toISOString() })
    .where("id", "=", article.id)
    .execute();

  return {
    articleId: article.id,
    embeddingDimensions,
    focusMatches,
  };
};

// --- Registration ---

const registerAnalysisTaskHandlers = (services: Services): void => {
  const taskService = services.get(TaskService);
  taskService.register<AnalyseArticlePayload>("analyse_article", handleAnalyseArticle);
};

export type { AnalyseArticlePayload, AnalysisResult };
export { AnalysisService, registerAnalysisTaskHandlers, DEFAULT_EMBEDDING_MODEL };
