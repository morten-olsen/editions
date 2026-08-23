# MCP Server

Editions exposes itself to AI agents over the [Model Context Protocol](https://modelcontextprotocol.io)
at `POST /api/mcp`. A user mints an API key in **Settings → Integrations**, pastes it into their
agent's config, and the agent can then add sources, tune focuses and compose editions on their
behalf. Nothing runs locally.

## Design

Two constraints drive the whole surface.

**The agent's context is finite.** Editions holds tens of thousands of articles. A tool surface
mirroring the REST API would let an agent page through a source's corpus and fill its window
learning nothing. So the surface is built from aggregates, samples and previews — never row dumps.

**Analysis is asynchronous.** Adding a source starts fetch → extract → embed → classify. Until that
settles, focus previews are meaningless. Readiness is therefore part of the interface, not something
the agent is trusted to remember to poll for.

### Deep tools, not CRUD

Fifteen tools, each hiding a workflow, rather than thirty mirroring the tables. `add_sources` hides
create → fetch → extract → embed → classify → poll → report; the shallow alternative would push that
sequencing into the agent's prompt at every call site.

Tools are plain records in our own registry (`mcp/mcp.tools.ts`), not SDK objects. The MCP SDK is an
adapter at the edge (`mcp/mcp.ts`). Tests exercise every tool through `toolRegistry.call` with no
HTTP and no SDK; only `api/mcp.routes.test.ts` touches the transport.

MCP tools are adapters, not a domain layer. Behaviour lives in domain modules — `readiness/`,
`focuses/focuses.tuning.ts`, and the existing services. The `mcp/` module owns only registration,
scope enforcement, context budgeting and output shaping.

## Tools

Scopes are cumulative: `read` ⊂ `write` ⊂ `admin`. A key sees only the tools its scope permits — a
read-only key is not merely refused on write tools, it never gets told they exist.

| Tool | Scope | What it hides |
|---|---|---|
| `get_workspace` | read | Sources, focuses, edition configs, recent issues, scoring weights and readiness in one call |
| `wait_until_ready` | read | The entire job model — the agent never learns job types |
| `get_article` | read | The only tool returning article body text; opt-in and truncated |
| `inspect_feed` | read | Probes URLs without persisting: validity, cadence, content depth, sample titles |
| `browse_catalog` | read | Curated source/focus/edition templates with adoption status |
| `profile_source` | read | Volume, reading-time distribution, focus distribution, sampled titles |
| `preview_focus` | read | Match count, confidence histogram, top matches, **near-misses**, per-source breakdown |
| `preview_edition` | read | Section fill plus **shortfall diagnostics** explaining why a section came up short |
| `add_sources` | write | Dedup, create, full pipeline, bounded wait, per-source state |
| `adopt_from_catalog` | write | Cascading adopt (edition → focuses → sources) plus wait |
| `refresh_sources` | write | Re-fetch and re-analyse |
| `save_focus` | write | Create-or-update plus the reconcile-enqueue rules plus wait |
| `vote_articles` | write | Batch up/down/clear votes, focus-scoped or global; skips existing votes by default |
| `save_edition_config` | write | Create-or-update with focuses, budgets, schedule |
| `generate_edition` | write | Publish a real issue |
| `delete_entity` | admin | Irreversible deletion; requires `confirm: true` |

`preview_focus` is the highest-leverage tool: it is what lets an agent tune a focus to a good state
without reading a single article body. The near-miss list answers "what would I gain by lowering
this threshold?" directly.

### Curation via votes

`vote_articles` exists so an agent can curate a focus, which is also how reference data accumulates
for a future vote-driven classifier. Three deliberate choices:

- **Batch.** Curating is inherently bulk — up to 50 votes per call, because one call per vote would
  be a dozen round trips for a single pass.
- **Existing votes are skipped by default.** The user may have voted deliberately, and their
  judgement outranks the agent's. `overwriteExisting` is opt-in.
- **The description is explicit that votes do not change membership.** They change ranking, which
  decides what fits inside an edition budget. An agent told otherwise would vote up a near-miss and
  expect it to appear in the focus, which will not happen.

`preview_focus` returns `vote` and `globalVote` on every article it lists plus `votedInSample`, and
`get_workspace` reports per-focus `{ up, down }` counts — so the agent can see what is curated
without an extra tool call, and never has to guess.

Voting requires the article to belong to the voting user. That check lives in `VotesService.upsert`,
so REST and MCP share it: a vote pulls the voted article's embedding into the voter's propagation
context, and accepting an arbitrary id would let one user's content influence another's ranking.

`preview_edition` and `generate_edition` stay separate rather than becoming
`preview_edition({ commit: true })` — a boolean that switches a tool between "no side effects" and
"writes a row" is the kind of hidden mode switch that makes an interface untrustworthy.

## Readiness

Three layered mechanisms, so an agent cannot act on unready data by accident.

1. **Sync-by-default with a budget.** `add_sources`, `adopt_from_catalog`, `refresh_sources` and
   `save_focus` wait up to `waitSeconds` (default 30, max 120), then report honestly.
2. **Universal staleness reporting.** Every tool returning analysed data includes a `readiness`
   block. This is the load-bearing mechanism; the waits are a convenience.
3. **`wait_until_ready`** — scoped, bounded resume-waiting.

```json
{
  "state": "analysing",
  "analysed": 412,
  "pending": 88,
  "pendingClassification": 0,
  "activeJobs": 1,
  "pendingSources": [{ "sourceId": "…", "name": "Ars Technica", "pendingArticles": 88 }]
}
```

`state` has three values, and the third is load-bearing:

| State | Meaning | Right response |
|---|---|---|
| `ready` | Everything analysed, nothing running | Trust the numbers |
| `analysing` | Work in flight (`activeJobs > 0`) | Wait |
| `stalled` | Unanalysed articles, nothing running | Proceed; waiting cannot help |

`stalled` exists because extraction fails permanently for some URLs — dead links, paywalls, scraper
blocks. The job completes and those articles stay unanalysed forever. Collapsing that into
`analysing` meant every wait ran to its full budget and an agent looping on `wait_until_ready` never
progressed; a live run hung on three unreachable Hacker News links. `waitUntilReady` now returns
immediately on `stalled`, and `readinessAdvice` in `mcp.tools.ts` gives every tool the same wording
so the agent is consistently told not to retry.

`readiness/readiness.ts` combines two signals because neither alone suffices:

- **DB truth** — articles from the user's sources with `analysed_at IS NULL`, plus (for a focus
  scope) analysed articles with no `article_focuses` row for that focus. The second catches a
  freshly created focus mid-reconcile, which the article-level count alone reports as clean.
