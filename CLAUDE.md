# CLAUDE.md

This file is for AI agents. Keep entries short — link to `./docs` for detail.

Documentation in `./docs` are live documents. If you discover a discrepancy between docs and code, correct it. Changes to conventions should be reflected in the relevant doc.

This file is for **gotchas** — things that aren't obvious and required effort to figure out.

## Docs

- [CONTEXT.md](CONTEXT.md) — Domain glossary (ubiquitous language) — use these terms exactly when naming modules and concepts
- [docs/vision.md](docs/vision.md) — Product vision, core concepts (sources, focuses, editions, feed), design principles
- [docs/coding-standards.md](docs/coding-standards.md) — TypeScript conventions, Zod patterns, file organization, DI pattern, Tailwind v4, import extensions
- [docs/database.md](docs/database.md) — Full schema reference, table descriptions, migration guide, design decisions
- [docs/auth.md](docs/auth.md) — Authentication, users, roles, JWT, password hashing, auth middleware, configuration
- [docs/testing.md](docs/testing.md) — Testing strategy, vitest workspace, test helpers, writing API-level tests
- [docs/article-analysis.md](docs/article-analysis.md) — Article analysis pipeline: embeddings, focus classification, recovery, data model changes
- [docs/pipeline-optimization.md](docs/pipeline-optimization.md) — Pipeline optimization strategies: skip re-embedding, embedding similarity, hybrid classification, batching
- [docs/feed-algorithms.md](docs/feed-algorithms.md) — Feed ranking algorithms: scoring formula, vote scoping, edition generation, source distribution
- [docs/design-system.md](docs/design-system.md) — Design tokens, color palette, typography, spacing, motion, Storybook reference
- [docs/ai-assistant.md](docs/ai-assistant.md) — AI assistant: annotation system, tools, agent loop, tutorials, chat UI
- [docs/data-portability.md](docs/data-portability.md) — Data export/import: format, API, import behavior, reconciliation
- [docs/payments.md](docs/payments.md) — Stripe payments: access gating, subscriptions, pricing, webhooks, admin/user UI
- [docs/mcp.md](docs/mcp.md) — MCP server: tool surface, readiness contract, context budgeting, API keys, transport

## Coding Standards

Full reference: [docs/coding-standards.md](docs/coding-standards.md)

**TypeScript conventions (non-obvious):**

- `type` over `interface` — always
- Arrow functions only — no `function` keyword
- Explicit return types on all functions
- Exports consolidated at end of file: `export type { ... }; export { ... };`
- Import extensions required: `.ts`/`.tsx` for app code, `.js` for library code — use the actual file extension (`.tsx` for files containing JSX)
- No `index.ts` files — use `{module}/{module}.ts` as the public API
- Import from the main module file, never from support files (`.schemas.ts`, `.utils.ts`, etc.)
- `#` for private fields, not `private` keyword
- Prefer single object parameter over multiple positional args (except 1-2 obvious params)
- `unknown` over `any` — always

**Zod gotchas:**

- `z.record()` requires two args: `z.record(z.string(), z.unknown())`
- `.default()` must come before `.transform()` in chains
- Schema naming: `fooSchema` (camelCase) / `Foo` (PascalCase inferred type)
- Route schemas live in `{module}.routes.schemas.ts` — there is no central `api.schemas.ts`
- OpenAPI registration via `z.globalRegistry.add(schema, { id: "Name" })` at the schema's definition site. This emits `components.schemas` entries (via `transformObject` in `app.ts`), so the web client can use the named type through `ApiSchema<'Name'>` from `api/api.ts` instead of re-declaring the shape. Register schemas that the frontend models; leave one-off route shapes inline
- A registered schema emits **two** components: `Name` (response/output) and `NameInput` (request body). Zod input and output types diverge wherever `.default()` or `.transform()` is used. Registering an id that collides with another's `Input` name throws at doc-generation time
- `src/api/openapi.test.ts` asserts every emitted `$ref` resolves — without that guard a dangling ref only surfaces as a `task generate:api` failure later
- JSON Schema conversion: `z.toJSONSchema(schema, { target: "draft-07" })`

