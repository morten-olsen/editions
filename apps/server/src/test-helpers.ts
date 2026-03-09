// Ensure test env vars are set before any config loading.
// Vitest workspace mode may not apply per-project `env` config reliably.
process.env["EDITIONS_DB"] = ":memory:";
process.env["EDITIONS_JWT_SECRET"] ??= "test-secret-do-not-use-in-production";

import { createApp } from "./app.ts";

import type { App } from "./app.ts";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";

type TestContext = {
  server: FastifyInstance;
  stop: () => Promise<void>;
  inject: (opts: InjectOptions) => Promise<LightMyRequestResponse>;
  /** Register a user and return auth headers */
  register: (username?: string, password?: string) => Promise<{
    id: string;
    token: string;
    headers: { authorization: string };
  }>;
};

const createTestApp = async (): Promise<TestContext> => {
  const app = await createApp({ logger: false });

  const inject = (opts: InjectOptions): Promise<LightMyRequestResponse> => {
    return app.server.inject(opts);
  };

  const register = async (
    username = "testuser",
    password = "password123",
  ): Promise<{ id: string; token: string; headers: { authorization: string } }> => {
    const res = await inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username, password },
    });
    const body = JSON.parse(res.body) as { id: string; token: string };
    return {
      ...body,
      headers: { authorization: `Bearer ${body.token}` },
    };
  };

  return { server: app.server, stop: app.stop, inject, register };
};

export { createTestApp };
export type { TestContext };
