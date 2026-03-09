# Editions

**A self-hosted news reader that respects your time.**

Editions doesn't give you an infinite feed to doomscroll. It gives you a magazine — a finite, curated collection of articles assembled from your sources, shaped by your interests, and designed to end. You read it, you're done, you move on with your day.

No algorithms optimizing for engagement. No unread counts demanding attention. No data leaving your server. Just your news, on your terms.

## How it works

You subscribe to **sources** (RSS feeds today, more planned). You define **focuses** — topic areas like "Technology", "Climate", or "Local News". An on-device ML model classifies incoming articles into your focuses automatically, using zero-shot NLI. Nothing phones home.

Then you create **editions** — scheduled, finite digests built from rules you control:

- **"Morning Briefing"** — 15 minutes of reading from your top 3 focuses, every day at 7am
- **"Weekend Deep Reads"** — longer articles from the past week, capped at 30 minutes
- **Source budgeting** — no single prolific feed drowns out the small blog you actually care about
- **Reading-time budgets** — editions target a time commitment, not just an article count

When an edition is ready, you sit down, read it, reach the end, and feel done. That's the whole point.

### The feed

For the moments between editions — quick catch-ups, idle curiosity — there's a ranked feed of all your articles, sorted by importance so the best stuff floats to the top.

### Voting

Upvote and downvote articles to teach the system your taste. Votes propagate through semantic similarity — a few votes on climate policy articles will shift the ranking of hundreds of similar pieces. You can vote globally ("good article") or within a specific focus ("interesting, but not for this topic").

### Bookmarks

Save articles for later. Simple as that.

## The stack

- **Server:** Node.js + Fastify + SQLite (via Kysely)
- **Frontend:** React + Vite + Tailwind CSS + TanStack Router
- **ML:** Hugging Face Transformers.js — embeddings and classification run locally in a worker thread
- **Deployment:** Single Docker container, one SQLite file, no external services

## Getting started

### Docker Compose (recommended)

Create a `docker-compose.yml`:

```yaml
services:
  editions:
    image: ghcr.io/morten-olsen/editions:latest
    ports:
      - "3007:3007"
    volumes:
      - editions-data:/data
    environment:
      - EDITIONS_JWT_SECRET=change-me-to-something-secret
    restart: unless-stopped

volumes:
  editions-data:
```

```bash
docker compose up -d
```

Open `http://localhost:3007` and register your first account — it automatically becomes the admin.

### Docker

```bash
docker run -d \
  --name editions \
  -p 3007:3007 \
  -v editions-data:/data \
  -e EDITIONS_JWT_SECRET=change-me-to-something-secret \
  ghcr.io/morten-olsen/editions:latest
```

### Build from source

Requires Node.js 24+ and pnpm 10+.

```bash
git clone https://github.com/morten-olsen/editions.git
cd editions
pnpm install
pnpm --filter @editions/web build
cd apps/server
node --experimental-strip-types src/server.ts
```

## Configuration

Editions loads config from these locations (later overrides earlier):

1. `/etc/editions/editions.json`
2. `~/.config/editions/editions.json`
3. `./editions.json`
4. Environment variables

| Environment variable | Description | Default |
|---|---|---|
| `EDITIONS_HOST` | Bind address | `0.0.0.0` |
| `EDITIONS_PORT` | Port | `3007` |
| `EDITIONS_DB` | SQLite database path | `./editions.db` |
| `EDITIONS_JWT_SECRET` | Secret for signing auth tokens | Random (sessions lost on restart) |

Set `EDITIONS_JWT_SECRET` to a stable value in production — otherwise every restart logs everyone out.

## Quick setup guide

1. **Register** — first account becomes admin
2. **Add sources** — paste RSS feed URLs
3. **Create focuses** — define topics ("Tech", "Science", "Local News") and link them to sources
4. **Wait a moment** — Editions fetches feeds, extracts articles, and runs ML classification automatically
5. **Create an edition** — set a schedule, pick your focuses, set time budgets
6. **Read** — your first edition will be ready on the next scheduled run

## Status

Editions is **alpha software**. It works, but expect rough edges, bugs, and breaking changes. The database schema may change between versions — back up your `editions.db` before updating.

If something breaks, [open an issue](https://github.com/morten-olsen/editions/issues).

## License

[AGPL-3.0](LICENSE)
