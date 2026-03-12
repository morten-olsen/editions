import crypto from "node:crypto";

import { AnalysisService } from "../analysis/analysis.ts";
import { ConfigService } from "../config/config.ts";
import { DatabaseService } from "../database/database.ts";
import { SourcesService } from "../sources/sources.ts";
import { JobService } from "./jobs.ts";
import {
  runReconcileSteps,
  createReconcileSteps,
} from "../analysis/analysis.reconcile.ts";
import { parseRssFeed } from "../sources/sources.fetch.ts";

import type { Services } from "../services/services.ts";
import type { Job } from "./jobs.ts";
import type { ProgressCallback } from "../analysis/analysis.reconcile.ts";

// --- Payload types ---

type RefreshSourcePayload = {
  sourceId: string;
  userId: string;
};

type ReconcileFocusPayload = {
  focusId: string;
  forceReclassify?: boolean;
};

type ReanalyseSourcePayload = {
  sourceId: string;
};

type ReanalyseAllPayload = Record<string, never>;

type ExtractAndAnalysePayload = {
  sourceId: string;
  userId: string;
};

// --- Progress wiring ---

const jobProgress = (job: Job): ProgressCallback => (progress) => {
  job.progress = progress;
};

// --- Handlers ---

const handleRefreshSource = async (
  payload: RefreshSourcePayload,
  services: Services,
  job: Job,
): Promise<void> => {
  const sourcesService = services.get(SourcesService);
  const source = await sourcesService.get(payload.userId, payload.sourceId);
  const db = await services.get(DatabaseService).getInstance();

  let items: ReturnType<typeof parseRssFeed>;
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xml = await response.text();
    items = parseRssFeed(xml);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .updateTable("sources")
      .set({ fetch_error: errorMsg, updated_at: new Date().toISOString() })
      .where("id", "=", source.id)
      .execute();
    throw err;
  }

  const now = new Date().toISOString();
  await db
    .updateTable("sources")
    .set({ fetch_error: null, last_fetched_at: now, updated_at: now })
    .where("id", "=", source.id)
    .execute();

  const isPodcast = source.type === "podcast";

  for (const item of items) {
    const id = crypto.randomUUID();

    let content = item.content;
    if (isPodcast && item.imageUrl && content) {
      const escapedUrl = item.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const stripped = content
        .replace(new RegExp(`<img[^>]*src=["']${escapedUrl}["'][^>]*/?>`, "gi"), "")
        .trim();
      content = stripped || null;
    }

    await db
      .insertInto("articles")
      .values({
        id,
        source_id: source.id,
        external_id: item.externalId,
        url: item.url,
        title: item.title,
        author: item.author,
        summary: item.summary,
        content,
        image_url: item.imageUrl,
        published_at: item.publishedAt,
        media_url: item.mediaUrl,
        media_type: item.mediaType,
        consumption_time_seconds: item.consumptionTimeSeconds,
        ...(isPodcast ? { extracted_at: new Date().toISOString() } : {}),
      })
      .onConflict((oc) => oc.columns(["source_id", "external_id"]).doNothing())
      .execute();
  }

  // Run reconcile steps for this source
  const analysis = services.get(AnalysisService);
  const { config } = services.get(ConfigService);

  // Find focus IDs linked to this source
  const focusLinks = await db
    .selectFrom("focus_sources")
    .select("focus_id")
    .where("source_id", "=", source.id)
    .execute();

  const steps = createReconcileSteps({
    db,
    embedFn: analysis.embed,
    classifyFn: analysis.classify,
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    classifier: config.analysis.classifier,
    scopeFilter: { sourceIds: [source.id] },
  });

  await runReconcileSteps(steps, jobProgress(job));

  // Update affects with linked focuses
  job.affects.focusIds = focusLinks.map((l) => l.focus_id);
};

