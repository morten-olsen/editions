# Reader

The reading surface. Articles are typeset into pages that fit the screen exactly, and the only interaction is turning them.

This is a deliberate answer to the mission: an edition is finite, and reading it should feel like reading, not like operating a scroll container. You open a page, read it without touching anything, and turn.

## Shape

```
markdown ──▶ Content[]  (roles + inline spans)   ← one parser
                  │
      ┌───────────┴───────────┐
   paged renderer         React furniture
   (@editions/layout-engine)   (cover, contents, dividers, last page)
      └───────────┬───────────┘
            role → class          ← one style vocabulary
```

Both halves are pages of the same size and turn the same way, so a reader can't tell which is which.

| Module | Owns |
| --- | --- |
| `reader.markdown.ts` | Markdown → blocks. The only parse in the reading path. |
| `reader.content.ts` | Article + blocks → `Content[]` with roles. |
| `reader.styles.ts` | Role → Tailwind class + type scale. The single description of the look. Border and padding set here are honoured by the engine's measure. |
| `reader.layouts.ts` | Page layouts (`openerLayout`, `bodyLayout`). |
| `reader.format.ts` | Spread / page / compact, and the turn arithmetic. |
| `reader.surface.tsx` | `PagedSurface` — shows pages, turns them. |
| `reader.paged.tsx` | `PagedReader` — one document, typeset and shown. |
| `reader.article.tsx` | `PagedArticle` — an article with a folio and an end-of-piece footer. |
| `reader.hooks.ts` | Container size, font readiness, pagination. |
| `reader.nav.ts` | Keyboard, swipe and edge-tap turning. |

Import from `components/reader/reader.ts`.

## Format

The container decides, not the viewport — on a spread a page is half the window wide.

| Format | When | Pages shown |
| --- | --- | --- |
| `spread` | ≥ 1180px wide and landscape | 2, turned together |
| `page` | anything wider than 620px | 1, capped at 780px |
| `compact` | ≤ 620px | 1, full width, single column |

In an issue the cover stands alone on the first turn (`coverAlone`), the way a magazine's cover faces outward; every later spread pairs an even page with the odd one after it. A lone article has no cover, so it starts paired.

Type scales to the **page**, never through Tailwind's `md:` prefixes — those follow the viewport and would size a spread page as if it were the whole window. `typeScale({ width, height })` in `reader.styles.ts` owns it.

## Style vocabulary

The engine measures text by reading computed styles off a live element. That means the paged renderer can be handed the *same* Tailwind classes anything else would use, and what gets measured is what renders — there is no second set of numbers to keep in sync, and dark mode comes along for free.

```ts
applyRole(el, 'body', scale); // className + fontSize + lineHeight
```

Only `body` and `blockquote` are justified. A justified headline is mostly gaps.

## Reading a page

Turning is the whole interface:

- **Keyboard** — arrows, space, page keys, `j`/`k`/`h`/`l`, Home/End, Escape to leave.
- **Pointer** — click within 28% of either edge.
- **Touch** — swipe, or tap either edge. The middle does nothing, so a thumb can rest anywhere.

Links, buttons and media are exempt from edge-turning, and a text selection suppresses it.

The contents are reachable from any page: a button in the footer band opens the same listing as a panel, so a reader forty pages in doesn't have to flip back to the contents page. Escape closes the panel before it would leave the issue.

Every layout reserves `FOOTER_SPACE` at the foot of the page. The folio lives there on every page; on an article's last page the vote controls and bookmark appear alongside it, so a reader meets them having finished rather than beside the text.

## Marking articles read

An article is marked read when the reader turns past its last page. With no scrolling there is no scroll depth to infer from, which is both simpler and more honest about what was actually reached. `ArticleSpan` in `edition-magazine-sheets.tsx` maps page indices back to articles.

## Gotchas

- **Fonts must be loaded before measuring.** `useFontsReady` gates pagination; measuring a fallback face produces pages that reflow the moment the real font lands.
- **Pagination happens off-screen.** Pages are composed in a detached, hidden mount so half-built pages never appear. The mount must not be `display: none` — computed styles and `getBoundingClientRect` both need layout.
- **Re-typesetting is the resize strategy.** A resize re-paginates the whole issue. That is why the reader's place is a page index and gets clamped when the count changes.
- **Scrolling is still available elsewhere.** `ArticleView` (`components/article/article.presets.tsx`) still renders the standalone article page as a scrolling column. It is a separate renderer on a separate route, not a second layout system inside the reader.

See [docs/layout-engine.md](layout-engine.md) for the typesetting engine underneath.
