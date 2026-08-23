# Settings

The settings page at /settings has four tabs, switched via `settings-tabs`:

## Tasks tab (`settings-tab-tasks`)

Shows running and recent background tasks (source fetching, article analysis). Tasks are grouped by type with expandable details for failures. No interactive elements — this is a read-only status view.

## Access tab (admin only)

Pricing configuration plus the user access table, paginated via
`admin-users-prev-page` / `admin-users-next-page`. The heading shows the total
user count, which can exceed the rows on screen.

## Votes tab (`settings-tab-votes`)

Shows your vote history with filtering by scope (All/Quality/Relevance) and direction (All/Upvotes/Downvotes). Each vote can be removed individually. Useful for reviewing what you've voted on. Paginated via `votes-prev-page` / `votes-next-page`.

## Scoring tab (`settings-tab-scoring`)

Customize article ranking weights. See the "scoring" tutorial for details. Key elements:
- `settings-scoring-save` — save weight changes
- `settings-scoring-reset` — reset all to defaults

## Assistant tab (`settings-tab-assistant`)

Configure the AI assistant provider (`settings-assistant`):
- `settings-ai-endpoint` — API base URL (e.g., https://api.openai.com/v1)
- `settings-ai-key` — API key
- `settings-ai-model` — model identifier (e.g., gpt-4o)
- `settings-ai-save` — save/enable the assistant
- `settings-ai-disable` — remove the configuration and disable the assistant
- `settings-ai-status` — shows when the assistant is enabled
