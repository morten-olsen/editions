import { z } from "zod/v4";

import { createAuthHook } from "../auth/auth.middleware.ts";
import { JobService } from "../jobs/jobs.ts";

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Services } from "../services/services.ts";

// --- Schemas ---

const jobAffectsSchema = z.object({
  sourceIds: z.array(z.string()),
  focusIds: z.array(z.string()),
});

const jobProgressSchema = z
  .object({
    phase: z.string(),
    completed: z.number(),
    total: z.number(),
  })
  .nullable();

const jobSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  affects: jobAffectsSchema,
  progress: jobProgressSchema,
  error: z.string().nullable(),
  createdAt: z.number(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});

const jobListSchema = z.object({
  jobs: z.array(jobSchema),
});

const jobIdParamSchema = z.object({
  jobId: z.string(),
});

const jobQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  sourceId: z.string().optional(),
  focusId: z.string().optional(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

// --- Routes ---

const createJobsRoutes = (services: Services): FastifyPluginAsyncZod =>
  async (fastify) => {
    const authenticate = createAuthHook(services);

    fastify.route({
      method: "GET",
      url: "/jobs",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: jobQuerySchema,
        response: {
          200: jobListSchema,
        },
      },
      handler: async (req, _reply) => {
        const jobService = services.get(JobService);
        const jobs = jobService.listByUser(req.user.sub, {
          active: req.query.active,
          sourceId: req.query.sourceId,
          focusId: req.query.focusId,
        });
        return {
          jobs: jobs.map((j) => ({
            id: j.id,
            type: j.type,
            status: j.status,
            affects: j.affects,
            progress: j.progress,
            error: j.error,
            createdAt: j.createdAt,
            startedAt: j.startedAt,
            completedAt: j.completedAt,
          })),
        };
      },
    });

    fastify.route({
      method: "GET",
      url: "/jobs/:jobId",
      onRequest: authenticate,
      schema: {
        security: [{ bearerAuth: [] }],
        params: jobIdParamSchema,
        response: {
          200: jobSchema,
          404: errorResponseSchema,
        },
      },
      handler: async (req, reply) => {
        const jobService = services.get(JobService);
        const job = jobService.get(req.params.jobId);
        if (!job || job.userId !== req.user.sub) {
          return reply.code(404).send({ error: "Job not found" });
        }
        return {
          id: job.id,
          type: job.type,
          status: job.status,
          affects: job.affects,
          progress: job.progress,
          error: job.error,
          createdAt: job.createdAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        };
      },
    });
  };

export { createJobsRoutes };
