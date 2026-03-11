# Article Analysis Pipeline

Article analysis is the compute-intensive second stage that runs after content extraction. It produces two outputs: **feature embeddings** (for search and clustering) and **focus classifications** (for routing articles into user-defined topic areas).

## Pipeline overview

```
fetch_source          extract_article          analyse_article
  (fetch RSS)    →    (extract full text)   →   (embed + classify)
  ~fast                ~network-bound            ~CPU-bound
```

Each stage is a task in the in-memory task queue. Stages chain: a successful extraction enqueues analysis; a successful fetch enqueues extraction. The pipeline is idempotent — reprocessing an already-analysed article is a no-op.

## Analysis state tracking

Articles track their progress through the pipeline via nullable timestamp columns:

| Column | Set when |
|--------|----------|
| `fetched_at` | Article row created from feed |
| `extracted_at` | Full content extracted from source URL |
| `analysed_at` | Embeddings computed and focus classification complete |

`analysed_at` being null means the article still needs analysis. This lets us recover from crashes: on startup (or the next feed refresh), query for articles where `extracted_at IS NOT NULL AND analysed_at IS NULL` and re-enqueue them.

### Why a single `analysed_at` rather than separate timestamps?

Embedding and classification run together in the reconciliation step. While embeddings can be skipped independently (e.g. when only reclassifying for a new focus), a single column keeps the state machine simple: `null` means pending, non-null means done.

## Feature extraction (embeddings)

**Purpose:** Dense vector representations of article content, stored for future use in semantic search, article similarity/clustering, and feed ranking.

**Model:** A small embedding model via `@huggingface/transformers` (transformers.js), running locally in Node.js. Candidate: `Xenova/all-MiniLM-L6-v2` (384-dim, ~23MB ONNX, fast on CPU).

**Storage:** Embeddings are stored in a dedicated `article_embeddings` table designed for compatibility with sqlite-vec. The table stores the raw float32 vector as a blob alongside the article ID. When sqlite-vec is added, a virtual table can be created that reads directly from this data — no migration or re-embedding needed.

Storing embeddings separately from articles keeps the articles table lean (embeddings are ~1.5KB each and are never needed for normal article listing/reading) and aligns with how sqlite-vec expects to consume vector data.

**Input:** The extracted article text (HTML stripped), truncated to the model's token limit (~256 tokens for MiniLM). Title is prepended to give the model topic signal.

## Focus classification

**Purpose:** Determine which of the user's focuses an article belongs to, with a confidence score.

**How focuses work:** A focus is a user-defined topic area like "Technology", "Local News", or "Climate". Each focus has:
- A **name** — the primary classification label
- An optional **description** — additional context for the classifier (e.g. "News about Seattle and the Pacific Northwest")
- **Source associations** with a mode:
  - `always` — every article from that source is automatically assigned to this focus (confidence 1.0, method "always", no classifier needed)
  - `match` — the configured classifier strategy determines relevance

### Classifier strategies

Classification is pluggable via the `ClassifierStrategy` interface. Three strategies are available, configured via `analysis.classifier` in `editions.json`:

| Strategy | Config value | Method | Tradeoff |
|----------|-------------|--------|----------|
| **NLI** | `"nli"` | Zero-shot NLI via BART-MNLI | Most accurate, ~0.5s per article per focus set |
| **Similarity** | `"similarity"` | Cosine similarity between article and focus embeddings | Sub-millisecond, ~85–90% agreement with NLI for well-defined topics |
| **Hybrid** | `"hybrid"` | Similarity first, NLI refinement for ambiguous scores (0.1–0.65) | Near-instant for most articles, NLI quality where it matters |

Each strategy returns `{ focusId, confidence, method }` — the `method` column in `article_focuses` tracks which classifier produced each assignment ("nli", "similarity", or "always").

**Confidence scale caveat:** NLI and similarity scores have different distributions. Similarity scores tend to cluster in a narrower range than NLI. The `method` column enables future per-method calibration or scoring weight adjustments, but raw scores are stored as-is currently.

