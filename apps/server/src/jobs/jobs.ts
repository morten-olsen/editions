import crypto from "node:crypto";

import { destroySymbol } from "../services/services.ts";

import type { Services } from "../services/services.ts";

// --- Types ---

type JobStatus = "pending" | "running" | "completed" | "failed";

type JobAffects = {
  sourceIds: string[];
  focusIds: string[];
};

type JobProgress = {
  phase: string;
  completed: number;
  total: number;
} | null;

type Job = {
  id: string;
  type: string;
  status: JobStatus;
  userId: string | null;
  affects: JobAffects;
  progress: JobProgress;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type EnqueueOptions = {
  userId?: string;
  affects?: Partial<JobAffects>;
};

type JobHandler<T = unknown> = (payload: T, services: Services, job: Job) => Promise<void>;

type ListJobsFilter = {
  active?: boolean;
  sourceId?: string;
  focusId?: string;
};

// --- Constants ---

const DEFAULT_CONCURRENCY = 8;
const GC_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// --- Service ---

class JobService {
  #services: Services;
  #handlers = new Map<string, JobHandler>();
  #jobs = new Map<string, Job>();
  #payloads = new Map<string, unknown>();
  #queue: string[] = [];
  #running = 0;
  #concurrency: number;

  constructor(services: Services, concurrency = DEFAULT_CONCURRENCY) {
    this.#services = services;
    this.#concurrency = concurrency;
  }

  register = <T>(type: string, handler: JobHandler<T>): void => {
    this.#handlers.set(type, handler as JobHandler);
  };

  enqueue = <T>(type: string, payload: T, options?: EnqueueOptions): Job => {
    const job: Job = {
      id: crypto.randomUUID(),
      type,
      status: "pending",
      userId: options?.userId ?? null,
      affects: {
        sourceIds: options?.affects?.sourceIds ?? [],
        focusIds: options?.affects?.focusIds ?? [],
      },
      progress: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.#jobs.set(job.id, job);
    this.#payloads.set(job.id, payload);
    this.#queue.push(job.id);
    this.#drain();

    return job;
  };

  get = (id: string): Job | undefined => {
    return this.#jobs.get(id);
  };

  listByUser = (userId: string, filter?: ListJobsFilter): Job[] => {
    this.#gc();

    const jobs: Job[] = [];
    for (const job of this.#jobs.values()) {
      if (job.userId !== userId) continue;

      if (filter?.active !== undefined) {
        const isActive = job.status === "pending" || job.status === "running";
        if (filter.active !== isActive) continue;
      }

      if (filter?.sourceId) {
        const matches =
          job.affects.sourceIds.length === 0 ||
          job.affects.sourceIds.includes(filter.sourceId);
        if (!matches) continue;
      }

      if (filter?.focusId) {
        const matches =
          job.affects.focusIds.length === 0 ||
          job.affects.focusIds.includes(filter.focusId);
        if (!matches) continue;
      }

      jobs.push(job);
    }

    jobs.sort((a, b) => b.createdAt - a.createdAt);
    return jobs;
  };

  #gc = (): void => {
    const cutoff = Date.now() - GC_MAX_AGE_MS;
    for (const [id, job] of this.#jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt !== null &&
        job.completedAt < cutoff
      ) {
        this.#jobs.delete(id);
        this.#payloads.delete(id);
      }
    }
  };

  #drain = (): void => {
    while (this.#running < this.#concurrency && this.#queue.length > 0) {
      const id = this.#queue.shift()!;
      const job = this.#jobs.get(id);
      if (!job) continue;

      const handler = this.#handlers.get(job.type);
      if (!handler) {
        job.status = "failed";
        job.error = `No handler registered for job type: ${job.type}`;
        job.completedAt = Date.now();
        continue;
      }

      job.status = "running";
      job.startedAt = Date.now();
      this.#running++;

      void this.#run(job, handler);
    }
  };

  #run = async (job: Job, handler: JobHandler): Promise<void> => {
    try {
      const payload = this.#payloads.get(job.id);
      await handler(payload, this.#services, job);
      job.status = "completed";
    } catch (err) {
      job.status = "failed";
      job.error = err instanceof Error
        ? [err.message, err.stack].filter(Boolean).join("\n")
        : String(err);
    }

    job.completedAt = Date.now();
    this.#running--;
    this.#drain();
  };

  [destroySymbol] = (): void => {
    this.#queue.length = 0;
    this.#jobs.clear();
    this.#payloads.clear();
  };
}

export type { Job, JobHandler, JobStatus, JobAffects, JobProgress, EnqueueOptions, ListJobsFilter };
export { JobService };
