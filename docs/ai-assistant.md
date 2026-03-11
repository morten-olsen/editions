# AI Assistant

A frontend-only AI layer that helps users set up and interact with Editions through natural language. The assistant operates through the actual UI — clicking buttons, filling forms, navigating pages — so the user sees exactly what the agent does.

## Design principles

- **Invisible until configured** — no AI UI appears until the user adds a provider in settings
- **Same layer as the user** — the agent interacts with UI elements, not APIs directly. Everything it does is visible and interruptible
- **Calm** — follows the design system. The assistant is a slide-out drawer, not a takeover. The virtual cursor is subtle, not flashy
- **Autonomous but observable** — the agent chains multi-step workflows without pausing, but the user watches every action and can stop it at any time

## Provider configuration

Users bring their own OpenAI-compatible provider. Configuration stored in `localStorage`:

| Field | Description | Example |
|-------|-------------|---------|
| `endpoint` | API base URL | `https://api.openai.com/v1` |
| `apiKey` | API key | `sk-...` |
| `model` | Model identifier | `gpt-4o` |

The API key never leaves the browser except to the user's chosen provider. No server-side component.

Settings UI: a section in the existing settings page. Once configured, the chat toggle appears in the top nav.

## Chat panel

A right-edge slide-out drawer that overlays content without reshaping the layout:

- Opens with `SlideIn` from right, `ease-out-soft`, `slow` (350ms)
- Semi-transparent scrim behind it so the main UI remains visible
- Dismissible via toggle button, click outside, or escape key
- Toggle button in top nav — small, quiet, only rendered when AI is configured. Shows an `alpha` badge and a pulsing dot when the agent is processing

The panel shows the conversation: user messages, agent narration, and action status indicators.

### Auto-minimize behavior

When the agent starts processing, the drawer auto-minimizes to a **floating pill** in the bottom-right corner so the user can watch the agent work on the full page. The pill shows:

- The current tool action description (e.g., "Clicking source-save", "Reading the page")
- Turn counter (`N/20`)
- A stop button

Clicking the pill's activity area expands back to the full drawer. The drawer restores automatically when processing completes.

### Input

The text input auto-resizes as the user types (up to 4 lines / 96px), using the `scrollHeight` pattern.

## Annotated UI

HTML elements are annotated with `data-ai-*` attributes so the agent can read a structured representation of the current screen.

### Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-ai-id` | Stable identifier the agent can reference | `"source-list"`, `"new-source-btn"` |
| `data-ai-role` | Semantic role — see role list below | `"button"`, `"link"`, `"input"`, `"list"`, `"section"` |
| `data-ai-label` | Human-readable label | `"Create new source"` |
| `data-ai-error` | Error message on this element | `"Invalid URL format"` |
| `data-ai-state` | Current state | `"loading"`, `"idle"`, `"disabled"`, `"selected"` |
| `data-ai-value` | Current value (for inputs, selects, sliders) | `"https://..."`, `"0.6"` |

### Element roles

Roles are split into interactive (the agent can click/fill) and non-interactive (display-only):

| Category | Roles |
|----------|-------|
| **Interactive** | `button`, `link`, `input`, `checkbox`, `toggle`, `select` |
| **Non-interactive** | `heading`, `info`, `status`, `list`, `form`, `error`, `section` |

The system prompt instructs the agent to never click non-interactive elements.

### Depth system

The page descriptor is depth-aware. At depth 1, the agent sees a shallow overview with hints about what's deeper:

```json
{
  "id": "sources-list",
  "role": "list",
  "label": "Sources",
  "items": 5,
  "depth_available": 3
}
```

At depth 2, children are expanded:

```json
{
  "id": "sources-list",
  "role": "list",
  "label": "Sources",
  "children": [
    { "id": "source-1", "role": "card", "label": "NASA RSS", "depth_available": 2 },
    { "id": "source-2", "role": "card", "label": "Ars Technica", "depth_available": 2 }
  ]
}
```

Elements with `data-ai-error` are **always included** in the descriptor regardless of the requested depth. The agent cannot miss errors.

### Annotation guidelines

- Annotate **interactive elements**: buttons, links, form inputs, navigation items
- Annotate **content containers**: lists, cards, sections, panels
- Annotate **status indicators**: loading spinners, empty states, success/error messages
- Do **not** annotate purely decorative elements or internal layout wrappers
- IDs should be **stable** across renders (not React keys or random IDs)
- Prefer descriptive IDs: `"new-source-btn"` over `"btn-1"`

## Agent tools

The agent interacts with the UI through a fixed set of tools, exposed to the LLM as function calls:

### `queryPage`

Returns a structured JSON descriptor of the current page at the given depth.

```typescript
type QueryPageParams = {
  depth?: number;  // default: 1
};
```

