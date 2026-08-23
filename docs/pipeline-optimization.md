# Pipeline Optimization

How the analysis pipeline avoids redundant work, and what optimizations remain. For the pipeline's structure see [article-analysis.md](article-analysis.md).

## Cost model

Analysis cost is dominated by embedding (~80% of time) and NLI classification (~20%). A full analysis takes ~0.5–1s per article; with thousands of articles, naive re-analysis on every focus change would take minutes.

## Implemented

### Ingest cap (the cheapest optimization)

Some feeds serve their whole archive — thousands of items in one response. Every ingested article is
extracted, embedded and classified against every focus, so a single archive feed can cost more than
the rest of a workspace put together, for material far older than any edition lookback.

`fetchAndStoreFeed` therefore ingests at most `sources.maxArticlesPerFetch` items per fetch (default
200, configurable in `editions.json`). `selectItemsToIngest` picks the newest by `publishedAt`, or
the **oldest** when the source's `direction` is `"oldest"` — a backlog source is read forwards, so
capping to the newest would mean the start of the archive never arrives. Undated items rank last but
keep their feed order.

The cap applies per fetch, not per source: a feed that publishes normally accumulates history across
fetches as usual, and only an archive dump is truncated. `parseRssFeed` stays faithful to the feed —
the cap belongs to ingest, so parsing remains a pure function of the document.

Note this only bounds *new* ingest. A source that already accumulated thousands of articles before
the cap existed keeps them.

### Skip re-embedding

Embeddings are content-dependent, not focus-dependent. The embed step (`reconciler.embed.ts`) only processes articles with **no embedding or an embedding from a different model** — a focus change never re-embeds. This saves ~80% of per-article cost on reclassification.

### Incremental, scoped reconciliation

`reconcile({ scopeFilter })` accepts source and/or focus scopes. When a focus is added or changed, only (article × that-focus) pairs are scored — the similarity/nli steps query for missing or stale pairs, and upserts are per (article, focus), so other focuses are untouched. Focus-only runs pass `skipExtract: true`.

### Similarity classification (default)

The default classifier is embedding similarity, not NLI: cosine similarity (a dot product — embeddings are L2-normalized) between the stored article embedding and the focus-label embedding, which is embedded once per run and cached (`reconciler.similarity.ts`). Reclassification becomes I/O-bound instead of compute-bound — sub-millisecond per pair.

**Quality tradeoff:** for well-defined topics ("Climate Change", "Local Seattle News"), similarity achieves ~85–90% agreement with NLI; for vague focuses ("Interesting") agreement drops to ~60–70%, mostly on borderline articles near the threshold.

### Hybrid mode

`analysis.classifier: "hybrid"` stores both signals: the similarity step gives instant scores, then the NLI step refines every scored pair in the background. The read side prefers NLI when present — `effectiveConfidence` in `ranking/ranking.ts` is `nli ?? similarity ?? 0`, and its SQL twin `minConfidenceFilterSql` applies the same rule in threshold queries.

**Confidence scale caveat:** NLI and similarity scores have different distributions — similarity clusters in a narrower range. The `similarity_model`/`nli_model` columns identify which model produced each score, enabling future per-method calibration.

### Stale-score detection via model columns

`article_embeddings.model`, `article_focuses.similarity_model`, and `article_focuses.nli_model` let each step detect scores produced by a different model and recompute only those. This is also how data imports from an instance with different models heal.

## Not implemented

### Batch inference

Transformers.js supports batched inputs; batching 16–32 articles per model invocation should give 2–4× throughput on the NLI step. If added, the batching belongs **inside** the steps' `processBatch` (which already receives batches but currently loops one item at a time) — a previous public batch protocol on the worker/service went unused and was deleted.

### Cross-run focus-embedding cache

The similarity step's focus-embedding cache is per-`reconcile()` call; every run re-embeds each focus label once (~50ms each). A longer-lived cache keyed on (focus label, model) would shave that off frequent scoped runs.
