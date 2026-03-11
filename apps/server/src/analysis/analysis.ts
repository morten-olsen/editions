import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { ConfigService } from "../config/config.ts";
import { DatabaseService } from "../database/database.ts";
import { TaskService } from "../tasks/tasks.ts";
import { destroySymbol } from "../services/services.ts";
import {
  reconcile,
  createNliStrategy,
  createSimilarityStrategy,
  createHybridStrategy,
} from "./analysis.reconcile.ts";

import type { WorkerResponse } from "./analysis.worker.ts";
import type { Services } from "../services/services.ts";
import type { ClassifierStrategy, ReconcileResult } from "./analysis.reconcile.ts";

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

const WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "analysis.worker.ts",
);

// --- Types ---

type AnalyseArticlePayload = {
  articleId: string;
};

type ReconcileFocusPayload = {
  focusId: string;
  forceReclassify?: boolean;
};

type ReanalyseSourcePayload = {
  sourceId: string;
};

type ReanalyseAllPayload = Record<string, never>;

type AnalysisResult = ReconcileResult;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

// --- Service ---

class AnalysisService {
  #services: Services;
  #worker: Worker | null = null;
  #pending = new Map<string, PendingRequest>();
  #strategy: ClassifierStrategy;

  constructor(services: Services) {
    this.#services = services;
    const { analysis } = services.get(ConfigService).config;
    this.#strategy = this.#createStrategy(analysis.classifier);
  }

  #createStrategy = (classifier: "nli" | "similarity" | "hybrid"): ClassifierStrategy => {
    switch (classifier) {
      case "nli":
        return createNliStrategy(this.classify);
      case "similarity":
        return createSimilarityStrategy(this.embed);
      case "hybrid":
        return createHybridStrategy(this.embed, this.classify);
    }
  };

  // --- Strategy configuration ---

  setStrategy = (strategy: ClassifierStrategy): void => {
    this.#strategy = strategy;
  };

  // --- Worker lifecycle ---

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
        for (const [id, pending] of this.#pending) {
          pending.reject(err);
          this.#pending.delete(id);
        }
        this.#worker = null;
      });

      this.#worker.on("exit", () => {
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

  // --- Inference primitives ---

  embed = async (text: string): Promise<Float32Array> => {
    const response = await this.#request({ type: "embed", text });
    if (response.type !== "embed") throw new Error("Unexpected response type");
    return response.embedding;
  };

  classify = async (
    text: string,
    labels: string[],
  ): Promise<Array<{ label: string; score: number }>> => {
    if (labels.length === 0) return [];

    const response = await this.#request({ type: "classify", text, labels });
    if (response.type !== "classify")
      throw new Error("Unexpected response type");
    return response.results;
  };

  // --- Reconciliation (public API) ---

  /**
   * Analyse a batch of articles, bringing each to its ideal state:
   *  1. Compute missing embeddings
   *  2. Classify against all linked focuses that lack assignments
   *  3. Mark articles as analysed
   *
   * Idempotent — re-running on already-analysed articles is a no-op
   * for each individual step (embeddings and assignments are checked
   * before processing).
   */
  reconcile = async (
    articleIds: string[],
    options?: {
      focusIds?: string[];
      skipEmbedding?: boolean;
      forceReclassify?: boolean;
    },
  ): Promise<ReconcileResult> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    return reconcile(articleIds, db, this.embed, this.#strategy, {
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      ...options,
    });
  };

  /**
   * Classify all extracted articles from a focus's linked sources against
   * that focus. Skips embedding (articles should already have them).
   * Used when a focus is created or its name/description changes.
   */
  reconcileFocus = async (focusId: string, options?: { forceReclassify?: boolean }): Promise<ReconcileResult> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Find all sources linked to this focus
    const sourceLinks = await db
      .selectFrom("focus_sources")
      .select("source_id")
      .where("focus_id", "=", focusId)
      .execute();

    if (sourceLinks.length === 0) {
      return { articlesLoaded: 0, articlesEmbedded: 0, assignmentsCreated: 0 };
    }

    const sourceIds = sourceLinks.map((l) => l.source_id);

    // Find all extracted articles from those sources
    const articles = await db
      .selectFrom("articles")
      .select("id")
      .where("source_id", "in", sourceIds)
      .where("extracted_at", "is not", null)
      .execute();

    if (articles.length === 0) {
      return { articlesLoaded: 0, articlesEmbedded: 0, assignmentsCreated: 0 };
    }

    const articleIds = articles.map((a) => a.id);

    return reconcile(articleIds, db, this.embed, this.#strategy, {
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      focusIds: [focusId],
      skipEmbedding: true,
      forceReclassify: options?.forceReclassify,
    });
  };

  // --- Recovery & bulk re-analysis ---

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

  reanalyseSource = async (sourceId: string, userId?: string): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Backfill extracted_at for articles that have feed content but were
    // never marked as extracted (e.g. podcast episodes stored before the
    // podcast feature, or sources created with an incorrect type).
    await db
      .updateTable("articles")
      .set({ extracted_at: new Date().toISOString() })
      .where("source_id", "=", sourceId)
      .where("extracted_at", "is", null)
      .where((eb) =>
        eb.or([
          eb("content", "is not", null),
          eb("summary", "is not", null),
        ]),
      )
      .execute();

    const count = await db
      .selectFrom("articles")
      .select(db.fn.countAll().as("count"))
      .where("source_id", "=", sourceId)
      .where("extracted_at", "is not", null)
      .executeTakeFirstOrThrow();

    if (Number(count.count) === 0) return 0;

    this.#services
      .get(TaskService)
      .enqueue<ReanalyseSourcePayload>("reanalyse_source", { sourceId }, { userId });

    return Number(count.count);
  };

  reanalyseAll = async (userId?: string): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const count = await db
      .selectFrom("articles")
      .select(db.fn.countAll().as("count"))
      .where("extracted_at", "is not", null)
      .executeTakeFirstOrThrow();

    if (Number(count.count) === 0) return 0;

    this.#services
      .get(TaskService)
      .enqueue<ReanalyseAllPayload>("reanalyse_all", {}, { userId });

    return Number(count.count);
  };

  // --- Cleanup ---

  [destroySymbol] = async (): Promise<void> => {
    if (this.#worker) {
      this.#worker.postMessage({ type: "shutdown" });
      await this.#worker.terminate();
      this.#worker = null;
    }
    for (const [id, pending] of this.#pending) {
      pending.reject(new Error("Analysis service destroyed"));
      this.#pending.delete(id);
    }
  };
}

