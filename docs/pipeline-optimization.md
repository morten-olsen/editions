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

**Quality:** measured against human labels by `apps/eval` (3 feed corpora, 15 focuses, 20–30 labelled
articles each; metrics taken at each focus's own optimal threshold), similarity is **not** a
degradation of NLI — the two are within noise of each other, and `bge-small-en-v1.5` similarity is
the best or near-best config on every corpus:

| Corpus | similarity (MiniLM-L6) | NLI (MiniLM-L6) | Cost multiple |
|---|---|---|---|
| ars-technica | 0.803 F1 | 0.834 F1 | 61× |
| nyt-world | **0.931** F1 | 0.920 F1 | 51× |
| theverge | **0.790** F1 | 0.783 F1 | 108× |

NLI wins once, marginally, and loses twice, for 50–108× the time. `bge-small` similarity reaches
0.864 on ars-technica, beating every NLI run there. Treat NLI as an experiment, not a quality
upgrade, and re-run the eval before changing the default.

**What actually drives quality is focus specificity, not the classifier or the threshold.** Averaged
across all six embedding models, precision at each focus's own optimal threshold splits cleanly by
how concrete the focus is:

| Precision | Focuses |
|---|---|
| 0.89–1.00 | Electric Vehicles, Russia & Ukraine, Middle East Conflict, Latin America, Cybersecurity & Privacy |
| 0.53–0.70 | Gaming & Entertainment, Big Tech & Business, Policy & Regulation, Gadgets & Hardware, Science & Space |

Narrow focuses naming concrete things separate cleanly; broad category-style focuses cap out around
0.6 precision at *any* threshold, because embedding similarity measures topical relatedness rather
than membership and every article in a tech feed is somewhat "big tech business".

Caveat: the corpora are small (20–30 articles per feed), so treat the ordering of close results as
indicative rather than settled.

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
