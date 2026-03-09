import crypto from "node:crypto";

import { Services } from "../services/services.ts";
import { destroySymbol } from "../services/services.ts";

// --- Types ---

type TaskStatus = "pending" | "running" | "completed" | "failed";

type Task<T = unknown> = {
  id: string;
  type: string;
  status: TaskStatus;
  userId: string | null;
  payload: T;
  result: unknown;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type EnqueueOptions = {
  userId?: string;
};

type TaskHandler<T = unknown> = (payload: T, services: Services) => Promise<unknown>;

// --- Constants ---

const DEFAULT_CONCURRENCY = 8;

// --- Service ---

class TaskService {
  #services: Services;
  #handlers = new Map<string, TaskHandler>();
  #tasks = new Map<string, Task>();
  #queue: string[] = [];
  #running = 0;
  #concurrency: number;

  constructor(services: Services, concurrency = DEFAULT_CONCURRENCY) {
    this.#services = services;
    this.#concurrency = concurrency;
  }

  register = <T>(type: string, handler: TaskHandler<T>): void => {
    this.#handlers.set(type, handler as TaskHandler);
  };

  enqueue = <T>(type: string, payload: T, options?: EnqueueOptions): Task<T> => {
    const task: Task<T> = {
      id: crypto.randomUUID(),
      type,
      status: "pending",
      userId: options?.userId ?? null,
      payload,
      result: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.#tasks.set(task.id, task as Task);
    this.#queue.push(task.id);
    this.#drain();

    return task;
  };

  get = (id: string): Task | undefined => {
    return this.#tasks.get(id);
  };

  listByUser = (userId: string): Task[] => {
    const tasks: Task[] = [];
    for (const task of this.#tasks.values()) {
      if (task.userId === userId) {
        tasks.push(task);
      }
    }
    // Most recent first
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    return tasks;
  };

  #drain = (): void => {
    while (this.#running < this.#concurrency && this.#queue.length > 0) {
      const id = this.#queue.shift()!;
      const task = this.#tasks.get(id);
      if (!task) continue;

      const handler = this.#handlers.get(task.type);
      if (!handler) {
        task.status = "failed";
        task.error = `No handler registered for task type: ${task.type}`;
        task.completedAt = Date.now();
        continue;
      }

      task.status = "running";
      task.startedAt = Date.now();
      this.#running++;

      void this.#run(task, handler);
    }
  };

  #run = async (task: Task, handler: TaskHandler): Promise<void> => {
    try {
      task.result = await handler(task.payload, this.#services);
      task.status = "completed";
    } catch (err) {
      task.status = "failed";
      task.error = err instanceof Error
        ? [err.message, err.stack].filter(Boolean).join("\n")
        : String(err);
    }

    task.completedAt = Date.now();
    this.#running--;
    this.#drain();
  };

  [destroySymbol] = (): void => {
    this.#queue.length = 0;
    this.#tasks.clear();
  };
}

export type { Task, TaskHandler, TaskStatus, EnqueueOptions };
export { TaskService };
