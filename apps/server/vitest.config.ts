import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "server",
    globals: true,
    env: {
      EDITIONS_DB: ":memory:",
      EDITIONS_JWT_SECRET: "test-secret-do-not-use-in-production",
    },
  },
});
