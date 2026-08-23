# Domain Glossary

The ubiquitous language of Editions. Use these terms — in code, docs, and conversation — exactly as defined here. Full product framing: [docs/vision.md](docs/vision.md).

## Source

A content origin the user subscribes to (RSS today; Mastodon, Bluesky, YouTube later). Owns articles. A special built-in **bookmarks source** holds user-saved URLs.

## Article

A single piece of content ingested from a source. Extracted in full on ingest (for classification, reading-time estimation, and in-app reading).

## Focus

A user-defined topic area ("technology", "local news"). Articles are classified into focuses by the analysis pipeline; each (article, focus) pair carries a **confidence** — how well the article matches the focus (`nli` score if present, else embedding `similarity`, else 0).

## Vote

An up/down signal (±1) a user attaches to an article, scoped globally, to a focus, or to an edition. Votes propagate to unvoted articles through embedding similarity — the narrower scope wins on conflict. A vote affects **ranking**, not focus membership: it changes the order articles are picked in (and so what fits an edition budget), never whether an article matches a focus. Only votes on the user's own articles are accepted, since propagation pulls the voted article's embedding into that user's context.

## Ranking

The ordering of candidate articles by score: `α × confidence + β × voteSignal + γ × recency`, times source and focus weight multipliers. Owned by the ranking module (`apps/server/src/ranking/ranking.ts`) — the single place that scores articles, interprets confidence, and decodes stored embeddings. Every surface (feed, focus feeds, edition generation) ranks through it.

## Edition

The core experience: a rule-based, periodic magazine assembled from sources and focuses under an **edition config** (which focuses, budgets, schedule). Finite by design — source budgeting and reading-time budgets decide what makes the cut.

## The Feed

The between-editions surface: all unread articles ranked so highlights surface first. "Snacking", where an edition is the sit-down meal.

## Analysis pipeline (reconciler)

The background pipeline that brings articles to an analysed state: extract → embed → similarity → (optional NLI) → mark analysed. Runs via jobs; embedding/classification models run locally in a worker.

## Readiness

Whether the analysis pipeline has settled for a given scope, so counts and previews can be trusted. Owned by `readiness/readiness.ts` — the single place that decides what "settled" means, combining unanalysed-article counts, per-focus classification coverage, and in-flight jobs. Surfaced to agents on every MCP response that carries analysed data.
