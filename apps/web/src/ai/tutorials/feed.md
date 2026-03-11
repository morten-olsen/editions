# Feed

The feed is a ranked stream of all articles across your sources. It's designed for quick catch-up between editions.

## Accessing the feed

Navigate to /feed or click "All articles" in the sidebar under Browse.

## Filtering (UI elements)

The feed page has a filter bar (`feed-filters`) with:

- **Sort tabs** — `feed-sort-top` (ranked by score) and `feed-sort-recent` (newest first)
- **Time window** — `feed-time-window` select: "All time", "This week", "Today"
- **Read status** — `feed-read-status` select: "All", "Unread", "Read"

Articles are listed in `feed-articles` with pagination via `feed-prev-page` / `feed-next-page`.

## Focus feeds

Each focus topic also has its own feed at /focuses/{focusId}. The focus feed has:

- `focus-edit-btn` — edit the focus settings
- `focus-sort-top` / `focus-sort-recent` — sort tabs
- `focus-time-window` — time window filter
- `focus-read-status` — read status filter
- `focus-articles` — the article list
- `focus-prev-page` / `focus-next-page` — pagination

## Voting

- **Upvote** — tells the system you liked this article. Similar articles will rank higher.
- **Downvote** — tells the system this isn't relevant. Similar articles will rank lower.
- Votes propagate to semantically similar articles via embeddings — a few votes shape hundreds of rankings.
- Feed votes are "global" scope — they affect all feeds.
- Focus feed votes can be scoped to the focus (affects ranking within that topic) or global.

## How ranking works

Articles are scored using: `score = α × confidence + β × votes + γ × recency`

- In the global feed, confidence (α) is not used (there's no focus context)
- Customize weights in Settings → Scoring