const handleReconcileFocus = async (
  payload: ReconcileFocusPayload,
  services: Services,
  job: Job,
): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);
  const { config } = services.get(ConfigService);

  if (payload.forceReclassify) {
    // Clear existing classifications for this focus so they'll be recomputed
    await db
      .deleteFrom("article_focuses")
      .where("focus_id", "=", payload.focusId)
      .execute();
  }

  // Find sources linked to this focus
  const sourceLinks = await db
    .selectFrom("focus_sources")
    .select("source_id")
    .where("focus_id", "=", payload.focusId)
    .execute();

  const sourceIds = sourceLinks.map((l) => l.source_id);
  job.affects.sourceIds = sourceIds;

  const steps = createReconcileSteps({
    db,
    embedFn: analysis.embed,
    classifyFn: analysis.classify,
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    classifier: config.analysis.classifier,
    scopeFilter: { focusIds: [payload.focusId] },
    skipExtract: true,
  });

  await runReconcileSteps(steps, jobProgress(job));
};

const handleReanalyseSource = async (
  payload: ReanalyseSourcePayload,
  services: Services,
  job: Job,
): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);
  const { config } = services.get(ConfigService);

  // Backfill extracted_at for articles that have content but were never marked
  await db
    .updateTable("articles")
    .set({ extracted_at: new Date().toISOString() })
    .where("source_id", "=", payload.sourceId)
    .where("extracted_at", "is", null)
    .where((eb) =>
      eb.or([
        eb("content", "is not", null),
        eb("summary", "is not", null),
      ]),
    )
    .execute();

  // Clear existing state
  const articleIds = await db
    .selectFrom("articles")
    .select("id")
    .where("source_id", "=", payload.sourceId)
    .where("extracted_at", "is not", null)
    .execute();

  if (articleIds.length > 0) {
    const ids = articleIds.map((a) => a.id);
    await db.deleteFrom("article_focuses").where("article_id", "in", ids).execute();
    await db.updateTable("articles").set({ analysed_at: null }).where("id", "in", ids).execute();
  }

  // Find focus IDs linked to this source
  const focusLinks = await db
    .selectFrom("focus_sources")
    .select("focus_id")
    .where("source_id", "=", payload.sourceId)
    .execute();
  job.affects.focusIds = focusLinks.map((l) => l.focus_id);

  const steps = createReconcileSteps({
    db,
    embedFn: analysis.embed,
    classifyFn: analysis.classify,
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    classifier: config.analysis.classifier,
    scopeFilter: { sourceIds: [payload.sourceId] },
  });

  await runReconcileSteps(steps, jobProgress(job));
};

const handleReanalyseAll = async (
  _payload: ReanalyseAllPayload,
  services: Services,
  job: Job,
): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);
  const { config } = services.get(ConfigService);

  const articleIds = await db
    .selectFrom("articles")
    .select("id")
    .where("extracted_at", "is not", null)
    .execute();

  if (articleIds.length > 0) {
    const ids = articleIds.map((a) => a.id);
    await db.deleteFrom("article_focuses").where("article_id", "in", ids).execute();
    await db.updateTable("articles").set({ analysed_at: null }).where("id", "in", ids).execute();
  }

  const steps = createReconcileSteps({
    db,
    embedFn: analysis.embed,
    classifyFn: analysis.classify,
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    classifier: config.analysis.classifier,
  });

  await runReconcileSteps(steps, jobProgress(job));
};

const handleExtractAndAnalyse = async (
  payload: ExtractAndAnalysePayload,
  services: Services,
  job: Job,
): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();
  const analysis = services.get(AnalysisService);
  const { config } = services.get(ConfigService);

  const steps = createReconcileSteps({
    db,
    embedFn: analysis.embed,
    classifyFn: analysis.classify,
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    classifier: config.analysis.classifier,
    scopeFilter: { sourceIds: [payload.sourceId] },
  });

  await runReconcileSteps(steps, jobProgress(job));
};

// --- Registration ---

const registerJobHandlers = (services: Services): void => {
  const jobService = services.get(JobService);
  jobService.register<RefreshSourcePayload>("refresh_source", handleRefreshSource);
  jobService.register<ReconcileFocusPayload>("reconcile_focus", handleReconcileFocus);
  jobService.register<ReanalyseSourcePayload>("reanalyse_source", handleReanalyseSource);
  jobService.register<ReanalyseAllPayload>("reanalyse_all", handleReanalyseAll);
  jobService.register<ExtractAndAnalysePayload>("extract_and_analyse", handleExtractAndAnalyse);
};

export type { RefreshSourcePayload, ReconcileFocusPayload, ReanalyseSourcePayload, ReanalyseAllPayload, ExtractAndAnalysePayload };
export { registerJobHandlers };
