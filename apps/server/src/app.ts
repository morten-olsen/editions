import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';
import fastifyRawBody from 'fastify-raw-body';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import scalarReference from '@scalar/fastify-api-reference';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  hasZodFastifySchemaValidationErrors,
} from 'fastify-type-provider-zod';

import { AccessExpiredError, BillingNotConfiguredError } from './billing/billing.ts';
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

const createFastifyInstance = (logger: boolean): FastifyInstance & { withTypeProvider: () => unknown } => {
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
    if (err instanceof AccessExpiredError) {
      return reply.code(402).send({
        error: err.message,
        code: 'ACCESS_EXPIRED',
      });
    }
    if (err instanceof BillingNotConfiguredError) {
      return reply.code(501).send({
        error: err.message,
        code: 'BILLING_NOT_CONFIGURED',
      });
    }
    throw err;
  });

  return fastify;
};

const registerSwagger = async (fastify: Parameters<typeof registerRoutes>[0]): Promise<void> => {
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
};

const registerStaticAssets = async (fastify: FastifyInstance): Promise<void> => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(__dirname, '..', 'public');
  if (!existsSync(publicDir)) {
    return;
  }

  await fastify.register(fastifyStatic, { root: publicDir, wildcard: false });

  // SPA fallback: serve index.html for non-API routes that don't match a static file
  fastify.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    return reply.sendFile('index.html');
  });
};

const recoverUnanalysedArticles = async (services: Services, log: FastifyInstance['log']): Promise<void> => {
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
    log.info(`Enqueued ${recovered} articles for analysis recovery`);
  }
};

const createApp = async ({ logger = true }: { logger?: boolean } = {}): Promise<App> => {
  const services = new Services();
  const { config } = services.get(ConfigService);

  const fastify = createFastifyInstance(logger);

  await fastify.register(fastifyRawBody, { global: false, runFirst: true });
  await registerSwagger(fastify as Parameters<typeof registerRoutes>[0]);
  await registerRoutes(fastify as Parameters<typeof registerRoutes>[0], services);
  await registerStaticAssets(fastify);

  registerJobHandlers(services);

  const scheduler = new SchedulerService(services, config.scheduler, {
    info: (msg) => fastify.log.info(msg),
    error: (msg) => fastify.log.error(msg),
  });

  const start = async (): Promise<void> => {
    await fastify.listen({ host: config.server.host, port: config.server.port });
    await recoverUnanalysedArticles(services, fastify.log);
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
