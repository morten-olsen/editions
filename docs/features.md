# Features

Comprehensive feature reference for Editions — a self-hosted news reader that transforms content consumption into a curated, magazine-like reading experience.

---

## Core Concepts

### Sources

Content feeds that Editions subscribes to and periodically fetches.

- **RSS feeds** — Atom, RSS 2.0, RSS 1.0/RDF
- **Podcast sources** — audio/video content with media playback
- **Bookmarks pseudo-source** — built-in source for manually saved articles
- Configurable fetch interval per source
- Per-source article ordering (newest-first or oldest-first)
- Error tracking with last failure message
- Manual fetch trigger and bulk re-analysis

### Focuses

User-defined topic areas for classifying articles.

- Custom topics with name, description, and emoji icon
- ML-powered zero-shot classification (bart-large-mnli) assigns articles to focuses with confidence scores (0.0–1.0)
- Per-focus minimum confidence threshold (filters low-relevance matches)
- Optional reading time filters (min/max seconds)
- Source associations with mode:
  - **always** — every article from source is assigned (confidence 1.0, skips classifier)
  - **match** — use classifier, apply threshold
- Per-source weight within a focus (influences ranking)
- Articles can belong to multiple focuses simultaneously

### Editions

Curated magazine snapshots generated from rules-based templates.

- **Edition configs** — magazine templates with:
  - Cron schedule (e.g., daily at 9am, weekly on Sundays)
  - Lookback window (how far back to consider articles)
  - Per-focus inclusion with position ordering, budget (article count or reading time in minutes), and weight
  - Optional per-source budget caps to prevent source dominance
  - Option to exclude articles from prior editions
  - Enable/disable toggle
- **Generated editions** — immutable magazine issues:
  - Auto-generated per cron schedule
  - On-demand generation via API
  - Articles grouped by focus section with position ordering
  - Reading progress tracking (current article position)
  - Mark entire edition as read/unread

### Feed

Global article stream across all sources.

- Two sort modes:
  - **Recent** — chronological by publish date
  - **Top** — ML-ranked by vote signals and recency
- Filters: read status (unread/read/all), date range (from/to)
- Paginated (20 per page)

---

## Reading Experience

### Article Reader

- Full extracted article content (via `@extractus/article-extractor`)
- Metadata: author, title, summary, publish date, media URL, word count
- Reading progress tracking (0.0–1.0)
- Estimated consumption time
- Read/unread toggle with timestamp
- Voting controls (global and context-scoped)
- Bookmark action

### Magazine View

Full-screen, print-inspired edition reader.

- Cover page with edition title and metadata
- Table of contents with focus sections
- Sequential article flow with sidebar navigation
- Next/previous article navigation
- Media player for podcasts/videos inline
- Progress tracking per edition
- Resume reading from last position
- Mobile-responsive layout

### Design Principles

- **Calm** — no unread badges, urgency indicators, or red alerts
- **Finite** — every surface has a natural end
- **Focused** — content foreground, interface recedes
- **Proportional** — source budgeting prevents any single source from dominating
- **Magazine aesthetic** — serif typography for reading, warm papery palette, dark mode support

---

## Voting System

Three independent vote scopes, each up/down:

| Scope | Where it applies | Purpose |
|-------|-----------------|---------|
| **Global** | Feed, all contexts | General article quality signal |
| **Focus** | Focus pages, editions | Relevance within a topic |
| **Edition** | Edition reader | Influences future edition generation |

- Votes propagate through semantic similarity: unvoted articles inherit signals from similar voted articles (cosine similarity on embeddings, top-15 neighbors above 0.3 threshold)
- Vote history page with scope and value filtering
- Individual vote removal

---

## Bookmarks

- Save any article by URL (creates article in bookmarks pseudo-source)
- Bookmark existing articles from feeds/editions
- Batch bookmark status checking
- Dedicated bookmarks page with full article metadata

---

## Scoring & Ranking

### Formula

All feeds use a unified scoring formula with context-specific weights:

```
score = α × confidence + β × voteSignal + γ × recency
```

| Context | Confidence (α) | Votes (β) | Recency (γ) |
|---------|----------------|-----------|--------------|
| Global feed | 0.0 | 0.6 | 0.4 |
| Focus feed | 0.4 | 0.4 | 0.2 |
| Edition | 0.5 | 0.4 | 0.1 |

### Vote Signal Computation

1. **Direct vote** — use vote value (+1/−1)
2. **Similarity propagation** — no direct vote: load 200 most recent votes, compute cosine similarity via embeddings, weighted average of top-15 similar articles above 0.3 threshold
3. **No votes** — signal defaults to 0

### Recency Decay

