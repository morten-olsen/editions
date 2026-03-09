import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import { TaskService } from "../tasks/tasks.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const taskSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  error: z.string().nullable(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});

const taskListSchema = z.object({
  tasks: z.array(taskSchema),
});

const taskIdParamSchema = z.object({
  taskId: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// --- Routes ---

const createTasksRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    // List tasks for the current user
    fastify.route({
      method: "GET",
      url: "/tasks",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: taskListSchema,
        },
      },
      handler: async (req, _reply) => {
        const taskService = services.get(TaskService);
        const tasks = taskService.listByUser(req.user.sub);
        return {
          tasks: tasks.map((t) => ({
            id: t.id,
            type: t.type,
            status: t.status,
            error: t.error,
            createdAt: t.createdAt,
            startedAt: t.startedAt,
            completedAt: t.completedAt,
          })),
        };
      },
    });

    // Get a specific task
    fastify.route({
      method: "GET",
      url: "/tasks/:taskId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: taskIdParamSchema,
        response: {
          200: taskSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const taskService = services.get(TaskService);
        const task = taskService.get(req.params.taskId);
        if (!task || task.userId !== req.user.sub) {
          return reply.code(404).send({ error: "Task not found" });
        }
        return {
          id: task.id,
          type: task.type,
          status: task.status,
          error: task.error,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
        };
      },
    });
  };

export { createTasksRoutes };
