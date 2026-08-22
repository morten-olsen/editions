import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    // CI pods report host CPUs, but each worker loads Fastify and native SQLite.
    maxWorkers: 1,
    globals: true,
    env: {
      EDITIONS_DB: ':memory:',
      EDITIONS_JWT_SECRET: 'test-secret-do-not-use-in-production',
    },
  },
});