- **In-flight jobs** — `JobService.listByUser(userId, { active: true })`. A source still being
  *fetched* has no articles yet, so it looks trivially ready to the DB query.

On a cold instance the first analysis downloads a ~33MB model, so the first `add_sources` will
usually exceed any sane wait budget. That is handled by reporting `state: "analysing"` honestly, not
by raising the cap.

## Context budgeting

`mcp/mcp.budget.ts` provides `clamp`, `truncate`, `capList` and `capped`. Every list-shaped output
goes through them, so a capped list always reports its true `total` alongside `shown` — an agent
seeing `shown: 10, total: 4213` knows to narrow rather than page.

**Hard rule: no tool except `get_article` may return `articles.content`.** Enforced by a test in
`mcp/mcp.tools.test.ts`, alongside a ceiling asserting responses stay under 24k chars for a
720-article workspace (measured: 1.3k–5.3k).

Domain knowledge lives in the MCP `instructions` field (`mcp/mcp.instructions.ts`), sent once per
session, and in three `editions://guide/*` resources (`mcp/mcp.resources.ts`) — not inlined into
tool descriptions, which are re-sent on every `tools/list`.

## Auth

API keys, not JWTs. Format `ek_<12 hex chars>_<43 base64url chars>`; the prefix locates the row, the
secret proves ownership.

- **sha256, not scrypt.** The secret is 256 bits from `crypto.randomBytes`, so there is nothing to
  brute-force and nothing to stretch against — while every MCP call authenticates, and scrypt at
  N=16384 would add ~100ms each.
