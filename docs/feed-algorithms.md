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

Weight presets are defined as `globalWeights`, `focusWeights`, `editionWeights` in `votes/votes.scoring.ts`. These are the defaults — users can customise all weights via **Settings > Scoring** (stored as JSON in `users.scoring_weights`).

### Confidence

A value from 0.0–1.0 representing how well an article matches a focus, produced by the focus classification pipeline (see [article-analysis.md](article-analysis.md)). In the global feed, confidence is unused (α = 0) since there's no focus context.

### Vote signal

If the user has directly voted on the article (±1), that value is used as-is. Otherwise, the signal is propagated from similar voted articles using **top-k similarity-weighted propagation**:

1. Compute cosine similarity between the candidate and every voted article.
2. Discard voted articles below a minimum similarity threshold (0.3).
3. Keep the top 15 most similar (`PROPAGATION_TOP_K`).
4. Compute a similarity-weighted average:

```
voteSignal = sum(vote_i × sim_i) / sum(sim_i)
```

This ensures only semantically relevant votes influence the score. A user with 200 votes gets the same signal strength as one with 5 — what matters is how similar the nearby votes are, not how many total votes exist.

- Embeddings come from `all-MiniLM-L6-v2` and are L2-normalized, so dot product = cosine similarity.
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

Source: `api/feed.routes.ts`

## Focus feeds

Two sort modes:

- **recent** — `published_at DESC`. Score = confidence (no vote propagation).
- **top** — scored with focus weights (α=0.4, β=0.4, γ=0.2), then multiplied by source weight:

```
finalScore = computeScore(candidate, mergedContext, focusWeights) × sourceWeight
```

Source weights come from `focus_sources.weight` (default 1). This lets users boost or suppress specific sources within a focus.

Filters: confidence threshold (`focus.minConfidence`), read status, date range, reading time range.

All candidates are fetched, scored in memory, sorted, then paginated (SQL-level pagination isn't possible when scoring requires embeddings).

Source: `focuses/focuses.ts`

## Editions

Editions are deterministic, rule-based magazine generations. The algorithm processes each focus in position order and fills a budget.

### Per-focus scoring

```
finalScore = computeScore(candidate, mergedContext, editionWeights) × sourceWeight × focusWeight
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

### Weighted round-robin source distribution

After scoring, articles aren't simply taken top-to-bottom. Instead, a weighted round-robin ensures fair source representation:

1. Group scored candidates by source.
2. Each source gets an accumulator starting at 0.
3. Each round, add the source's weight to its accumulator.
4. Sources with accumulator ≥ 1 can emit articles (highest accumulator first).
5. When a source emits, its accumulator decrements by 1 and the next highest-scored article from that source is picked.
6. Repeat until the focus budget is exhausted or no candidates remain.

This prevents a prolific high-scoring source from consuming the entire budget.

### Budgeting

Each focus has a budget with a type:

- **count** — each article = 1 unit
- **reading_time** — each article = `ceil(reading_time_seconds / 60)` units (minutes)

The edition stops adding articles to a focus once its budget is consumed.

### Output

Articles across all focuses are assembled into a single ordered edition. Each article records its focus assignment and position.

Source: `editions/editions.ts`

## Summary

| | Global feed | Focus feed | Edition |
|---|---|---|---|
| Sort modes | top, recent | top, recent | deterministic |
| Weights (α, β, γ) | 0, 0.6, 0.4 | 0.4, 0.4, 0.2 | 0.5, 0.4, 0.1 |
| Vote context | global | global + focus | global + focus + edition |
| Source weights | no | yes | yes |
| Focus weights | no | no | yes |
| Source distribution | none | none | weighted round-robin |
| Budgeting | none | none | count or reading time |

## User-customisable weights

All scoring weights can be overridden per user via `GET/PUT/DELETE /api/settings/scoring`. Weights are stored as a JSON blob in `users.scoring_weights` (nullable — `null` means use defaults).

The API returns both the active weights and the defaults, plus an `isCustom` flag. `DELETE` resets to defaults.

The settings UI (Settings > Scoring tab) presents sliders for each feed type's three weights with per-feed and global reset options. Changes take effect on the next feed load.

Source: `api/scoring.routes.ts`, `votes/votes.scoring.ts` (`parseUserScoringWeights`), `votes/votes.ts` (`loadUserScoringWeights`, `saveUserScoringWeights`).

## Future enhancements

### Implicit signal from skipped articles

Articles shown in the feed but never opened are a weak negative signal. A `first_seen_at` timestamp on articles (or a feed impression log) would allow demoting articles that have been "available" for N days without interaction. This doesn't require new ML infrastructure — just a time-based penalty multiplied into the score:

```
skipPenalty = 1 / (1 + daysSinceFirstSeen × decayFactor)
```

Read status is already tracked, so the main addition is recording when an article first appeared in a user's feed.

### Source diversity in feeds

The global and focus feeds have no diversity mechanism. If one source publishes 50 articles and another publishes 5, the prolific source can dominate the top even with equal per-article scores. Editions solve this with weighted round-robin, but that's too heavy for paginated feeds.

A lighter approach: position-based source penalty. After placing N articles from the same source above a given position, apply a diminishing multiplier:

```
diversityFactor = 1 / (1 + sameSourceCountAbove × 0.2)
```

This would be applied during the in-memory sort pass that already exists for "top" mode. The penalty is positional (not absolute), so a dominant source still appears — just not in an unbroken block.