**Tailwind CSS v4:**

- `bg-linear-to-*` not `bg-gradient-to-*`
- Use standard spacing tokens, not arbitrary `[Npx]` when a token exists
- Bare opacity: `bg-white/3` not `bg-white/[0.03]`

**File organization:**

- Module pattern: `{module}/{module}.ts` + `{module}/{module}.{area}.ts`
- File naming: kebab-case
- Split at ~300-400 lines; don't split if it creates 1-2 export files
- Single file order: imports → schemas/types → constants → private helpers → public functions → exports

**DI pattern:** Simple service container — services receive container, resolve deps lazily in methods (not constructor). See [docs/coding-standards.md](docs/coding-standards.md) for the `Services` class pattern.

**Lazy initialization pattern:** Services with async setup (DB connections, migrations) use a cached-promise pattern: `getInstance()` calls `#setup()` once, caches the promise. Consumers `await` `getInstance()` — first call initializes, subsequent calls return the cached result. This ensures resources aren't created until needed. See `DatabaseService` for the reference implementation.

## Architecture

**Monorepo:** pnpm workspace — `apps/server` (Fastify backend), `apps/web` (Vite + React frontend). Tooling managed via `mise.toml` (Node 24, pnpm 10, task).

**Task runner:** [Taskfile](https://taskfile.dev) via `task <name>` — `dev` (runs server + web), `dev:server`, `dev:web`, `start`, `check`, `install`, `clean`, `reset-db`, `lint`, `test:smoke`. Run `task --list` for descriptions.

**Server stack:** Fastify + Zod v4 (`zod/v4` import) + `fastify-type-provider-zod` v5 + Scalar API docs at `/api/docs`. All API routes are under the `/api` prefix.

**Frontend stack:** Vite + React + TypeScript + Tailwind CSS v4 + TanStack Router (file-based) + React Query + openapi-fetch. Vite dev server proxies `/api` to the backend (port 3007). API types are generated from the OpenAPI schema via `openapi-typescript` (`pnpm --filter @editions/web generate:api` with server running).

**Config:** `ConfigService` loads JSON from `/etc/editions/editions.json` → `~/.config/editions/editions.json` → `./editions.json` → env vars (later files override earlier). Env vars: `EDITIONS_HOST`, `EDITIONS_PORT`, `EDITIONS_DB`, `EDITIONS_JWT_SECRET`. Schema validated with Zod.

**Feed ingest:** capped at `sources.maxArticlesPerFetch` items per fetch (default 200). Archive-serving feeds return thousands, and each one costs extraction + embedding + classification against every focus for material older than any edition lookback. `selectItemsToIngest` takes the newest, or the oldest when the source's `direction` is `'oldest'`. See [docs/pipeline-optimization.md](docs/pipeline-optimization.md).

**Auth:** Password hashing via Node.js `crypto.scrypt`. JWT via `jose` (HS256, issuer `"editions"`). No expiration yet (refresh tokens TBD). JWT secret auto-generated if not configured (sessions lost on restart). `password_hash` is nullable on users to support future OAuth-only accounts. First registered user automatically becomes `admin`, subsequent users get `user` role. JWT payload includes `sub`, `username`, `role`.

**Auth middleware:** `createAuthHook(services)` returns a Fastify `onRequest` hook that validates the `Authorization: Bearer <token>` header and populates `req.user` (typed as `TokenPayload`). Use `declare module "fastify"` augmentation in `auth.middleware.ts`. Apply per-route via `onRequest` property, not globally.

**Database:** SQLite via Kysely + better-sqlite3. Full schema reference: [docs/database.md](docs/database.md).

**Pagination:** One page contract — `{ items, total, offset, limit }` — from `pagination/pagination.ts` (`pagedSchema`, `paginationQuerySchema`, `toPage`, `Page<T>`). List endpoints that grow with usage return a page; lists bounded by a user's own hand-made entities (focuses, edition configs) return a bare array. `limit: null` in a response means "every row" — the contract for endpoints a picker reads (`GET /sources`). On the web side, `usePagedQuery` + `<Pager idPrefix>` own paging behaviour; never hand-roll offset state or total retention.

**Ranking:** All article scoring goes through `ranking/ranking.ts` (`scoreAndRank`) — never hand-assemble score→sort pipelines, decode embedding BLOBs in callers (use `decodeEmbedding`), or re-implement the confidence rule (`effectiveConfidence` / `minConfidenceFilterSql` own `nli ?? similarity ?? 0` in TS and SQL).

**MCP:** Agents connect over HTTP at `POST /api/mcp` with an API key. Tools are plain records in `mcp/mcp.tools.ts`, not SDK objects — the SDK is an adapter in `mcp/mcp.ts`, so tests call `toolRegistry.call` directly with no HTTP. Tools are adapters, never a domain layer: behaviour belongs in domain modules. Two hard rules — every tool returning analysed data must include a `readiness` block (see below), and no tool except `get_article` may return `articles.content`. Both are enforced by tests. See [docs/mcp.md](docs/mcp.md).

**Readiness:** `readiness/readiness.ts` owns "has analysis settled?". It combines DB counts *and* the in-memory job queue — a source mid-fetch has zero articles and so looks trivially ready to SQL alone. Never re-derive readiness from `analysed_at` in a caller. Three states: `ready`, `analysing` (a job is running) and `stalled` (articles unanalysed with nothing running — extraction fails permanently on some URLs). `stalled` must stay distinct: collapsing it into `analysing` makes every wait loop run to its full budget forever.

**Jobs:** Job types + payloads are a typed registry (`JobPayloads` in `jobs/jobs.ts`) — a typo'd `enqueue` type is a compile error. Adding a job type means updating the registry AND the web label maps (`jobs.hooks.ts` `JOB_TYPE_LABELS`, `focuses.utils.ts` `ANALYSIS_JOB_TYPES`). Analysis jobs are presets over `ReconcilerService.reconcile({ scopeFilter, reset, backfillExtractedAt })` — put reset logic there, not in handlers.

**Database gotchas:**

- Import `z` from `zod/v4` (not `zod`) — `fastify-type-provider-zod` v5 requires Zod v4 API
- SQLite has no boolean — use `integer` with 0/1, typed as `number` in Kysely
- SQLite has no datetime — use `text` with ISO 8601 strings, `datetime('now')` for defaults
- All IDs are text UUIDs — generate with `crypto.randomUUID()`
- Timestamps use `ColumnType<string, string | undefined, string>` — optional on insert (has DB default), string on select/update
- Migrations in `apps/server/src/database/migrations/`, named `NNN-description.ts`, run automatically on first DB access
- Migration files export `{ up, down }` — both take `Kysely<unknown>`, not the typed schema
- `DatabaseService.getInstance()` returns `Promise<Kysely<DatabaseSchema>>` — always `await` it
- Dedup index on `articles(source_id, external_id)` — use `ON CONFLICT` or check before insert
- `sources.config` is JSON text — parse/stringify when reading/writing type-specific settings

**Feed parsing gotcha:** fast-xml-parser's `processEntities.maxTotalExpansions` counts *every* entity replacement including harmless 1:1 ones (`&amp;`, `&#8217;`), and its default of 1000 is well below what a real full-text feed contains — the Rust blog and simonwillison.net both exceeded it. Exceeding it throws, so the whole feed fails rather than degrading. `sources.fetch.ts` raises it to 1,000,000; the DOCTYPE-specific limits that actually guard against billion-laughs are untouched, and the parser refuses to expand nested entities at all, so exponential expansion is structurally impossible.

**Config gotchas:**

- Convict was considered but is CJS-only with no types — replaced with a Zod-validated config loader
- Nested `.default()` on Zod v4 objects requires providing the full default value (not `{}`), split sub-schemas out if needed
- Config is loaded eagerly (not lazy) because other services depend on it at construction time

**Auth gotchas:**

- Password hashing uses `crypto.scrypt` (Node built-in) — no native dependency needed
- `jose` for JWT — import `{ SignJWT, jwtVerify }` from `jose`
- JWT secret is `Uint8Array` — encode with `new TextEncoder().encode(secret)`
- Auth routes: `/api/auth/register` (POST), `/api/auth/login` (POST) return `{ id, role, token }`; `/api/auth/me` (GET, authenticated) returns `{ id, username, role }`
- `users.password_hash` is nullable — future OAuth users may not have a password
- `users.role` is `"admin"` or `"user"` — first user auto-promoted, stored in JWT
- Fastify request augmentation (`declare module "fastify"`) must use `interface` not `type` (TypeScript constraint for module augmentation) — this is the one exception to the `type` over `interface` rule
- Protected routes: add `onRequest: createAuthHook(services)` to the route config
- API keys (for MCP) are a separate credential from JWTs — `createApiKeyHook(services, { minScope })`. Hashed with sha256 not scrypt (the secret is 256 random bits, so there is nothing to stretch against, and MCP authenticates on every call)
- API key format is `ek_<hex>_<base64url>`; the prefix is hex deliberately, because base64url contains the `_` separator — parse by splitting on the first two separators only, never on all of them
- `/api/api-keys` is JWT-only, so an API key cannot mint another key or widen its own scope

**Testing gotchas:**

- Tests are API-level using Fastify `inject()` — not service-level unit tests. Test files live at `src/api/{module}.routes.test.ts`
- Each test gets a fresh app + in-memory SQLite via `createTestApp()` from `src/test-helpers.ts`
- Vitest workspace mode does NOT reliably apply per-project `env` config — `test-helpers.ts` sets `process.env` directly to guarantee `:memory:` DB and fixed JWT secret
- Always `await t.stop()` in `afterEach` — this destroys the in-memory DB and cleans up the Fastify instance
- `t.register()` returns `{ id, token, headers }` — use `headers` directly for authenticated requests
- Test multiple users by calling `t.register("otheruser", "password456")` — each call creates a new user in the same test's DB
- `t.db()` returns the in-memory Kysely instance for seeding rows directly; `t.services` exposes the DI container (e.g. `t.services.get(BillingService)`) for service-level assertions
- Never seed an *extracted* article and then trigger a reconcile job in an API test — the embed step would spawn the real HF worker and download a ~33MB model. Direct DB seeding (no job enqueued) is safe
- Unit tests of the analysis pipeline compose the REAL steps via `buildReconcileSteps` from `reconciler/reconciler.ts` with fake `EmbedFn`/`ClassifyFn` — never hand-copy the step list
- The default test run is hermetic (no network). Live-network tests (discovery catalog URL checks) are gated behind `EDITIONS_LIVE_TESTS=1` — run via `task test:live`

**Frontend gotchas:**

- **All type errors must be fixed** — even if pre-existing. Never leave `tsc` errors unresolved; fix them as part of any change touching the frontend.
- `@base-ui/react` v1.2+ — `Field.Error` uses `match` prop (not `forceShow`); `Field.Control` with `render={<textarea />}` needs props passed via the render element, not spread on `Field.Control`
- Vite uses bundler module resolution — import `.tsx` for files containing JSX (not `.ts`), unlike the server where `.ts` works for everything
- TanStack Router uses file-based routing — routes live in `src/routes/`, the route tree is auto-generated (`routeTree.gen.ts`)
- TanStack Router: `foo.tsx` is a **layout route** (parent of `/foo/*`), `foo.index.tsx` is the **index route** (leaf at `/foo`). If a route has child routes (e.g., `/sources/new`), the parent must be `sources.index.tsx` — not `sources.tsx` — or it becomes a layout and child routes won't render without an `<Outlet />`
- API client uses `openapi-fetch` with types from `openapi-typescript` — regenerate types with `task generate:api` (requires dev server running). **Never hack API types** — always regenerate from the running server when the API schema changes
- Auth state is managed via React context (`AuthProvider`) — JWT token persisted in `localStorage`
- Vite proxy forwards `/api` to `http://localhost:3000` in dev — no CORS config needed
