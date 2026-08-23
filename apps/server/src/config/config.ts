import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { z } from 'zod/v4';

import { Services } from '../services/services.ts';

const serverSchema = z.object({
  host: z.string().default('0.0.0.0'),
  port: z.number().default(3007),
});

const databaseSchema = z.object({
  filename: z.string().default('editions.db'),
});

const authSchema = z.object({
  jwtSecret: z.string().min(1),
  allowSignups: z.boolean().default(true),
});

const schedulerSchema = z.object({
  enabled: z.boolean().default(true),
  fetchIntervalMinutes: z.number().min(1).default(60),
});

const analysisSchema = z.object({
  classifier: z.enum(['nli', 'similarity', 'hybrid']).default('similarity'),
});

const sourcesSchema = z.object({
  /**
   * Items ingested per feed fetch. Archive-serving feeds return thousands, and
   * each ingested article costs extraction, embedding and classification
   * against every focus — for material far older than any edition lookback.
   */
  maxArticlesPerFetch: z.number().min(1).default(200),
});

const stripeSchema = z.object({
  secretKey: z.string().default(''),
  webhookSecret: z.string().default(''),
  publishableKey: z.string().default(''),
});

const configSchema = z.object({
  server: serverSchema.default({ host: '0.0.0.0', port: 3007 }),
  database: databaseSchema.default({ filename: 'editions.db' }),
  auth: authSchema.default({ jwtSecret: '', allowSignups: true }),
  scheduler: schedulerSchema.default({ enabled: true, fetchIntervalMinutes: 60 }),
  analysis: analysisSchema.default({ classifier: 'similarity' }),
  sources: sourcesSchema.default({ maxArticlesPerFetch: 200 }),
  stripe: stripeSchema.default({ secretKey: '', webhookSecret: '', publishableKey: '' }),
});

type Config = z.infer<typeof configSchema>;

const CONFIG_FILENAME = 'editions.json';

const configPaths = (): string[] => [
  path.join('/etc/editions', CONFIG_FILENAME),
  path.join(homedir(), '.config', 'editions', CONFIG_FILENAME),
  path.resolve(CONFIG_FILENAME),
];

const readJsonFile = (filePath: string): Record<string, unknown> => {
  if (!existsSync(filePath)) {
    return {};
  }
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
};

const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal) &&
      typeof sourceVal === 'object' &&
      sourceVal !== null &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
};

const serverEnvOverrides = (env: NodeJS.ProcessEnv): Record<string, unknown> => {
  const server: Record<string, unknown> = {};
  const host = env['EDITIONS_HOST'] ?? env['HOST'];
  if (host) {
    server['host'] = host;
  }
  const portStr = env['EDITIONS_PORT'] ?? env['PORT'];
  if (portStr) {
    const port = Number(portStr);
    if (!Number.isNaN(port)) {
      server['port'] = port;
    }
  }
  return server;
};

const authEnvOverrides = (env: NodeJS.ProcessEnv): Record<string, unknown> => {
  const auth: Record<string, unknown> = {};
  if (env['EDITIONS_JWT_SECRET']) {
    auth['jwtSecret'] = env['EDITIONS_JWT_SECRET'];
  }
  if (env['EDITIONS_ALLOW_SIGNUPS'] !== undefined) {
    auth['allowSignups'] = env['EDITIONS_ALLOW_SIGNUPS'] !== 'false';
  }
  return auth;
};

const stripeEnvOverrides = (env: NodeJS.ProcessEnv): Record<string, unknown> => {
  const stripe: Record<string, unknown> = {};
  if (env['EDITIONS_STRIPE_SECRET_KEY']) {
    stripe['secretKey'] = env['EDITIONS_STRIPE_SECRET_KEY'];
  }
  if (env['EDITIONS_STRIPE_WEBHOOK_SECRET']) {
    stripe['webhookSecret'] = env['EDITIONS_STRIPE_WEBHOOK_SECRET'];
  }
  if (env['EDITIONS_STRIPE_PUBLISHABLE_KEY']) {
    stripe['publishableKey'] = env['EDITIONS_STRIPE_PUBLISHABLE_KEY'];
  }
  return stripe;
};

const envOverrides = (): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {};
  const env = process.env;

  const server = serverEnvOverrides(env);
  if (Object.keys(server).length > 0) {
    overrides['server'] = server;
  }
  if (env['EDITIONS_DB']) {
    overrides['database'] = { filename: env['EDITIONS_DB'] };
  }
  const auth = authEnvOverrides(env);
  if (Object.keys(auth).length > 0) {
    overrides['auth'] = auth;
  }
  const stripe = stripeEnvOverrides(env);
  if (Object.keys(stripe).length > 0) {
    overrides['stripe'] = stripe;
  }

  return overrides;
};

const loadConfig = (): Config => {
  let merged: Record<string, unknown> = {};

  for (const filePath of configPaths()) {
    const fileConfig = readJsonFile(filePath);
    merged = deepMerge(merged, fileConfig);
  }

  merged = deepMerge(merged, envOverrides());

  // Generate a random JWT secret if none was provided
  const auth = merged['auth'] as Record<string, unknown> | undefined;
  if (!auth?.['jwtSecret']) {
    const generated = crypto.randomBytes(32).toString('hex');
    merged['auth'] = { ...(auth ?? {}), jwtSecret: generated };
    console.log("No JWT secret configured — generated ephemeral secret (sessions won't survive restart)");
  }

  return configSchema.parse(merged);
};

class ConfigService {
  #config: Config;

  constructor(_services: Services) {
    this.#config = loadConfig();
  }

  get config(): Config {
    return this.#config;
  }
}

export type { Config };
export { configSchema, ConfigService };
