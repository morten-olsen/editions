# Feed & Edition Algorithms

How articles are ranked and selected across the three feed types: global feed, focus feeds, and editions.

## Core scoring function

All feeds share the same scoring formula when using "top" sort:

```
score = α × confidence + β × voteSignal + γ × recency
```

The weights vary by feed type to match each context:

| Feed type | α (confidence) | β (votes) | γ (recency) | Rationale |
|-----------|---------------|-----------|-------------|-----------|
| Global | 0 | 0.6 | 0.4 | No focus context; recency matters most alongside votes |
| Focus | 0.4 | 0.4 | 0.2 | Balanced — confidence is meaningful, recency still significant |
| Edition | 0.5 | 0.4 | 0.1 | Lookback window handles freshness; confidence drives selection |

The scoring formula and everything around it live in the **ranking module** (`ranking/ranking.ts`): the single entry point is `scoreAndRank({ candidates, voteContext, weights, sourceWeights?, focusWeight? })`, which scores each candidate exactly once (including the source/focus weight multipliers) and returns `{ item, score }` pairs sorted highest-first. The module also owns the embedding wire format (`decodeEmbedding` — callers pass raw BLOBs) and both halves of the confidence rule (`effectiveConfidence` in TypeScript, `minConfidenceFilterSql` for SQL-side threshold filtering).

Weight presets are exposed as `defaultUserScoringWeights` — users can customise all weights via **Settings > Scoring** (stored as JSON in `users.scoring_weights`).

### Confidence

A value from 0.0–1.0 representing how well an article matches a focus, produced by the focus classification pipeline (see [article-analysis.md](article-analysis.md)). In the global feed, confidence is unused (α = 0) since there's no focus context.

### Vote signal

If the user has directly voted on the article (±1), that value is used as-is. Otherwise, the signal is propagated from similar voted articles using **top-k similarity-weighted propagation**:

1. Compute cosine similarity between the candidate and every voted article.
2. Discard voted articles below a minimum similarity threshold (0.4, `PROPAGATION_MIN_SIMILARITY`).
3. Keep the top 15 most similar (`PROPAGATION_TOP_K`).
4. Compute a similarity-weighted average:

```
voteSignal = sum(vote_i × sim_i) / sum(sim_i)
```

This ensures only semantically relevant votes influence the score — what matters is how similar the nearby votes are, not how many total votes exist.

**Vote ramp:** with fewer than 5 votes in the context (`VOTE_RAMP_THRESHOLD`), β is scaled down proportionally (`β × voteCount/5`) and the slack shifts into α (`α + β × (1 − voteCount/5)`). This avoids over-weighting sparse vote signal: a user's first couple of votes nudge the ranking instead of dominating it, and the configured α/β balance only fully applies from 5 votes onward.

- Embeddings come from the configured embedding model (default `bge-small-en-v1.5`) and are L2-normalized, so dot product = cosine similarity.
- Up to 200 most recent votes are loaded per context (`MAX_VOTE_CONTEXT_SIZE`).
- If no votes pass the similarity threshold (or no embedding exists), vote signal = 0.

### Recency decay

Exponential decay with a 3-day half-life:

```
recency = 0.5 ^ (daysSincePublished / 3)
```

Articles without a publish date get a neutral 0.5.

## Vote scoping

Votes exist at three scopes, loaded independently and merged with later scopes taking precedence:

| Scope | Stored as | Used by |
|-------|-----------|---------|
| Global | `focus_id IS NULL, edition_id IS NULL` | All feeds |
| Focus | `focus_id = X, edition_id IS NULL` | Focus feeds, editions |
| Edition | `edition_id = X` | Editions only |

**Merging:** When multiple scopes apply, they merge left-to-right. For a duplicate article, the narrower scope's vote wins. Voted-article lists concatenate (duplicates average out during propagation).

- Focus feed context: `merge(global, focus)`
- Edition context: `merge(merge(global, focus), edition)`

## Global feed

Two sort modes:

- **recent** — `published_at DESC`, no scoring. Score returned as 0.
- **top** — scored with global weights (α=0, β=0.6, γ=0.4). Global votes only, no source weights.

Filters: read status (unread/read/all), date range.

Source: `feed/feed.ts` (route plumbing in `api/feed.routes.ts`, scoring via `ranking/ranking.ts`)

## Focus feeds

Two sort modes:

- **recent** — `published_at DESC`. Score = confidence (no vote propagation).
- **top** — scored with focus weights (α=0.4, β=0.4, γ=0.2), then multiplied by source weight:

