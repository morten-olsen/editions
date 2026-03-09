# Vision

Editions is a self-hosted news reader that makes reading news online purposeful, joyful, informative, calm and rewarding.

## The problem

News aggregation today falls into two failure modes:

1. **Firehose timelines** — most RSS readers dump everything into a single chronological stream. A prolific publication buries a small specialized blog. Users feel overwhelmed and behind.
2. **Algorithmic feeds** — engagement-optimized ranking maximizes time-on-screen, not informed readers. The well-documented harms need no elaboration.

Neither respects the reader's time or attention.

## The feeling we're after

Reading an Edition should feel like settling into a favourite chair with a good magazine — quiet, deliberate, finite. When Flipboard launched on the original iPad it approached this feeling: a curated digital edition of your world. The technology available today should let us do something meaningfully better.

## Core concepts

### Sources

Content origins the user subscribes to. Initially RSS; the architecture supports Mastodon, Bluesky, YouTube, and custom sources in the future.

### Focuses

User-defined topic areas: *global news*, *local news*, *technology*, *science*, etc. An offline LM (ONNX / transformers.js) classifies incoming articles into the user's focuses. Classification happens on-device — no data leaves the server.

Focuses learn from the reader over time. Upvoting and downvoting articles — either globally or within a specific focus — trains the system using semantic similarity. An upvote on a climate policy article teaches the system to surface similar content; a downvote within a "Technology" focus teaches it that policy articles don't belong there, even if the reader enjoys them elsewhere. The signal propagates through article embeddings, so a handful of votes shapes the ranking of hundreds of articles.

### Editions

The core experience. An Edition is a rule-based, periodic magazine assembled from the user's sources and focuses:

- **Source budgeting** — no single source dominates; small blogs get proportional representation.
- **Article weighting** — importance, relevance and recency determine inclusion.
- **Reading-time budgeting** — editions target a time budget (e.g. "15 minutes"), not just an article count. This requires article extraction by default.
- **Finite by design** — the reader reaches the end. "I am now done" is a first-class feature.

Users configure edition rules: which focuses to include, source budgets, target reading time, and schedule (morning daily, weekly digest, etc.).

### The Feed

For moments between editions — quick catch-up, killing time. All unread articles carefully ranked so the most important highlights surface first. This is the "snacking" complement to the "sit-down meal" of an edition.

### Article extraction

Enabled by default. Full article content is extracted on ingest. This serves three purposes:

1. Focus classification needs the full text to work well.
2. Reading-time estimation requires knowing actual article length.
3. End-to-end reading experience — the user never has to leave the app.

## Deployment model

Small-scale self-hosting: one or a handful of users per server. Not a SaaS platform. Configuration and taste are personal — the system should be simple to run and own.

## Design principles

- **Calm over anxious** — no unread counts, no urgency signals, no red badges.
- **Finite over infinite** — every surface has a natural end.
- **Proportional over prolific** — source budgeting prevents any single feed from dominating.
- **Offline-first intelligence** — classification and ranking run locally; nothing phones home.
- **Reader over product** — no metrics, no engagement optimization, no growth loops.
