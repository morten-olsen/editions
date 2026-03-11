# Editions

Editions are curated, finite magazines assembled from your focuses. Each edition config defines the rules; generated editions are the actual magazines.

## Creating an edition config (UI flow)

1. Navigate to /editions/new (or click `edition-new` on the editions list page)
2. Fill in the form (`edition-form`):
   - `edition-name` — the edition name (e.g., "Daily Digest", "Weekend Reader")
   - `edition-schedule` — delivery schedule (select a preset or custom cron)
   - `edition-lookback` — how far back to look for articles
   - `edition-exclude-prior` — checkbox to prevent repeating articles across editions
3. Add topics from the available list (`edition-available-topics`):
   - Click `edition-add-topic-{focusId}` to add a topic
   - Each added topic gets budget, age limit, priority, and ordering controls
4. Click `edition-submit` to create
5. Errors appear as `edition-error`

## Editing an edition config

1. From the edition config detail page, click `edition-edit`
2. Edit the form (`edit-edition-form`):
   - `edit-edition-name`, `edit-edition-schedule`, `edit-edition-lookback`
   - `edit-edition-exclude-prior` — don't repeat articles checkbox
   - `edit-edition-enabled` — active/inactive toggle
3. Add topics from `edit-edition-available-topics` via `edit-edition-add-topic-{focusId}`
4. Click `edit-edition-submit` to save, or `edit-edition-cancel` to go back

## Edition config detail page

Shows the config and its generated issues:

- `edition-header` — the edition name
- `edition-generate` — generate a new issue
- `edition-edit` — link to edit settings
- `edition-error` — error messages
- `edition-issues` — list of generated issues
- Each issue has `edition-issue-{id}-link` to open it

## Editions list page

- `edition-new` — link to create a new edition
- `edition-list` — list of all configs
- Each config: `edition-config-{id}-link` to open, `edition-config-{id}-delete` to delete

## Reading an edition

- **Newspaper view** — default vertical scroll through focus-grouped article cards
- **Magazine view** — paginated, full-viewport reading experience with cover, table of contents, and article spreads

## Managing editions

- **Delete** — remove a generated edition
- **Reading progress** — tracked automatically as you scroll
- **Voting** — vote on articles within the edition context to train the ranking for future editions
