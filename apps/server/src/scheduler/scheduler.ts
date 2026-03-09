import { Cron } from "croner";

import { DatabaseService } from "../database/database.ts";
import { EditionsService } from "../editions/editions.ts";
import { destroySymbol } from "../services/services.ts";
import { TaskService } from "../tasks/tasks.ts";

import type { FetchSourcePayload } from "../sources/sources.fetch.ts";
import type { Services } from "../services/services.ts";

// --- Types ---

type SchedulerConfig = {
  enabled: boolean;
  fetchIntervalMinutes: number;
};

type SchedulerLog = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

// --- Service ---

class SchedulerService {
  #services: Services;
  #config: SchedulerConfig;
  #interval: ReturnType<typeof setInterval> | null = null;
  #log: SchedulerLog;
  #running = false;

  constructor(services: Services, config: SchedulerConfig, log: SchedulerLog) {
    this.#services = services;
    this.#config = config;
    this.#log = log;
  }

  start = (): void => {
    if (!this.#config.enabled) {
      this.#log.info("Scheduler disabled");
      return;
    }

    this.#log.info(
      `Scheduler started (fetch interval: ${this.#config.fetchIntervalMinutes}m)`,
    );

    // Run immediately on start, then every 60 seconds
    void this.#tick();
    this.#interval = setInterval(() => void this.#tick(), 60_000);
  };

  #tick = async (): Promise<void> => {
    if (this.#running) return;
    this.#running = true;

    try {
      await this.#fetchDueSources();
      await this.#generateDueEditions();
    } catch (err) {
      this.#log.error(
        `Scheduler tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.#running = false;
    }
  };

  #fetchDueSources = async (): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const taskService = this.#services.get(TaskService);

    const cutoff = new Date(
      Date.now() - this.#config.fetchIntervalMinutes * 60 * 1000,
    ).toISOString();

    // Find all RSS sources that haven't been fetched recently
    const dueSources = await db
      .selectFrom("sources")
      .select(["id", "user_id", "name"])
      .where("type", "=", "rss")
      .where((eb) =>
        eb.or([
          eb("last_fetched_at", "is", null),
          eb("last_fetched_at", "<", cutoff),
        ]),
      )
      .execute();

    for (const source of dueSources) {
      taskService.enqueue<FetchSourcePayload>(
        "fetch_source",
        { sourceId: source.id, userId: source.user_id },
        { userId: source.user_id },
      );
    }

    if (dueSources.length > 0) {
      this.#log.info(`Scheduled fetch for ${dueSources.length} source(s)`);
    }
  };

  #generateDueEditions = async (): Promise<void> => {
    const db = await this.#services.get(DatabaseService).getInstance();
    const editionsService = this.#services.get(EditionsService);

    // Find all enabled edition configs
    const configs = await db
      .selectFrom("edition_configs")
      .select(["id", "user_id", "name", "schedule"])
      .where("enabled", "=", 1)
      .execute();

    const now = new Date();

    for (const config of configs) {
      try {
        if (!config.schedule) continue;

        const cron = new Cron(config.schedule);

        // Find the most recent edition for this config
        const lastEdition = await db
          .selectFrom("editions")
          .select("published_at")
          .where("edition_config_id", "=", config.id)
          .orderBy("published_at", "desc")
          .limit(1)
          .executeTakeFirst();

        const since = lastEdition
          ? new Date(lastEdition.published_at)
          : new Date(now.getTime() - 24 * 60 * 60 * 1000); // default: look back 24h

        // Check if the cron should have fired between the last edition and now
        const nextRun = cron.nextRun(since);
        if (!nextRun || nextRun > now) continue;

        this.#log.info(`Generating edition for "${config.name}"`);
        const edition = await editionsService.generate(config.user_id, config.id);
        this.#log.info(
          `Generated "${edition.title}" (${edition.articleCount} articles)`,
        );
      } catch (err) {
        this.#log.error(
          `Failed to generate edition "${config.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  [destroySymbol] = (): void => {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  };
}

export type { SchedulerConfig };
export { SchedulerService };