- **The prefix is hex, not base64url.** base64url's alphabet includes `_`, the field separator.
  Parsing splits on the first two separators only, since the secret legitimately contains `_` about
  half the time.
- The secret is returned once, at creation. `last_used_at` is throttled to one write per minute.
- Key management (`/api/api-keys`) is JWT-authenticated, so a key cannot mint another key or widen
  its own scope.
- Write and admin tools call `BillingService.assertAccess`; read tools do not, matching how REST
  gates writes but not reads.

## Transport

`StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and `enableJsonResponse: true`
— stateless, single JSON response, no SSE. A fresh `McpServer` per request closes over the
authenticated user, which is what keeps every tool scoped to its caller without any tool having to
remember to filter.

The trade-off: no SSE means no progress notifications during a long call. That is why wait budgets
default to 30s, with `readiness` and `wait_until_ready` covering longer pipelines.

`GET` and `DELETE` on `/api/mcp` return 405 — they only apply to stateful sessions, and answering
explicitly stops them falling through to the SPA catch-all as a confusing 200 of `index.html`.

## Client configuration

```json
{
  "mcpServers": {
    "editions": {
      "type": "http",
      "url": "https://your-instance/api/mcp",
      "headers": { "Authorization": "Bearer ek_..." }
    }
  }
}
```

## Code layout

```
apps/server/src/mcp/
├── mcp.ts                    # SDK adapter: buildMcpServer, tool + resource registration
├── mcp.tools.ts              # Tool contract, defineTool, registry, scope/billing enforcement
├── mcp.budget.ts             # LIMITS, clamp, truncate, capList, capped
├── mcp.feeds.ts              # URL normalisation, publishing-rate estimation, feed probing
├── mcp.instructions.ts       # Server instructions sent on initialize
├── mcp.resources.ts          # editions://guide/* markdown resources
├── mcp.tools.workspace.ts    # get_workspace, wait_until_ready, get_article, delete_entity
├── mcp.tools.sources.ts      # inspect_feed, browse_catalog, profile_source (read-only)
├── mcp.tools.ingest.ts       # add_sources, adopt_from_catalog, refresh_sources (writes)
├── mcp.tools.focuses.ts      # save_focus, preview_focus
└── mcp.tools.editions.ts     # save_edition_config, preview_edition, generate_edition

apps/server/src/readiness/readiness.ts     # ReadinessService: get, waitUntilReady
apps/server/src/focuses/focuses.tuning.ts  # buildFocusTuning: histogram, matches, near-misses
apps/server/src/api-keys/                  # ApiKeysService + createApiKeyHook
apps/server/src/api/mcp.routes.ts          # POST /api/mcp transport wiring
```

Read and write source tools are split because the write ones own the readiness
contract — they start asynchronous work and must report honestly on whether it finished.
`mcp.feeds.ts` is separate so probing a candidate URL stays a pure function of the network, which is
what lets `inspect_feed` be `read`-scope with no side effects.

**Frontend:** `apps/web/src/views/settings/integrations-section.tsx` plus
`apps/web/src/hooks/api-keys/api-keys.hooks.ts`, reachable at Settings → Integrations.

## Gotchas

- The SDK peers on `zod@^3.25 || ^4`, and `registerTool` accepts a `zod/v4` raw shape directly —
  verified to produce correct draft-07 JSON Schema with descriptions, defaults and constraints.
- The `/api/mcp` route is `schema: { hide: true }` — the body is JSON-RPC, which the OpenAPI
  generator cannot describe usefully, and the web client never calls it.
- Tool errors are returned as `isError: true` with a readable message rather than as protocol
  errors, so the agent can read what went wrong and correct itself.
- **Never branch on `=== undefined` for an optional id.** A model filling an optional string field
  routinely sends `""`, `null` or the literal `"null"` instead of omitting the key. `save_focus`
  originally branched on `focusId === undefined`, so `focusId: ""` was read as an update and creation
  became impossible — an agent reported exactly that. Optional ids use `optionalIdSchema` (declared
  `nullish`, so an explicit `null` is accepted) and are resolved through `resolveOptionalId`, which
  treats blank and placeholder values as absent. Not-found errors on those tools also say how to
  create instead, so a genuinely wrong id is self-correcting rather than a dead end.
