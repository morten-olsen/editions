# Bookmarks

Bookmarks let you save articles for later reading.

## Saving articles by URL (UI flow)

1. Navigate to /bookmarks
2. Fill in the URL input (`bookmark-save-url`) with the article URL
3. Click `bookmark-save-submit` to save — the system extracts the content automatically
4. If there's an error, it appears as `bookmark-save-error`

## Viewing bookmarks

Navigate to /bookmarks or click "Bookmarks" in the sidebar. Shows all saved articles in `bookmark-list` with pagination (`bookmark-prev-page` / `bookmark-next-page`).

## How it works

- Each user has an auto-created bookmarks source
- Bookmarked articles are stored as regular articles in this special source
- The bookmarks source cannot be deleted
- Removing a bookmark removes the association but doesn't delete the article
