import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import scalarReference from '@scalar/fastify-api-reference';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  hasZodFastifySchemaValidationErrors,
} from 'fastify-type-provider-zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { registerRoutes } from './api/api.ts';
import { ConfigService } from './config/config.ts';
import { DatabaseService } from './database/database.ts';
import { registerJobHandlers } from './jobs/jobs.handlers.ts';
import { JobService } from './jobs/jobs.ts';
import { SchedulerService } from './scheduler/scheduler.ts';
import { Services, destroySymbol } from './services/services.ts';

type App = {
  server: FastifyInstance;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const createApp = async ({ logger = true }: { logger?: boolean } = {}): Promise<App> => {
  const services = new Services();
  const { config } = services.get(ConfigService);

  const fastify = Fastify({
    logger: logger
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : false,
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  fastify.setErrorHandler((err, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({
        error: 'Validation Error',
        details: err.validation,
      });
    }
    throw err;
  });

  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Editions API',
        description: 'A calm, purposeful news reader',
        version: '0.0.1',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(scalarReference, {
    routePrefix: '/api/docs',
  });

  await registerRoutes(fastify, services);

  // Serve static frontend assets if the public directory exists
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(__dirname, '..', 'public');
  if (existsSync(publicDir)) {
    await fastify.register(fastifyStatic, { root: publicDir, wildcard: false });

    // SPA fallback: serve index.html for non-API routes that don't match a static file
    fastify.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
      return reply.sendFile('index.html');
    });
  }

  registerJobHandlers(services);

  // Create scheduler (not started until listen completes)
  const scheduler = new SchedulerService(services, config.scheduler, {
    info: (msg) => fastify.log.info(msg),
    error: (msg) => fastify.log.error(msg),
  });

  const start = async (): Promise<void> => {
    await fastify.listen({ host: config.server.host, port: config.server.port });

    // Recover any articles that were extracted but not yet analysed
    const db = await services.get(DatabaseService).getInstance();
    const result = await db
      .selectFrom('articles')
      .select(db.fn.countAll().as('count'))
      .where('extracted_at', 'is not', null)
      .where('analysed_at', 'is', null)
      .executeTakeFirstOrThrow();
    const recovered = Number(result.count);
    if (recovered > 0) {
      services.get(JobService).enqueue<Record<string, never>>('reanalyse_all', {}, {});
      fastify.log.info(`Enqueued ${recovered} articles for analysis recovery`);
    }

    // Start the scheduler for automatic feed fetching and edition generation
    scheduler.start();
  };

  const stop = async (): Promise<void> => {
    scheduler[destroySymbol]();
    await fastify.close();
    await services.destroy();
  };

  return { server: fastify, start, stop };
};

export type { App };
export { createApp };
