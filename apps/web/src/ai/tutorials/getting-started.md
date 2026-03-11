# Getting Started with Editions

Editions is a personal news reader that collects articles from various sources, classifies them into topics (focuses), and assembles them into curated, finite magazines (editions).

## Core concepts

- **Sources** — where articles come from. RSS feeds, podcasts, Mastodon accounts, Bluesky accounts, YouTube channels, or custom URLs.
- **Focuses** — topic areas you care about. Examples: "technology", "science", "world news". Articles are automatically classified into focuses using an on-device AI classifier.
- **Editions** — curated magazines built from your focuses. You configure how many articles, which focuses to include, and how often to generate them. Each edition is finite — it has a beginning and an end.
- **Feed** — a ranked stream of all articles between editions, for quick catch-up.

## First-time setup flow

A new user needs to:

1. **Add sources** — navigate to Sources → New Source. Choose a type (RSS is most common), enter the URL, give it a name. After adding, click "Fetch" to pull in articles.
2. **Create focuses** — navigate to Focuses → New Focus. Enter a name that describes a topic (e.g., "Artificial Intelligence"). The system will automatically classify articles into focuses after they're fetched.
3. **Create an edition config** — navigate to Editions → New Edition. Give it a name, select which focuses to include, set article budgets, and optionally set a schedule. Then generate the first edition.

## Navigation structure

- **Home** (/) — overview with setup steps and recent editions
- **Sources** (/sources) — list of all sources, add/edit/delete
- **Focuses** (/focuses) — list of focuses, add/edit/delete
- **Editions** (/editions) — edition configs and generated editions
- **Feed** (/feed) — ranked article stream
- **Bookmarks** (/bookmarks) — saved articles
- **Settings** (/settings) — tasks, votes, scoring weights
