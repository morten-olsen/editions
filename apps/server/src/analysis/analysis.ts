import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { DatabaseService } from "../database/database.ts";
import { JobService } from "../jobs/jobs.ts";
import { destroySymbol } from "../services/services.ts";

import type { ReanalyseSourcePayload, ReanalyseAllPayload } from "../jobs/jobs.handlers.ts";
import type { WorkerResponse } from "./analysis.worker.ts";
import type { Services } from "../services/services.ts";

// --- Constants ---

const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

const WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "analysis.worker.ts",
);

// --- Types ---

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

  // --- Batch inference primitives ---

  embedBatch = async (texts: string[]): Promise<Float32Array[]> => {
    if (texts.length === 0) return [];
    const response = await this.#request({ type: "embed_batch", texts });
    if (response.type !== "embed_batch") throw new Error("Unexpected response type");
    return response.embeddings;
  };

  classifyBatch = async (
    items: Array<{ text: string; labels: string[] }>,
  ): Promise<Array<Array<{ label: string; score: number }>>> => {
    if (items.length === 0) return [];
    const response = await this.#request({ type: "classify_batch", items });
    if (response.type !== "classify_batch") throw new Error("Unexpected response type");
    return response.results;
  };

  // --- Recovery & bulk re-analysis ---

  recoverPendingAnalysis = async (): Promise<number> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const countResult = await db
      .selectFrom("articles")
      .select(db.fn.countAll().as("count"))
      .where("extracted_at", "is not", null)
      .where("analysed_at", "is", null)
      .executeTakeFirstOrThrow();

    const count = Number(countResult.count);
    if (count > 0) {
      const jobService = this.#services.get(JobService);
      jobService.enqueue<Record<string, never>>("reanalyse_all", {}, {});
    }

    return count;
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
      .get(JobService)
      .enqueue<ReanalyseSourcePayload>("reanalyse_source", { sourceId }, { userId, affects: { sourceIds: [sourceId] } });

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
      .get(JobService)
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

export { AnalysisService, DEFAULT_EMBEDDING_MODEL };