Includes: current route, page title, and all annotated elements up to the requested depth. Error elements are always included.

### `queryElement`

Returns the descriptor for a specific element and its children at the given depth.

```typescript
type QueryElementParams = {
  id: string;
  depth?: number;  // default: 2
};
```

### `getElementHtml`

Returns the raw HTML of a specific element, sanitized and truncated to a reasonable size (e.g., 2000 characters).

```typescript
type GetElementHtmlParams = {
  id: string;
};
```

Useful when the structured descriptor doesn't capture enough detail — e.g., reading article text, checking exact form markup.

### `click`

Clicks an annotated element. Triggers the virtual cursor animation, then dispatches a click event.

```typescript
type ClickParams = {
  id: string;
};
```

Returns the result after mutations have settled (see [action loop](#action-loop)).

### `fillInput`

Sets the value of a form input, textarea, or select.

```typescript
type FillInputParams = {
  id: string;
  value: string;
};
```

Dispatches appropriate input/change events so React state updates. The virtual cursor moves to the input before filling.

### `navigate`

Navigates to a route path using TanStack Router.

```typescript
type NavigateParams = {
  path: string;
};
```

Useful when the agent knows the destination and doesn't need to click through navigation links.

## Agent interruption

The user can stop the agent at any time:

- **Click anywhere** — any click on the page stops the agent (except programmatic clicks dispatched by the agent itself, tracked via the `agentClicking` flag in `ai.tools.ts`)
- **Press any key** — any keypress stops the agent
- **Stop button** — in the drawer footer or the floating pill

Global capture-phase listeners are registered on `document` while `isProcessing` is true, cleaned up when the agent stops. The agent's own clicks set `agentClicking = true` synchronously before dispatching, so the global handler can skip them via `isAgentClick()`.

## Turn limit

The agent loop has a hard cap of **20 iterations** per user message. Each iteration is one LLM call (which may include multiple tool calls). The current iteration count is shown in the chat drawer's thinking indicator and the floating pill as `N/20`.

## Virtual cursor

A small, animated pointer visible only while the agent is performing actions:

- **Appears** when the agent starts an action sequence
- **Moves** smoothly to the target element before each action (`ease-gentle`, `normal` 200ms)
- **Highlights** the target element briefly (subtle pulse/glow using `accent-subtle`)
- **Disappears** when the agent is idle (waiting for user input)
- Respects `prefers-reduced-motion` — falls back to instant positioning with no animation

Implementation: a fixed-position `div` with pointer-events disabled, positioned via `getBoundingClientRect()` of the target element.

## Action loop

The agent follows a strict loop to ensure it never acts on stale state:

```
act → await settled → query page → reason → act
```

### Await settled

After every action (`click`, `fillInput`, `navigate`), the system waits before returning control to the agent:

1. **React Query mutations** — wait for all pending mutations to resolve or reject
2. **Route transitions** — wait for TanStack Router to finish navigating
3. **Loading states** — wait for any `data-ai-state="loading"` elements to transition to `idle`/`success`/`error`
4. **Timeout** — if nothing settles within 10 seconds, return with current state (agent can decide to retry or report failure)

Only after settling does the tool call return its result (including a fresh page snapshot at depth 1). This prevents the agent from racing ahead of the UI.

### Error handling

When an action results in errors:

- Form validation errors appear as `data-ai-error` attributes on the relevant fields
- Toast/notification errors are captured in the page descriptor
- Network errors surface through React Query's error states
- The agent sees all of these in the post-action page snapshot and can self-correct

## Tutorials

The agent needs domain knowledge — what Editions is, what sources and focuses are, how to set up an edition. Rather than stuffing all of this into the system prompt, tutorials are lazy-loaded markdown documents the agent pulls in on demand.

### Structure

```
apps/web/src/ai/tutorials/
  getting-started.md      — what Editions is, core concepts, first-time setup flow
  sources.md              — source types (RSS, podcast, mastodon, bluesky, youtube), how to add/edit/delete
  focuses.md              — what focuses are, how classification works, creating effective focuses
  editions.md             — edition configs, source budgets, focus budgets, scheduling, generating
  feed.md                 — how the feed works, sorting, voting, reading progress
  bookmarks.md            — saving articles, bookmark management
  scoring.md              — scoring weights, how ranking works, tuning recommendations
  settings.md             — settings page tabs: tasks, votes, scoring weights, AI assistant configuration
```

### Registry

The tutorial registry is a static list included in the system prompt so the agent knows what's available without loading any content:

```typescript
const tutorials = [
  { id: "getting-started", title: "Getting Started", summary: "What Editions is, core concepts, first-time setup walkthrough" },
  { id: "sources", title: "Sources", summary: "Adding RSS, podcast, Mastodon, Bluesky, YouTube sources" },
  { id: "focuses", title: "Focuses", summary: "Creating topic focuses, how article classification works" },
  { id: "editions", title: "Editions", summary: "Configuring editions, source/focus budgets, scheduling" },
  { id: "feed", title: "Feed", summary: "Feed ranking, sorting modes, voting on articles" },
  { id: "bookmarks", title: "Bookmarks", summary: "Saving and managing bookmarked articles" },
  { id: "scoring", title: "Scoring", summary: "Customizing scoring weights for article ranking" },
  { id: "settings", title: "Settings", summary: "Settings page tabs: tasks, votes, scoring weights, AI assistant configuration" },
];
```

### `getTutorial` tool

```typescript
type GetTutorialParams = {
  id: string;
};
```

Returns the full markdown content of a tutorial. The agent calls this when it needs to understand how a feature works before helping the user with it. For example, if the user says "help me set up an edition," the agent loads the `editions` tutorial to understand the concepts, then loads `sources` and `focuses` if it needs to create those first.

### Writing guidelines

Tutorials are written for the agent, not the user. They should:

- Explain **what** things are and **why** they exist (the agent needs conceptual understanding)
- Describe the **UI flow** step by step (the agent navigates by clicking, so it needs to know the sequence: "go to Sources → click New Source → select type → fill URL → click Save")
- Note **gotchas** and **constraints** (e.g., "the bookmarks source is auto-created and cannot be deleted", "focus names must be unique")
- Be concise — the agent is paying per token. No filler, no marketing language
- Stay up to date — when the UI changes, tutorials must be updated

## System prompt

The agent receives a system prompt that includes:

- Its role: "You are an assistant that helps users set up and use Editions"
- Available tools and their descriptions (including `getTutorial`)
- The tutorial registry: list of available tutorials with summaries
- Instructions to load relevant tutorials before attempting unfamiliar workflows
- Instructions to narrate actions briefly in the chat ("Creating a new RSS source for NASA...")
- The current page descriptor (depth 1) as context with every user message
- Guidelines: be concise, act autonomously, explain what you're doing, stop if something unexpected happens

The page descriptor is injected automatically — the user doesn't need to describe what they see.

## Module structure

The AI assistant is an isolated module within the frontend:

```
apps/web/src/ai/
  ai.ts                    — public API: re-exports provider, chat, cursor
  ai.provider.tsx          — React context: config state, chat state, agent loop
  ai.chat.tsx              — chat drawer component + toggle button
  ai.cursor.tsx            — virtual cursor component
  ai.client.ts             — OpenAI-compatible chat completions client
  ai.prompt.ts             — system prompt builder
  ai.descriptor.ts         — page descriptor: reads data-ai-* attributes, builds JSON
  ai.tools.ts              — tool definitions and implementations (click, fill, navigate, query, getTutorial)
  ai.settled.ts            — await-settled logic (React Query, router, loading states)
  ai.tutorials.ts          — tutorial registry and lazy loader
  ai.types.ts              — shared types (AiConfig, AiChatMessage, AiToolCall, etc.)
  tutorials/
    getting-started.md
    sources.md
    focuses.md
    editions.md
    feed.md
    bookmarks.md
    scoring.md
    settings.md
```

No AI code exists outside this directory. The only integration points with the rest of the app are:

1. `data-ai-*` attributes added to existing components
2. The chat drawer and cursor rendered in the root layout (conditionally)
3. Settings page section for provider configuration
4. Access to the React Query client and TanStack Router (for settled detection)

## Implementation status

All core infrastructure and the agent loop are implemented. Current status:

- **Provider config** — settings UI section, `localStorage` persistence, config context
- **Page descriptor** — `data-ai-*` attribute reader, depth-aware JSON builder
- **Annotation coverage** — all major pages annotated: sources (list, detail, edit, new), focuses (list, detail, edit, new), editions (list, detail, edit, new), feed, bookmarks, settings (all tabs including scoring sliders), article cards
- **Chat drawer** — slide-out panel with auto-minimize to floating pill during processing
- **Tutorials** — 8 markdown tutorials covering all features, lazy-loaded via Vite `?raw` imports
- **Agent tools** — `queryPage`, `queryElement`, `getElementHtml`, `click`, `fillInput`, `navigate`, `getTutorial`
- **Virtual cursor** — animated pointer with element highlighting
- **Await settled** — React Query mutation/navigation/loading-state watcher
- **LLM integration** — OpenAI-compatible chat completions with tool calling (non-streaming)
- **Agent interruption** — stop on user click/keypress, agent click flag pattern
- **Turn limit** — 20-iteration cap with counter in UI

### Remaining work

- **Streaming responses** — currently non-streaming; could improve perceived latency
- **Conversation persistence** — optionally save chat history in `localStorage`
- **Article detail page** — not yet annotated with `data-ai-*` attributes
- **Votes page** — not yet annotated