Exponential with 3-day half-life: `recency = 0.5 ^ (daysSincePublished / 3)`

### User-Customizable Weights

Per-user scoring weight overrides stored in database. View defaults, set custom weights, or reset to defaults via settings.

---

## Article Processing Pipeline

Three-stage async pipeline, each producing a task:

### Stage 1: Fetch Source
- HTTP fetch of RSS/Atom/RDF feed
- Parse and extract items (title, author, summary, date, image, media)
- Deduplicate on `(source_id, external_id)`
- Enqueue extraction tasks

### Stage 2: Extract Content
- Fetch article URL, extract full HTML content
- Calculate word count and estimated reading time
- Enqueue analysis tasks

### Stage 3: Analyse Article
- **Embedding generation** — Xenova/all-MiniLM-L6-v2 (384-dim float32 vectors), runs in Worker thread
- **Focus classification** — Xenova/bart-large-mnli zero-shot NLI, assigns confidence scores per focus
- Respects focus-source mode (always vs match) and per-focus thresholds
- Recovery: articles with `extracted_at` but null `analysed_at` are re-queued

---

## Scheduler

Background scheduler runs every 60 seconds:

- **Source fetching** — fetches sources overdue based on their `fetchIntervalMinutes`
- **Edition generation** — checks enabled edition configs against cron schedules, generates editions when due

---

## Edition Generation Algorithm

1. Process each focus in config position order
2. Candidates: unread, within lookback window, above confidence threshold, not in prior editions (if configured)
3. Score candidates using edition weights × source weight × focus weight
4. **Weighted random source distribution** — select sources with probability proportional to weight, take highest-scored article from each, preventing any single source from dominating
5. Continue until focus budget (article count or reading time) is exhausted

---

## Authentication & Multi-User

- Username/password registration and login
- First registered user auto-promoted to admin; subsequent users get standard role
- JWT authentication (HS256, Bearer token)
- Auto-generated JWT secret if not configured (sessions lost on restart)
- Configurable signup toggle (`allowSignups`)
- Nullable password hash to support future OAuth-only accounts

---

## Source Management

- List, create, edit, delete sources
- Built-in bookmarks source cannot be deleted
- Manual fetch trigger (async, returns task ID)
- Re-analyse articles per source or across all sources
- Task status tracking for async operations
- Fetch error visibility

---

## Settings

- **Scoring weights** — customize ranking algorithm weights per context (global/focus/edition)
- View active weights and defaults
- Reset to defaults
- **AI Assistant** — BYO OpenAI-compatible provider configuration (endpoint, API key, model). See [docs/ai-assistant.md](docs/ai-assistant.md)

---

## API Surface

All routes under `/api`. Interactive docs at `/api/docs` (Scalar).

| Module | Endpoints | Auth |
|--------|-----------|------|
| Auth | register, login, me | Public (register/login), Protected (me) |
| Config | public config (allowSignups) | Public |
| Sources | CRUD, articles, fetch, reanalyse, tasks | Protected |
| Articles | vote, reading progress | Protected |
| Focuses | CRUD, articles, source associations, votes | Protected |
| Editions | config CRUD, generate, edition CRUD, progress, votes | Protected |
| Feed | paginated article listing | Protected |
| Bookmarks | list, save, check, toggle | Protected |
| Votes | list, delete | Protected |
| Settings | scoring weights CRUD | Protected |
| Tasks | list, status | Protected |

---

## Frontend Pages

| Route | Page |
|-------|------|
| `/login` | Authentication (public) |
| `/feed` | Global article feed |
| `/sources` | Source list |
| `/sources/new` | Add source |
| `/sources/:id` | Source detail with articles |
| `/sources/:id/edit` | Edit source |
| `/sources/:id/articles/:id` | Article reader |
| `/focuses` | Focus list |
| `/focuses/new` | Create focus |
| `/focuses/:id` | Focus articles |
| `/focuses/:id/edit` | Edit focus |
| `/editions` | Edition configs list |
| `/editions/new` | Create edition config |
| `/editions/:configId` | Config detail with generated editions |
| `/editions/:configId/edit` | Edit config |
| `/editions/:configId/issues/:editionId` | Magazine reader |
| `/bookmarks` | Saved articles |
| `/votes` | Vote history |
| `/settings` | Scoring weight customization |

---

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS v4 + TanStack Router + React Query + openapi-fetch
- **Backend:** Fastify + Zod v4 + Kysely + better-sqlite3
- **ML:** Transformers.js (Xenova models in Worker threads)
- **Auth:** Node.js crypto.scrypt + jose JWT
- **Scheduler:** Croner
- **Deployment:** Self-hosted, single monorepo, SQLite database, designed for 1–3 users per server
