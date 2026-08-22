# Article Analysis Pipeline

Article analysis brings ingested articles to an analysed state. It produces two outputs: **feature embeddings** (used for vote propagation and ranking) and **focus classifications** (confidence scores routing articles into user-defined topic areas).

The pipeline lives in the **reconciler module** (`apps/server/src/reconciler/`). Its public interface is small: `ReconcilerService.reconcile(options)` plus two module-level functions, `buildReconcileSteps` (the pipeline's composition — used by production and tests alike) and `applyAnalysisReset` (clearing derived state so the pipeline redoes it).

## Pipeline overview

`reconcile()` runs a fixed sequence of steps, each draining a DB query to exhaustion before the next starts:

```
extract  →  embed  →  similarity  →  [nli]  →  mark_analysed
network     CPU        CPU (fast)     CPU (slow)   bookkeeping
```

- **extract** (`reconciler.extract.ts`) — fetches full article content via `@extractus/article-extractor` (with a per-site extractor registry in `extractors/` for future site-specific tweaks), converts to Markdown, computes reading time, sets `extracted_at`. Skipped when `skipExtract` is set (e.g. focus-only reconciles). Podcast articles are never extracted — their feed content is the "extraction".
- **embed** (`reconciler.embed.ts`) — embeds prepared text (title + content, truncated — see `prepareText` in `reconciler.utils.ts`) for articles missing an embedding or embedded with a different model. Articles with no usable text are skipped.
- **similarity** (`reconciler.similarity.ts`) — scores every (article × focus) pair for the same user by cosine similarity between the article embedding and the focus-label embedding (cached per run). `focus_sources` does **not** limit which pairs get scored — it controls display thresholds.
- **nli** (`reconciler.nli.ts`) — zero-shot classification via BART-MNLI for pairs that have similarity but no current NLI score. Only runs when the configured classifier is `nli` or `hybrid`.
- **mark_analysed** (`reconciler.mark-analysed.ts`) — stamps `analysed_at` on every extracted article in scope. Note: this includes articles the embed step skipped for having no text — intentional, so they aren't reprocessed forever. The runner's progress (`completed` vs `total`) is where skips become visible.

Each step is a `ReconcileStep` — `{ name, fetchBatch, processBatch, countRemaining? }` (`reconciler.runner.ts`). The runner (`runReconcileSteps`) drains each step, reports progress with **real totals** (via `countRemaining`), and isolates failures: a failing step is recorded but later steps still run; the aggregate `ReconcileStepsError` is thrown at the end so the surrounding job still reports failure.

## Classifier strategies

Configured via `analysis.classifier` in `editions.json` (default `"similarity"`). The mapping from strategy to steps lives in `buildReconcileSteps`:

| Strategy | Steps run | Tradeoff |
|----------|-----------|----------|
| `similarity` | embed + similarity | Sub-millisecond per pair; ~85–90% agreement with NLI for well-defined topics |
| `nli` | embed + similarity + nli | Most accurate, ~0.5s per article per focus set |
| `hybrid` | same as `nli` | Both signals stored; read side prefers NLI (`effectiveConfidence` in `ranking/ranking.ts`: `nli ?? similarity ?? 0`) |

All scores are saved regardless of value; filtering happens at query time against per-focus (and per-source) `minConfidence` via `minConfidenceFilterSql` from the ranking module.

## Resets — re-analysis and re-extraction

Clearing derived state lives behind the reconciler's interface (`applyAnalysisReset`), driven by `ReconcileOptions`:

- `reset: 'scores'` — delete classifications and null `analysed_at` (focus-scoped resets clear only that focus's rows), keeping content and embeddings.
- `reset: 'content'` — additionally delete embeddings and null `content`/`extracted_at` so extraction redoes everything (podcast articles keep their content).
- `backfillExtractedAt` — mark content-bearing articles as extracted first, so articles ingested before extraction tracking existed re-enter the pipeline.

The job layer (`jobs/jobs.handlers.ts`) expresses every analysis job as a **preset** over these options — `reconcile_focus`, `reanalyse_source`, `reanalyse_all`, `re_extract_source`, `re_extract_all`, `extract_and_analyse` are one operation with different reset/scope parameters. Job types and payloads are a typed registry in `jobs/jobs.ts` (`JobPayloads`); a typo'd job type is a compile error. `refresh_source` is the exception: it first ingests the feed (`SourcesService.ingestFeed`) and then reconciles the source.

## Analysis state tracking

| Column | Set when |
|--------|----------|
| `created_at` | Article row created from feed |
| `extracted_at` | Full content extracted (or at ingest, for podcasts) |
| `analysed_at` | Pipeline completed for this article |

Recovery: on server start, articles with `extracted_at IS NOT NULL AND analysed_at IS NULL` trigger a `reanalyse_all` job (`app.ts`).

## Worker architecture

ML inference runs in a dedicated `worker_threads` worker (`reconciler.worker.ts`) so the main event loop never blocks. The worker loads models lazily on first request and caches them for the process lifetime; embeddings transfer back zero-copy. `ReconcilerService.embed`/`classify` are thin promise wrappers over the message protocol, and are exactly the shape the step factories inject (`EmbedFn`, `ClassifyFn`) — tests substitute fakes at that seam and compose the real pipeline via `buildReconcileSteps` (see `reconciler.test.ts`).

**Models** (defaults in `reconciler.ts`): embedding `Xenova/bge-small-en-v1.5` (384-dim, ~33MB ONNX; chosen over `all-MiniLM-L6-v2` on eval F1), classifier `Xenova/bart-large-mnli`. Downloaded on first run to `~/.cache/huggingface` (override with `HF_HOME`). No data leaves the server at inference time.

## Data model

### article_embeddings

| Column | Type | Notes |
|--------|------|-------|
| `article_id` | text PK, FK → articles | One embedding per article, cascade delete |
| `embedding` | blob | Float32 vector (decode via `decodeEmbedding` in `ranking/ranking.ts` — the ranking module owns the wire format) |
| `model` | text | Lets the embed step detect model changes and re-embed |
| `created_at` | text | |

Stored separately from articles for sqlite-vec compatibility and to keep the articles table lean.

### article_focuses

| Column | Type | Notes |
|--------|------|-------|
| `article_id` / `focus_id` | text FKs | Unique pair, upserts on re-analysis |
| `similarity` / `similarity_model` | real / text | Cosine similarity + producing model |
| `nli` / `nli_model` | real / text | NLI score + producing model |
| `assigned_at` | text | |

Model columns enable automatic rescoring when models change — the similarity/nli steps recompute on mismatch. This is also how imports from an instance with different models heal: the import enqueues a `reconcile_focus` per focus and mismatched scores get redone.

## Scoring and votes

Ranking — how confidence, votes, and recency combine into article ordering — is owned by the **ranking module** and documented in [feed-algorithms.md](feed-algorithms.md). In short: `scoreAndRank` combines `effectiveConfidence` (from this pipeline's outputs), top-k similarity-weighted vote propagation (through the embeddings this pipeline produces), and recency decay.

## Future considerations

- **Batch inference:** transformers.js supports batching. If added, it belongs inside the steps' `processBatch` (where batches already exist) — a previous public batch protocol on the worker went unused and was removed.
- **sqlite-vec integration:** a virtual table backed by `article_embeddings` for ANN search; the blob format is already float32-compatible.
- **Model selection config:** expose embedding/classifier model choice via `editions.json`.