```
finalScore = score(candidate, mergedContext, focusWeights) × sourceWeight
```

Source weights come from `focus_sources.weight` (default 1). This lets users boost or suppress specific sources within a focus.

Filters: confidence threshold (`focus.minConfidence`), read status, date range, reading time range.

All candidates are fetched, scored in memory, sorted, then paginated (SQL-level pagination isn't possible when scoring requires embeddings).

Source: `focuses/focuses.articles.ts` (scoring via `ranking/ranking.ts`)

## Editions

Editions are deterministic, rule-based magazine generations. The algorithm processes each focus in position order and fills a budget.

### Per-focus scoring

```
finalScore = score(candidate, mergedContext, editionWeights) × sourceWeight × focusWeight
```

- `sourceWeight` — from `focus_sources.weight`
- `focusWeight` — from `edition_config_focuses.weight`, allows prioritizing certain topics in the edition

### Candidate filtering

For each focus, candidates must:
- Be unread
- Fall within the lookback window (`edition_config_focuses.lookback_hours`, falling back to config default)
- Meet the focus confidence threshold
- Not already be claimed by an earlier focus in this edition
- Not appear in prior editions of the same config (if `excludePriorEditions` is enabled)

### Weighted random source distribution

After scoring, articles aren't simply taken top-to-bottom. Instead, a weighted random picker ensures fair source representation:

1. Group scored candidates by source. Within each source, articles are pre-sorted by score descending.
2. For each pick, select a source randomly with probability proportional to its weight.
3. Take the next highest-scored article from that source.
4. If a source runs out of articles, remove it from the pool.
5. Repeat until the focus budget is exhausted or no candidates remain.

This prevents a prolific high-scoring source from consuming the entire budget and ensures weight ratios are respected probabilistically over time — a source with weight 2 is twice as likely to be picked as a source with weight 1 on each draw.

### Budgeting

Each focus has a budget with a type:

- **count** — each article = 1 unit
- **reading_time** — each article = `ceil(reading_time_seconds / 60)` units (minutes)

The edition stops adding articles to a focus once its budget is consumed.

### Output

Articles across all focuses are assembled into a single ordered edition. Each article records its focus assignment and position.

Source: `editions/editions.generate.ts` (scoring via `ranking/ranking.ts`)

## Summary

| | Global feed | Focus feed | Edition |
|---|---|---|---|
| Sort modes | top, recent | top, recent | deterministic |
| Weights (α, β, γ) | 0, 0.6, 0.4 | 0.4, 0.4, 0.2 | 0.5, 0.4, 0.1 |
| Vote context | global | global + focus | global + focus + edition |
| Source weights | no | yes | yes |
| Focus weights | no | no | yes |
| Source distribution | none | none | weighted random |
| Budgeting | none | none | count or reading time |

## User-customisable weights

All scoring weights can be overridden per user via `GET/PUT/DELETE /api/settings/scoring`. Weights are stored as a JSON blob in `users.scoring_weights` (nullable — `null` means use defaults).

The API returns both the active weights and the defaults, plus an `isCustom` flag. `DELETE` resets to defaults.

The settings UI (Settings > Scoring tab) presents sliders for each feed type's three weights with per-feed and global reset options. Changes take effect on the next feed load.

Source: `api/scoring.routes.ts`, `ranking/ranking.ts` (`parseUserScoringWeights`, `defaultUserScoringWeights`), `votes/votes.ts` (`loadUserScoringWeights`, `saveUserScoringWeights`).

## Future enhancements

### Implicit signal from skipped articles

Articles shown in the feed but never opened are a weak negative signal. A `first_seen_at` timestamp on articles (or a feed impression log) would allow demoting articles that have been "available" for N days without interaction. This doesn't require new ML infrastructure — just a time-based penalty multiplied into the score:

```
skipPenalty = 1 / (1 + daysSinceFirstSeen × decayFactor)
```

Read status is already tracked, so the main addition is recording when an article first appeared in a user's feed.

### Source diversity in feeds

The global and focus feeds have no diversity mechanism. If one source publishes 50 articles and another publishes 5, the prolific source can dominate the top even with equal per-article scores. Editions solve this with weighted random, but that's too heavy for paginated feeds.

A lighter approach: position-based source penalty. After placing N articles from the same source above a given position, apply a diminishing multiplier:

```
diversityFactor = 1 / (1 + sameSourceCountAbove × 0.2)
```

This would be applied during the in-memory sort pass that already exists for "top" mode. The penalty is positional (not absolute), so a dominant source still appears — just not in an unbroken block.
