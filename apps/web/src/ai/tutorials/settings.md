# Settings

The settings page at /settings has four tabs, switched via `settings-tabs`:

## Tasks tab (`settings-tab-tasks`)

Shows running and recent background tasks (source fetching, article analysis). Tasks are grouped by type with expandable details for failures. No interactive elements — this is a read-only status view.

## Votes tab (`settings-tab-votes`)

Shows your vote history with filtering by scope (All/Quality/Relevance) and direction (All/Upvotes/Downvotes). Each vote can be removed individually. Useful for reviewing what you've voted on.

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
