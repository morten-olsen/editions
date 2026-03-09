import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { z } from "zod/v4";

import { Services } from "../services/services.ts";

const serverSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().default(3007),
});

const databaseSchema = z.object({
  filename: z.string().default("editions.db"),
});

const authSchema = z.object({
  jwtSecret: z.string().min(1),
  allowSignups: z.boolean().default(true),
});

const schedulerSchema = z.object({
  enabled: z.boolean().default(true),
  fetchIntervalMinutes: z.number().min(1).default(60),
});

const configSchema = z.object({
  server: serverSchema.default({ host: "0.0.0.0", port: 3007 }),
  database: databaseSchema.default({ filename: "editions.db" }),
  auth: authSchema.default({ jwtSecret: "", allowSignups: true }),
  scheduler: schedulerSchema.default({ enabled: true, fetchIntervalMinutes: 60 }),
});

type Config = z.infer<typeof configSchema>;

const CONFIG_FILENAME = "editions.json";

const configPaths = (): string[] => [
  path.join("/etc/editions", CONFIG_FILENAME),
  path.join(homedir(), ".config", "editions", CONFIG_FILENAME),
  path.resolve(CONFIG_FILENAME),
];

const readJsonFile = (filePath: string): Record<string, unknown> => {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal) &&
      typeof sourceVal === "object" &&
      sourceVal !== null &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
};

const envOverrides = (): Record<string, unknown> => {
  const overrides: Record<string, unknown> = {};
  const env = process.env;

  if (env["EDITIONS_HOST"]) overrides["server"] = { ...((overrides["server"] as Record<string, unknown>) ?? {}), host: env["EDITIONS_HOST"] };
  if (env["EDITIONS_PORT"]) {
    const port = Number(env["EDITIONS_PORT"]);
    if (!Number.isNaN(port)) {
      overrides["server"] = { ...((overrides["server"] as Record<string, unknown>) ?? {}), port };
    }
  }
  if (env["EDITIONS_DB"]) overrides["database"] = { filename: env["EDITIONS_DB"] };
  if (env["EDITIONS_JWT_SECRET"]) overrides["auth"] = { ...((overrides["auth"] as Record<string, unknown>) ?? {}), jwtSecret: env["EDITIONS_JWT_SECRET"] };
  if (env["EDITIONS_ALLOW_SIGNUPS"] !== undefined) overrides["auth"] = { ...((overrides["auth"] as Record<string, unknown>) ?? {}), allowSignups: env["EDITIONS_ALLOW_SIGNUPS"] !== "false" };

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
  const auth = merged["auth"] as Record<string, unknown> | undefined;
  if (!auth?.["jwtSecret"]) {
    const generated = crypto.randomBytes(32).toString("hex");
    merged["auth"] = { ...(auth ?? {}), jwtSecret: generated };
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
