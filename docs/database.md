# Database

SQLite via Kysely + better-sqlite3. WAL mode and foreign keys enabled by default.

## Schema overview

```
users
  ├── sources ──── articles ──── article_focuses ──── focuses
  │                    │
  │                    ├──── article_embeddings
  │                    ├──── article_votes (user_id, focus_id)
  │                    └──── bookmarks (user_id)
  ├── focuses ──── focus_sources ──── sources
  └── edition_configs
        ├── edition_config_focuses
        ├── edition_config_source_budgets
        └── editions ──── edition_articles
```

### users

One or a few per server. Every user-owned entity cascades on delete.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| username | text UNIQUE | Login identifier |
| password_hash | text | Null for OAuth-only users (future) |
| role | text | `admin` or `user`, default `user`. First user auto-promoted to admin |
| created_at | text | ISO 8601, default `datetime('now')` |
| updated_at | text | ISO 8601, default `datetime('now')` |

### sources

A content feed the user subscribes to.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| user_id | text FK → users | |
| type | text | `rss`, `mastodon`, `bluesky`, `youtube`, `custom` |
| name | text | Display name |
| url | text | Feed URL |
| config | text | JSON — type-specific settings (e.g. API keys, filters) |
| last_fetched_at | text | Null until first successful fetch |
| fetch_error | text | Last error message; null if healthy |
| created_at | text | |
| updated_at | text | |

### articles

Individual items from a source. Deduplicated on `(source_id, external_id)`.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| source_id | text FK → sources | Cascade delete |
| external_id | text | GUID/URL from feed — dedup key |
| url | text | Link to original article |
| title | text | |
| author | text | |
| summary | text | Feed-provided summary/description |
| content | text | Extracted full text (null until extracted) |
| word_count | integer | From extracted content |
| reading_time_seconds | integer | Derived from word_count |
| image_url | text | Lead/hero image |
| published_at | text | From feed |
| fetched_at | text | When we pulled it |
| extracted_at | text | When content was extracted; null = pending |
| analysed_at | text | When embeddings + focus classification completed; null = pending |
| read_at | text | Null = unread; set when fully read |
| read_progress | real | 0.0–1.0, default 0. Articles are per-user (via source), no separate table needed |
| created_at | text | |

### focuses

User-defined topic areas for classification.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| user_id | text FK → users | |
| name | text | e.g. "Technology", "Local News" |
| description | text | Optional — helps guide the classifier |
| min_confidence | real | 0.0–1.0, default 0. Articles below this confidence are excluded |
| min_reading_time_seconds | integer | Optional — exclude articles shorter than this |
| max_reading_time_seconds | integer | Optional — exclude articles longer than this |
| created_at | text | |
| updated_at | text | |

### focus_sources

Many-to-many: which sources a focus considers, and how.

| Column | Type | Notes |
|--------|------|-------|
| focus_id | text FK → focuses | |
| source_id | text FK → sources | |
| mode | text | `always` (always include articles) or `match` (use classifier) |
| weight | real | Source weight for scoring and round-robin selection, default 1.0. Higher weight = more influence |

Unique on `(focus_id, source_id)`.

### article_focuses

Many-to-many: which focuses an article was classified into, with split similarity/NLI scores and model tracking.

| Column | Type | Notes |
|--------|------|-------|
| article_id | text FK → articles | Cascade delete |
| focus_id | text FK → focuses | Cascade delete |
| similarity | real | Cosine similarity score, nullable |
| similarity_model | text | Embedding model used, nullable |
| nli | real | NLI classification score, nullable |
| nli_model | text | Classifier model used, nullable |
| assigned_at | text | |

Unique on `(article_id, focus_id)`. Model columns enable automatic rescoring when models change.

### article_embeddings

Vector embeddings for semantic search and article similarity. One embedding per article, stored as a float32 blob for sqlite-vec compatibility.

| Column | Type | Notes |
|--------|------|-------|
| article_id | text PK, FK → articles | Cascade delete |
| embedding | blob | Float32 vector (e.g. 384 × 4 bytes = 1,536 bytes for MiniLM) |
| model | text | Model identifier (e.g. `all-MiniLM-L6-v2`) — detects model changes |
| created_at | text | |

### article_votes

User votes on articles — either globally ("I like/dislike this content") or scoped to a specific focus ("this doesn't belong here"). Votes drive the scoring system that ranks articles in focus feeds and edition generation.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| user_id | text FK → users | Who voted |
| article_id | text FK → articles | What they voted on |
| focus_id | text FK → focuses | Null = global vote; non-null = focus-scoped vote |
| edition_id | text FK → editions | Null = not edition-scoped; non-null = edition-scoped vote |
| value | integer | `1` (upvote) or `-1` (downvote) |
| created_at | text | |

