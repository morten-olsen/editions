# Pipeline Optimization

Strategies for improving analysis pipeline performance, particularly when focuses change and articles need reclassification.

## Current cost

Analysis runs embedding (~80% of time) and NLI classification (~20%) per article. A full re-analysis takes ~0.5–1s per article. With thousands of articles, focus changes take minutes.

## Optimization strategies

### 1. Skip re-embedding on focus changes

Embeddings are content-dependent, not focus-dependent. When a focus changes, only classification needs to re-run. This alone saves ~80% of per-article cost.

**Implementation:** Track embedding and classification state separately (or pass a flag to the pipeline). The refactored pipeline supports this via composable steps — compose a pipeline that loads existing embeddings instead of recomputing them.

### 2. Incremental classification

When a focus is added or changed, only classify articles against **that focus**, not all focuses. Existing classifications for other focuses are still valid.

**Implementation:** The pipeline accepts a focus scope. `storeFocusAssignments` upserts per (article, focus) pair, so running for one focus doesn't disturb others.

### 3. Batch inference

Transformers.js supports batched inputs. Instead of one article at a time through the NLI model, batch 16–32 articles. This better utilizes CPU vector instructions. Expect 2–4x throughput.

**Implementation:** Worker accepts batch requests. Orchestrator groups articles before dispatching.

### 4. Embedding-based classification

Instead of running the NLI model, classify using cosine similarity between article embeddings and focus label embeddings.

**How it works:**
1. Embed the focus name+description using the same MiniLM model (one call, cached)
2. For each article, compute cosine similarity (= dot product, since embeddings are L2-normalized) between its stored embedding and the focus embedding
3. Use similarity as the confidence score

**Performance:** Sub-millisecond for thousands of articles. The entire reclassification becomes I/O-bound (reading embeddings from SQLite), not compute-bound.

**Quality tradeoff:** NLI and embedding similarity measure different things:
- NLI asks "does this text **entail** 'this is about Technology'?" — trained on natural language inference
- Embedding similarity asks "how semantically close are these texts?" — trained on sentence similarity

For well-defined topics ("Climate Change", "Local Seattle News"), embedding similarity achieves ~85–90% agreement with NLI. For vague or subjective focuses ("Interesting", "Worth Reading"), agreement drops to ~60–70%. Most disagreements are borderline articles near the confidence threshold.

**Implementation:** The refactored pipeline uses a `ClassifierStrategy` interface. Swap `createNliStrategy()` for `createEmbeddingSimilarityStrategy()` — the pipeline composition is identical.

### 5. Hybrid approach (recommended)

Combine embedding similarity for instant results with background NLI refinement:

1. When a focus changes, embed the focus text (one call, ~50ms)
2. Load all article embeddings for affected sources
3. Compute cosine similarity — instant ranking (milliseconds)
4. Write results to `article_focuses`
5. Queue background NLI refinement for articles in the ambiguous zone (similarity 0.3–0.6)
6. NLI results overwrite embedding results as they complete

User sees instant results. Background refinement corrects borderline cases.

## Expected speedups

| Optimization | Speedup | Effort |
|---|---|---|
| Skip re-embedding | ~5x | Low |
| Incremental (only changed focus) | N_focuses× | Low |
| Batch NLI (16–32) | 2–4x | Low |
| Embedding similarity instead of NLI | ~1000x | Medium |
| Hybrid (embedding + background NLI) | Instant perceived | Medium–high |

## Pipeline architecture

The analysis pipeline uses a **reconciliation pattern** (see `analysis.reconcile.ts`). The `reconcile()` function takes a batch of article IDs and brings each to its ideal state through composable steps:

1. **`ensureEmbeddings`** — compute missing embeddings (skippable via `skipEmbedding` option)
2. **`ensureFocusClassifications`** — classify against linked focuses that lack assignments (scopable to specific focus IDs)
3. **Mark analysed** — set `analysed_at` timestamp

Each step is idempotent — it checks current state before processing. Different use cases compose naturally:

- **Full analysis** — new articles from feed → all steps run
- **Classify only** — focus added/changed → `skipEmbedding: true`, `focusIds: [newFocusId]`
- **Re-embed only** — model changed → clear embeddings, reconcile re-creates them

Classification uses a pluggable `ClassifierStrategy` interface configured via `editions.json`. Three strategies are available: NLI, embedding similarity, and hybrid. See [article-analysis.md](article-analysis.md) for details.

### Confidence scale caveat

NLI and similarity scores have different distributions — similarity tends to cluster in a narrower range. The `method` column in `article_focuses` tracks which classifier produced each assignment, enabling future per-method calibration or scoring weight adjustments. This is a known gap that should be addressed before hybrid fully replaces NLI in ranking-critical paths.