**Output:** Results are written to the `article_focuses` junction table — one row per (article, focus) pair with a confidence score (0.0–1.0) and method. An article can match multiple focuses.

**Threshold:** All classification scores are saved to `article_focuses` regardless of value. Filtering is done at query time via the per-focus `minConfidence` setting (adjustable in the focus editor's "How closely articles must match" slider).

## Worker architecture

ML inference (embedding and classification) runs in a dedicated `worker_threads` Worker (`analysis.worker.ts`) to avoid blocking the main server event loop. The worker:

- Loads models lazily on first request, caches them for the process lifetime
- Accepts `embed` and `classify` messages via `postMessage`
- Returns results (Float32Arrays transferred zero-copy for embeddings)
- Is spawned on first analysis request by `AnalysisService` and kept alive

All DB reads/writes remain on the main thread — only the pure CPU-bound inference moves to the worker. The `AnalysisService.embed()` and `classify()` methods are thin async wrappers that send messages to the worker and return promises.

## Model lifecycle

Models are loaded lazily on first use inside the worker and cached in memory for the lifetime of the process. Loading a model takes a few seconds and ~100-300MB RAM depending on the model. For a small self-hosted server this is acceptable.

Models are downloaded on first run to a local cache directory (`~/.cache/huggingface` by default via transformers.js). No data leaves the server at inference time.

## Recovery and resilience

- **Server restart mid-analysis:** On startup, query for articles needing analysis and re-enqueue them. This is cheap — the query is indexed and the task queue handles dedup.
- **Failed analysis:** If a model fails on a specific article (OOM, malformed text), the task fails but doesn't block the pipeline. The article stays with `analysed_at = null` and can be retried.
- **New focuses added:** When a user creates a new focus and associates sources, existing articles from those sources need reclassification. The reconciliation engine handles this efficiently — `reconcile()` with `focusIds` scope only classifies against the new focus, and `skipEmbedding: true` avoids recomputing embeddings.
- **Focus updated/deleted:** Deleting a focus cascades to `article_focuses`. Updating a focus name/description should trigger reclassification of associated articles.
- **Force re-analysis of a source:** `AnalysisService.reanalyseSource()` clears existing classifications and resets `analysed_at`, then enqueues `analyse_article` tasks. `reanalyseAll()` does the same across all sources.

## Data model changes

### articles table

Add one column:

| Column | Type | Notes |
|--------|------|-------|
| `analysed_at` | text | ISO 8601 timestamp, null until analysis completes |

### New: article_embeddings table

Separate table for vector storage, designed for sqlite-vec compatibility.

| Column | Type | Notes |
|--------|------|-------|
| `article_id` | text PK, FK → articles | One embedding per article, cascade delete |
| `embedding` | blob | Float32 vector (e.g. 384 × 4 bytes = 1,536 bytes for MiniLM) |
| `model` | text | Model identifier used to generate the embedding (e.g. `all-MiniLM-L6-v2`) |
| `created_at` | text | ISO 8601 timestamp |

The `model` column lets us detect when the configured model changes and re-embed articles as needed.

### Existing: article_focuses table

Supports multiple focuses per article with confidence scores and classification method tracking:

| Column | Type | Notes |
|--------|------|-------|
| `article_id` | text FK → articles | |
| `focus_id` | text FK → focuses | |
| `confidence` | real | 0.0–1.0 |
| `method` | text | Classifier that produced this assignment: "nli", "similarity", or "always" |
| `assigned_at` | text | |

Unique on `(article_id, focus_id)` — upserts on re-analysis.

### Schema type additions

```typescript
type ArticleEmbeddingsTable = {
  article_id: string;
  embedding: Buffer;
  model: string;
  created_at: Timestamp;
};
```

## Task registration

New task type: `analyse_article` with payload `{ articleId: string }`.

Registered alongside `fetch_source` and `extract_article` in the source task handlers. Enqueued automatically when extraction completes successfully.

## Article voting and scoring

User votes are explicit relevance signals that complement the automated classification. The voting system uses the existing article embeddings to propagate taste preferences across similar content.

### Vote types

- **Global vote** (`focus_id IS NULL`) — "I like/dislike this content overall"
- **Focus-scoped vote** (`focus_id` set) — "This does/doesn't belong in this focus"

A user can have both a global and a focus-scoped vote on the same article — they are independent signals. For example, upvoting globally ("good article") while downvoting in a focus ("but not relevant to this topic").

### Scoring formula

Articles are ranked using a combined score:

```
score = α × confidence + β × vote_signal + γ × recency_decay
```

Where:
- **α = 0.5** — NLI classifier confidence (the existing signal)
- **β = 0.4** — vote-derived signal (direct vote or similarity propagation)
- **γ = 0.1** — recency decay (half-life of 3 days)

### Vote signal computation

1. **Direct vote** — if the user voted on this exact article, the vote value (+1 or -1) is used directly as the vote signal. This takes precedence over propagation to avoid double-counting.

2. **Similarity propagation** — if no direct vote exists, the signal is computed from cosine similarity to all voted articles:

   ```
   vote_signal = Σ(vote_value × cosine_sim(candidate, voted)) / N
   ```

   This uses the article embeddings already stored in `article_embeddings`. An upvoted article pulls semantically similar articles up; a downvoted article pushes similar ones down.

3. **No votes** — vote signal is 0, falling back to confidence + recency only.

### Integration points

The scoring system is used in two places:

- **`FocusesService.listArticles()`** — focus feed. Loads all articles for the focus, scores them, sorts by combined score, then paginates. Both focus-scoped and global vote contexts are loaded and merged (focus-scoped wins on conflict).

- **`EditionsService.generate()`** — edition generation. Candidates per focus are scored and ranked before the round-robin source-diversification step. Global vote context is loaded once; focus-scoped context per focus.

### Performance notes

- Vote context is capped at the 200 most recent votes per scope to bound memory and query cost.
- Cosine similarity is a simple dot product (MiniLM embeddings are L2-normalized).
- Articles without embeddings still get scored via confidence + recency; the vote propagation term is 0.

### API routes

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/articles/:articleId/vote` | Get global vote (200 with vote, 204 if none) |
| PUT | `/api/articles/:articleId/vote` | Upsert global vote `{ value: 1 \| -1 }` |
| DELETE | `/api/articles/:articleId/vote` | Remove global vote |
| PUT | `/api/focuses/:id/articles/:articleId/vote` | Upsert focus-scoped vote |
| DELETE | `/api/focuses/:id/articles/:articleId/vote` | Remove focus-scoped vote |
| GET | `/api/votes` | List all user votes with article info (paginated, filterable by `scope` and `value`) |
| DELETE | `/api/votes/:voteId` | Remove a vote by ID |

Focus feed article responses include both `vote` (focus-scoped) and `globalVote` (global quality) fields, allowing the UI to show both dimensions independently. The article reading page loads and displays the global vote via the GET endpoint.

### Vote management

The `/votes` page provides a chronological view of all votes cast. Users can filter by scope (quality/relevance) and direction (up/down), and remove individual votes. Removing a vote immediately updates the ranking on subsequent page loads.

## Future considerations

- **Batch processing:** Transformers.js supports batched inference. Once the pipeline is stable, batch multiple articles per model invocation to improve throughput.
- **Model selection config:** Let users choose embedding/classification models via `editions.json` config.
- **sqlite-vec integration:** Create a sqlite-vec virtual table backed by `article_embeddings` for ANN (approximate nearest neighbor) search. The blob format is already float32-compatible.
- **Incremental reclassification:** Rather than re-analysing all articles when a focus changes, only reclassify articles from the affected sources.
- **Per-focus confidence thresholds:** Let users tune the minimum confidence for each focus rather than relying on a single global default.