// --- Task handler ---

const handleAnalyseArticle = async (
  payload: AnalyseArticlePayload,
  services: Services,
): Promise<ReconcileResult | undefined> => {
  const db = await services.get(DatabaseService).getInstance();

  // Quick check — skip if already analysed
  const article = await db
    .selectFrom("articles")
    .select(["id", "analysed_at"])
    .where("id", "=", payload.articleId)
    .executeTakeFirst();

  if (!article || article.analysed_at) return undefined;

  return services.get(AnalysisService).reconcile([payload.articleId]);
};

const handleReconcileFocus = async (
  payload: ReconcileFocusPayload,
  services: Services,
): Promise<ReconcileResult> => {
  return services.get(AnalysisService).reconcileFocus(payload.focusId, {
    forceReclassify: payload.forceReclassify,
  });
};

const handleReanalyseSource = async (
  payload: ReanalyseSourcePayload,
  services: Services,
): Promise<ReconcileResult> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);

  const articles = await db
    .selectFrom("articles")
    .select("id")
    .where("source_id", "=", payload.sourceId)
    .where("extracted_at", "is not", null)
    .execute();

  if (articles.length === 0) {
    return { articlesLoaded: 0, articlesEmbedded: 0, assignmentsCreated: 0 };
  }

  const articleIds = articles.map((a) => a.id);

  // Clear existing state
  await db.deleteFrom("article_focuses").where("article_id", "in", articleIds).execute();
  await db.updateTable("articles").set({ analysed_at: null }).where("id", "in", articleIds).execute();

  return analysis.reconcile(articleIds);
};

const handleReanalyseAll = async (
  _payload: ReanalyseAllPayload,
  services: Services,
): Promise<ReconcileResult> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);

  const articles = await db
    .selectFrom("articles")
    .select("id")
    .where("extracted_at", "is not", null)
    .execute();

  if (articles.length === 0) {
    return { articlesLoaded: 0, articlesEmbedded: 0, assignmentsCreated: 0 };
  }

  const articleIds = articles.map((a) => a.id);

  await db.deleteFrom("article_focuses").where("article_id", "in", articleIds).execute();
  await db.updateTable("articles").set({ analysed_at: null }).where("id", "in", articleIds).execute();

  return analysis.reconcile(articleIds);
};

// --- Registration ---

const registerAnalysisTaskHandlers = (services: Services): void => {
  const taskService = services.get(TaskService);
  taskService.register<AnalyseArticlePayload>(
    "analyse_article",
    handleAnalyseArticle,
  );
  taskService.register<ReconcileFocusPayload>(
    "reconcile_focus",
    handleReconcileFocus,
  );
  taskService.register<ReanalyseSourcePayload>(
    "reanalyse_source",
    handleReanalyseSource,
  );
  taskService.register<ReanalyseAllPayload>(
    "reanalyse_all",
    handleReanalyseAll,
  );
};

export type { AnalyseArticlePayload, ReconcileFocusPayload, AnalysisResult };
export { AnalysisService, registerAnalysisTaskHandlers, DEFAULT_EMBEDDING_MODEL };
