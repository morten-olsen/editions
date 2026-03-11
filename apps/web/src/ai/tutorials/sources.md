# Sources

Sources are where articles come from. Each source has a type and configuration specific to that type.

## Source types

- **RSS** — standard RSS/Atom feeds. Requires a feed URL.
- **Podcast** — podcast RSS feeds. Fetches episodes as articles.
- **Mastodon** — posts from a Mastodon account. Requires the account URL.
- **Bluesky** — posts from a Bluesky account. Requires the handle.
- **YouTube** — videos from a YouTube channel. Requires the channel URL.
- **Custom** — manually added articles via URL.

## Adding a source (UI flow)

1. Navigate to /sources/new (or click the + icon next to "Sources" in the sidebar)
2. Select the source type by clicking one of the type buttons (`source-type-rss`, `source-type-podcast`, etc.)
3. Fill in:
   - **source-name** — a display name for the source
   - **source-url** — the feed/account/channel URL
   - **source-direction** — "Newest first" or "Oldest first (series)"
4. Click `source-submit` to save
5. If there's an error, it appears as `source-error`
6. After creating, you'll land on the source detail page

## Source detail page

The source detail page shows the source's articles and has these actions:

- `source-edit` — link to the edit page
- `source-fetch` — fetch new articles from the source (background task)
- `source-reanalyse` — re-run analysis (embeddings + focus classification) on all articles
- `source-fetch-error` — shows if the last fetch had an error
- `source-fetch-result` / `source-reanalyse-result` — shows result messages after actions
- `source-articles` — the article list
- `source-prev-page` / `source-next-page` — pagination

## Editing a source

1. From the source detail page, click `source-edit`
2. Edit fields: `edit-source-name`, `edit-source-url`, `edit-source-direction`
3. Click `edit-source-submit` to save, or `edit-source-cancel` to go back

## Deleting a source

1. From the source detail page, click `source-edit` to go to the edit page
2. Scroll to the delete section (`edit-source-delete-section`)
3. Click `edit-source-delete` — this shows a confirmation
4. Click `edit-source-confirm-delete` to permanently delete, or `edit-source-cancel-delete` to cancel
5. Note: the built-in bookmarks source cannot be deleted

## Gotchas

- The bookmarks source is auto-created and cannot be deleted
- After adding a source, articles won't appear until you fetch
- Fetching is a background task — it may take a few seconds to minutes depending on the feed size