Uniqueness is enforced via three partial indexes (SQLite treats NULLs as distinct in regular UNIQUE constraints):
- `idx_article_votes_global` — `UNIQUE(user_id, article_id) WHERE focus_id IS NULL`
- `idx_article_votes_focus` — `UNIQUE(user_id, article_id, focus_id) WHERE focus_id IS NOT NULL`
- `idx_article_votes_edition` — `UNIQUE(user_id, article_id, edition_id) WHERE edition_id IS NOT NULL`

A user can have global, focus-scoped, and edition-scoped votes on the same article — they are independent signals. Edition votes influence future edition generation for that config.

### bookmarks

User-saved articles for later reading. One bookmark per user per article.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| user_id | text FK → users | Who bookmarked |
| article_id | text FK → articles | What they bookmarked |
| created_at | text | |

- `UNIQUE(user_id, article_id)` — prevents duplicate bookmarks
- `idx_bookmarks_user_created` — for listing bookmarks in reverse chronological order

### edition_configs

Rules for periodically generating an Edition.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| user_id | text FK → users | |
| name | text | e.g. "Morning Briefing" |
| schedule | text | Cron expression |
| lookback_hours | integer | Time window for article selection (e.g. 24, 168 for weekly) |
| exclude_prior_editions | integer | SQLite boolean — skip articles already in prior editions of this config |
| enabled | integer | SQLite boolean (0/1) |
| created_at | text | |
| updated_at | text | |

### edition_config_focuses

Which focuses an edition config draws from, with per-focus budgets. Position determines both processing order (earlier focuses claim articles first) and display order.

| Column | Type | Notes |
|--------|------|-------|
| edition_config_id | text FK → edition_configs | |
| focus_id | text FK → focuses | |
| position | integer | User-controlled order |
| budget_type | text | `time` (minutes) or `count` (articles) |
| budget_value | integer | Minutes or article count depending on budget_type |
| lookback_hours | integer | Optional per-focus lookback window; null = use edition config default |
| weight | real | Score multiplier for articles in this focus section (default 1.0) |

Unique on `(edition_config_id, focus_id)`.

### edition_config_source_budgets

Optional per-source caps within an edition config. Sources without a row use defaults.

| Column | Type | Notes |
|--------|------|-------|
| edition_config_id | text FK → edition_configs | |
| source_id | text FK → sources | |
| max_articles | integer | Null = no explicit cap |
| max_reading_minutes | integer | Null = no explicit cap |

Unique on `(edition_config_id, source_id)`.

### editions

A generated instance of an edition config — an immutable snapshot (the "magazine" the user reads).

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | UUID |
| edition_config_id | text FK → edition_configs | |
| title | text | e.g. "Morning Briefing — Mar 9" |
| total_reading_minutes | integer | Actual reading time of selected articles |
| article_count | integer | |
| current_position | integer | Last article position the user reached, for resume. Default 0 |
| published_at | text | |
| created_at | text | |

### edition_articles

Articles included in a specific edition, grouped by focus section and ordered by position.

| Column | Type | Notes |
|--------|------|-------|
| edition_id | text FK → editions | |
| article_id | text FK → articles | |
| focus_id | text FK → focuses | Which focus section this article belongs to |
| position | integer | Global display order within the edition |

Unique on `(edition_id, article_id)`.

## Migrations

Migrations live in `apps/server/src/database/migrations/` and run automatically on startup via Kysely's `FileMigrationProvider`.

**Naming convention:** `NNN-description.ts` (e.g. `001-initial-schema.ts`). Kysely sorts alphabetically.

**Pre-release policy:** While pre-release, modify the existing `001-initial-schema.ts` migration directly instead of creating new migration files. Delete and recreate the database to apply changes (`rm editions.db`). New migration files only after the first release.

**Writing a migration:**

```typescript
import { sql } from "kysely";
import type { Kysely } from "kysely";

const up = async (db: Kysely<unknown>): Promise<void> => {
  // schema changes
};

const down = async (db: Kysely<unknown>): Promise<void> => {
  // rollback
};

export { up, down };
```

## Design decisions

- **Text IDs** — UUIDs as text. SQLite has no native UUID type; text primary keys avoid integer overflow concerns and allow offline ID generation.
- **Text timestamps** — ISO 8601 strings via `datetime('now')`. SQLite has no datetime type; text sorts correctly and is human-readable.
- **SQLite booleans** — `integer` with 0/1. SQLite has no boolean type.
- **JSON in text columns** — `sources.config` stores type-specific settings as JSON text. Simpler than EAV tables for a handful of known source types.
- **Dedup via unique index** — `(source_id, external_id)` prevents re-importing the same article from the same feed. The `external_id` is the feed's GUID or the article URL.
- **Cascade deletes** — all child entities cascade from their parent. Deleting a user removes everything; deleting a source removes its articles and their classifications.
- **No composite PKs** — junction tables use unique indexes rather than composite primary keys, keeping the kysely types simpler.
- **`reading_time_seconds`** not minutes — seconds gives better precision for budgeting; display layer converts to minutes.
