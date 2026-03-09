# Testing Strategy

## Overview

Tests run via [Vitest](https://vitest.dev/) with workspace support for the monorepo. The primary testing approach is **API-level integration tests** using Fastify's `inject()` — each test spins up a full app instance against an in-memory SQLite database, exercises real HTTP routes, and tears down cleanly.

## Running Tests

```bash
# All tests (from repo root, via workspace)
pnpm test

# Server tests only (from apps/server)
cd apps/server && npx vitest run

# Watch mode
npx vitest

# Single file
npx vitest run src/api/auth.routes.test.ts
```

`task test` also works from the repo root.

## Workspace Setup

Vitest workspace config at root discovers per-app configs:

```
vitest.workspace.ts          → ["apps/server", "apps/web"]
apps/server/vitest.config.ts → server project config
apps/web/vitest.config.ts    → web project config (when added)
```

Each project has its own `vitest.config.ts` with project-specific settings (`name`, `env`, etc.).

## Server Test Architecture

### API-level tests (primary)

Tests live alongside route files: `src/api/{module}.routes.test.ts`.

Each test file follows this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp } from "../test-helpers.ts";
import type { TestContext } from "../test-helpers.ts";

let t: TestContext;

beforeEach(async () => {
  t = await createTestApp();
});

afterEach(async () => {
  await t.stop();
});
```

Every test gets a completely isolated app instance with its own in-memory database. No shared state between tests.

### Test helper (`src/test-helpers.ts`)

`createTestApp()` returns a `TestContext` with:

- **`inject(opts)`** — Fastify's `inject()` for sending HTTP requests without a real server
- **`register(username?, password?)`** — Convenience to register a user and get back `{ id, token, headers }` where `headers` is `{ authorization: "Bearer <token>" }` ready for use
- **`stop()`** — Tears down the app and destroys the database

### Writing authenticated tests

Most routes require auth. Use a local helper to keep tests clean:

```typescript
const authed = async (): Promise<{ authorization: string }> => {
  const { headers } = await t.register();
  return headers;
};

it("does something", async () => {
  const headers = await authed();
  const res = await t.inject({
    method: "GET",
    url: "/api/some-route",
    headers,
  });
  expect(res.statusCode).toBe(200);
});
```

For tests that need multiple users (e.g., authorization isolation), call `t.register()` with different usernames:

```typescript
it("isolates by user", async () => {
  const headers = await authed();
  // ... create resources as first user ...

  const { headers: otherHeaders } = await t.register("otheruser", "password456");
  const res = await t.inject({
    method: "GET",
    url: "/api/some-route",
    headers: otherHeaders,
  });
  expect(res.statusCode).toBe(404); // can't see first user's data
});
```

### Test organization per route file

Group tests by HTTP method and endpoint using `describe`:

```typescript
describe("POST /api/sources", () => {
  it("creates a source", ...);
  it("rejects unauthenticated request", ...);
  it("rejects invalid input", ...);
});

describe("GET /api/sources", () => {
  it("returns empty list initially", ...);
  it("returns created sources", ...);
  it("isolates sources by user", ...);
});
```

### What to test

For each endpoint, cover:

1. **Happy path** — correct status code and response shape
2. **Auth** — 401 for missing/invalid token
3. **Authorization** — 404 (not 403) when accessing another user's resources
4. **Validation** — 400 for invalid input
5. **Not found** — 404 for non-existent resources
6. **Side effects** — e.g., DELETE followed by GET returns 404

### Service-level tests (future)

Granular unit tests for service classes can be added later if needed. The DI container supports injecting mocks via `services.set()`. API-level tests cover the most ground for now.

## Database Isolation

Each `createTestApp()` creates a fresh in-memory SQLite database (`:memory:`). Migrations run automatically on first access. The database is destroyed in `afterEach` via `t.stop()`.

**Gotcha:** Vitest workspace mode does not reliably apply per-project `env` config from `vitest.config.ts`. The test helper sets `process.env` directly to guarantee `:memory:` database and a fixed JWT secret are used regardless of how tests are invoked.

## Frontend Tests (planned)

Web app tests will use Vitest + React Testing Library. Config will live in `apps/web/vitest.config.ts` and be discovered automatically by the workspace.
