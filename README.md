# Editions

**Your news, in magazine form. No algorithms trying to ruin your life.**

Remember magazines? You'd pick one up, read it, reach the last page, and put it down. You felt *informed*, not *anxious*. Nobody had engineered it to make you feel behind, or angry, or unable to stop scrolling.

Editions brings that back. It's a self-hosted news reader that assembles your RSS feeds into finite, curated magazines — shaped by your interests, built on your schedule, and designed to *end*. You read it, you're done, you go outside. Revolutionary concept, apparently.

No engagement optimization. No unread counts screaming at you. No data leaving your server. No venture capital demanding you become addicted. Just your news, on your terms.

## How it works

### 1. Subscribe to sources

Add RSS feeds. That's it. Your favorite blogs, news outlets, podcasts — if it has an RSS feed, Editions can read it.

### 2. Define your focuses

Create topic areas — "Technology", "Climate", "Local News", whatever you care about. An on-device ML model (zero-shot NLI, runs entirely on your server) reads every incoming article and classifies it into your focuses automatically. Nothing phones home. Your reading habits are nobody's business.

### 3. Build your magazine

This is where it gets good. You create **edition configs** — basically magazine templates with rules:

| Section | Focus | Budget | What you get |
|---|---|---|---|
| Quick hits | Tech News | 5 articles, under 5 min each | Fast headlines to start |
| Deep dive | Tech Policy | 20 minutes of reading time | The regulation and politics behind the tech |
| Indie voices | Favorite Blogs | up to 10 articles | Brilliant people who don't have a marketing team |
| Long reads | Featured | 5 articles, no time limit | The pieces worth settling in for |

Each section draws from a different focus with its own budget. **Source budgeting** makes sure no single prolific feed dominates — that small independent blog gets a fair slot next to The Verge. Set a schedule (daily, weekly, whenever), and Editions assembles your magazine automatically.

You sit down. You read it. You reach the end. You feel *done*. That's the whole point.

### 4. Everything else

**The feed** — For moments between editions. A ranked stream of all your articles where the best stuff floats to the top. Think of it as snacking between sit-down meals.

**Voting** — Upvote and downvote articles to teach the system your taste. Here's the clever bit: votes propagate through semantic similarity. A few votes on climate policy articles will shift the ranking of *hundreds* of similar pieces you haven't even seen yet. Vote globally ("good article") or within a specific focus ("interesting, but not for *this* topic").

**Bookmarks** — Save articles for later. Some features don't need a pitch.

## The stack

Nothing exotic, nothing that requires a PhD to deploy:

- **Server:** Node.js + Fastify + SQLite (via Kysely) — one process, one database file
- **Frontend:** React + Vite + Tailwind CSS + TanStack Router
- **ML:** Hugging Face Transformers.js — embeddings and classification run locally in a worker thread
- **Deployment:** Single Docker container, no external services, no cloud dependencies

Your entire news setup lives in one SQLite file. Back it up, move it, delete it — you're in control.

## Get started in 60 seconds

### Docker Compose (recommended)

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

Open `http://localhost:3007` and register — the first account automatically becomes admin.

### Docker (one-liner)

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

| Variable | What it does | Default |
|---|---|---|
| `EDITIONS_HOST` | Bind address | `0.0.0.0` |
| `EDITIONS_PORT` | Port | `3007` |
| `EDITIONS_DB` | SQLite database path | `./editions.db` |
| `EDITIONS_JWT_SECRET` | Secret for signing auth tokens | Random (sessions lost on restart) |
| `EDITIONS_ALLOW_SIGNUPS` | Allow new user registration | `true` |

**Important:** Set `EDITIONS_JWT_SECRET` to a stable value in production — otherwise every restart logs everyone out.

Set `EDITIONS_ALLOW_SIGNUPS=false` after you've created your accounts, unless you enjoy surprise guests.

## Quick setup

1. **Register** — first account becomes admin
2. **Add sources** — paste RSS feed URLs
3. **Create focuses** — define your topics and link them to sources
4. **Wait** — Editions fetches feeds, extracts articles, and classifies them automatically
5. **Create an edition config** — pick focuses, set budgets, choose a schedule
6. **Read your first edition** — ready on the next scheduled run (or generate one immediately)

## Status

Editions is **alpha software**. It works, but expect rough edges, breaking changes, and the occasional "why did it do that" moment. Back up your `editions.db` before updating.

Something broken? [Open an issue.](https://github.com/morten-olsen/editions/issues)

## License

[AGPL-3.0](LICENSE) — because your news reader shouldn't be a product either.
