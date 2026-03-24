# Data Portability

## Overview

Editions supports full data export and import so users can move their setup between instances. The export is a self-contained JSON file with no user-specific IDs — everything is referenced by URL or name, making it portable across servers and accounts.

Import replaces all existing data for the importing user, producing an identical state to the exporting user's setup.

## What's included

The export captures all user-configured and user-generated data:

| Data | Description |
|------|-------------|
| **Sources** | All subscribed feeds (RSS, podcast, Mastodon, etc.) with their type, URL, config, and direction. The built-in bookmarks source is excluded. |
| **Articles** | Full article content, metadata, read state, and progress for every article across all sources. |
| **Embeddings** | Article embeddings (base64-encoded) with their model identifier. Used for semantic similarity in voting and classification. |
| **Focus classifications** | Per-article similarity and NLI scores for each focus, including the model used. |
| **Focuses** | Topic definitions with description, icon, confidence thresholds, reading time filters, and linked sources (referenced by URL). |
| **Edition configs** | Magazine configurations: schedule, lookback, focus budgets, source budgets. |
| **Editions** | Generated magazines with their article lists, reading progress, and read state. |
| **Scoring weights** | Personalized ranking coefficients (alpha/beta/gamma per feed type). |

## What's not included

- **User account** — username, password, and role are not exported. The importing user keeps their own identity.
- **Bookmarks source** — this is a built-in source created automatically per user.
- **Votes** — article votes are cleared on import since they reference articles by internal ID. The imported embeddings and focus classifications preserve the learned preferences.
- **Jobs** — background job state is ephemeral and not exported.

## API

Both endpoints require authentication.

### Export

`GET /api/data/export`

Returns the full export as JSON. The response schema is versioned (`version: 1`) to support future format changes.

**Response (200):**

```json
{
  "version": 1,
  "exportedAt": "2026-03-24T12:00:00.000Z",
  "sources": [
    {
      "type": "rss",
      "name": "Example Blog",
      "url": "https://example.com/feed.xml",
      "config": {},
      "direction": "newest"
    }
  ],
  "articles": [
    {
      "sourceUrl": "https://example.com/feed.xml",
      "externalId": "https://example.com/post-1",
      "url": "https://example.com/post-1",
      "title": "Example Post",
      "author": "Alice",
      "summary": "...",
      "content": "...",
      "consumptionTimeSeconds": 180,
      "publishedAt": "2026-03-20T08:00:00Z",
      "extractedAt": "2026-03-20T09:00:00Z",
      "analysedAt": "2026-03-20T09:01:00Z",
      "readAt": null,
      "progress": 0,
      "embedding": {
        "data": "base64-encoded-bytes",
        "model": "Xenova/all-MiniLM-L6-v2"
      },
      "focuses": [
        {
          "focusName": "Technology",
          "similarity": 0.85,
          "similarityModel": "Xenova/all-MiniLM-L6-v2",
          "nli": 0.72,
          "nliModel": "Xenova/nli-deberta-v3-small"
        }
      ]
    }
  ],
  "focuses": [
    {
      "name": "Technology",
      "description": "Software, hardware, and industry trends",
      "icon": "cpu",
      "minConfidence": 0.5,
      "minConsumptionTimeSeconds": null,
      "maxConsumptionTimeSeconds": null,
      "sources": [
        { "url": "https://example.com/feed.xml", "weight": 1, "minConfidence": null }
      ]
    }
  ],
  "editionConfigs": [
    {
      "name": "Morning Briefing",
      "icon": "sun",
      "schedule": "0 7 * * *",
      "lookbackHours": 24,
      "excludePriorEditions": true,
      "enabled": true,
      "focuses": [
        {
          "focusName": "Technology",
          "position": 0,
          "budgetType": "time",
          "budgetValue": 10,
          "lookbackHours": null,
          "excludePriorEditions": null,
          "weight": 1
        }
      ],
      "sourceBudgets": []
    }
  ],
  "editions": [
    {
      "editionConfigName": "Morning Briefing",
      "title": "Morning Briefing — Mar 24",
      "totalReadingMinutes": 12,
      "articleCount": 5,
      "currentPosition": 3,
      "readAt": null,
      "publishedAt": "2026-03-24T07:00:00Z",
      "articles": [
        {
          "sourceUrl": "https://example.com/feed.xml",
          "externalId": "https://example.com/post-1",
          "focusName": "Technology",
          "position": 0
        }
      ]
    }
  ],
  "scoringWeights": {
    "global": { "alpha": 0, "beta": 0.5, "gamma": 0.5 },
    "focus": { "alpha": 0.6, "beta": 0.3, "gamma": 0.1 },
    "edition": { "alpha": 0.7, "beta": 0.2, "gamma": 0.1 }
  }
}
```

### Import

`POST /api/data/import`

Accepts an export JSON body. **Replaces all existing data** for the authenticated user — this is destructive by design, ensuring the importing user ends up with identical state to the export.

**Request body:** same schema as the export response.

**Response (200):**

```json
{
  "sources": 12,
  "articles": 847,
  "focuses": 4,
  "editionConfigs": 2,
  "editions": 15,
  "scoringWeightsImported": true
}
```

## Import behavior

1. **Clear** — all existing sources (except bookmarks), articles, embeddings, focuses, edition configs, editions, votes, bookmarks, and scoring weights are deleted.
2. **Import sources** — each source is created fresh with a new ID.
3. **Import articles** — articles are linked to their source by URL match. Embeddings and focus classification data are restored.
4. **Import focuses** — focuses are created with new IDs. Source links are resolved by matching source URLs.
5. **Import edition configs** — configs are created with new IDs. Focus and source budget links are resolved by name/URL.
6. **Import editions** — editions are linked to their config by name. Article references are resolved by `(sourceUrl, externalId)` composite key.
7. **Import scoring weights** — overwrites the user's scoring weights if present in the export.
8. **Reconcile** — a `reconcile_focus` job is enqueued for every imported focus. This handles cases where the importing instance uses a different embedding model — the reconcile job will reclassify articles as needed.

## Frontend

The feature lives in **Settings → Data** with two actions:

- **Download export** — fetches `GET /api/data/export` and saves the JSON as `editions-export-YYYY-MM-DD.json`.
- **Choose file to import** — opens a file picker, shows a confirmation dialog (since import is destructive), then POSTs the file contents. Displays a summary of what was imported.

## Portability design decisions

**References by URL/name, not ID.** Source links use URLs, focus links use names. This means an export from one instance can be imported into any other instance regardless of database state. The trade-off is that renaming a focus before importing would break edition config → focus links.

**Import clears first.** Rather than merging (which creates ambiguity around duplicates and conflicts), import produces a clean slate matching the export. Users who want to preserve existing data should export first.

**Embeddings included.** Embeddings are large but including them avoids re-running the embedding pipeline on import, which can be slow for large article collections. The reconcile job after import handles model mismatches gracefully.

**Votes not included.** Votes reference articles by internal ID and don't carry meaningful information across instances beyond what embeddings and classifications already capture.

## Code layout

```
apps/server/src/api/
├── data.routes.ts              # Export/import route handlers and business logic
├── data.routes.schemas.ts      # Zod schemas for the export format and import result
└── data.routes.test.ts         # API-level tests

apps/web/src/
├── routes/settings.index.tsx   # Settings page (Data tab added)
└── views/settings/
    └── data-section.tsx        # Export/import UI component
```
