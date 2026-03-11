# Scoring

Scoring controls how articles are ranked in feeds, focuses, and editions.

## The formula

`score = α × confidence + β × votes + γ × recency`

- **Confidence (α)** — how well the article matches a focus topic (0.0–1.0). Only relevant in focus feeds and editions.
- **Votes (β)** — personalisation signal from your upvotes/downvotes, propagated via semantic similarity.
- **Recency (γ)** — freshness. Exponential decay with a 3-day half-life.

## Customizing weights (UI flow)

1. Navigate to /settings
2. Click `settings-tab-scoring` to open the Scoring tab
3. Three cards appear, each with weight sliders:
   - **Global Feed** (`scoring-global`) — `scoring-global-beta` (votes), `scoring-global-gamma` (recency). No alpha since there's no focus context.
   - **Focus Feeds** (`scoring-focus`) — `scoring-focus-alpha` (confidence), `scoring-focus-beta` (votes), `scoring-focus-gamma` (recency)
   - **Editions** (`scoring-edition`) — `scoring-edition-alpha`, `scoring-edition-beta`, `scoring-edition-gamma`
4. Use `fillInput` with the slider's data-ai-id and a value between 0.0 and 1.0 (step 0.1)
5. Click `settings-scoring-save` to save
6. Each card has a `scoring-{feedType}-reset` button to restore that feed type's defaults
7. `settings-scoring-reset` at the bottom restores everything to defaults

## Tips

- Raise recency (γ) to keep feeds fresh
- Raise votes (β) to make ranking more personal
- Raise confidence (α) in focus feeds to surface strongly on-topic articles
- Weights don't need to sum to 1 — they're relative to each other
