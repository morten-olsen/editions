# Layout engine

`packages/layout-engine` — a typesetter for the browser. Content goes in as pure data, layout functions place it at exact coordinates on a fixed-size page, text flows around whatever is already there and resumes on the next page where it left off.

Vendored from `code.olsen.cloud/incubator/layout-engine` and adapted for this codebase. It has diverged (see [Changes from upstream](#changes-from-upstream)); treat this copy as the source of truth.

## Model

```ts
import { paginate, text, image } from '@editions/layout-engine';

const pages = paginate({
  content: [text('…', { role: 'body' })],
  spec: { width: 700, height: 940 },
  layouts: [openerLayout, bodyLayout], // last one repeats
});
```

- **Content** is data with a `role` and no styling. Layout functions pick items out by role.
- **A page** is a fixed box plus the zones already spoken for. Every placement adds a zone, so later flows route around earlier decisions without anyone tracking geometry by hand.
- **A layout function** composes one page: `(content, page) => void`. It places what it wants; whatever it doesn't consume is returned for the next page.
- **`paginate`** runs layouts until the content is used up, stopping if a page makes no progress.

## Two properties that matter

**Measurement is DOM-driven.** `page.flowText` takes a `setup` callback that styles a live element; the engine reads the computed font back and measures with that. Style it with your design system's own classes and measurement matches rendering exactly — including dark mode, and including fonts you never hard-coded.

**Positions are offsets, not cursors.** Every laid-out line records where it starts in the source string, so inline markup survives line breaking and a paragraph can resume mid-sentence on the next page.

## Inline markup

`TextContent.spans` carries bold / italic / code / link runs as UTF-16 offsets. After line breaking, each line's character range is known, so overlapping spans are re-applied to it — nested spans included.

Line breaking measures a paragraph in one font, but bold and monospace runs render at different widths. Lines carrying markup are therefore measured *as rendered* before their word spacing is set, in one batched layout read per flow. Without that, emphasis quietly pushes justified text past the column edge.

## The container's own box

`setup()` styles the flow container, and the engine honours its **horizontal** border and padding: they come out of the measure, and the container is grown back around the text afterwards. A quote rule or a code block's padding therefore behaves as CSS would suggest, instead of being drawn underneath text that was set to the full column width.

Vertical padding is *not* honoured — the column geometry owns vertical space. Use `spaceBefore` / `spaceAfter` on the flow result.

## Whitespace

The engine prepares text with `whiteSpace: 'pre-wrap'`. This is load-bearing, not a preference.

Pretext's default mode collapses runs of spaces and turns newlines into spaces. That breaks two things at once: `prepared.segments` no longer lines up with the source string, so every offset — and with it every inline span — drifts; and paragraph breaks vanish before they can be honoured. Under `pre-wrap` the segments concatenate back to the original exactly.

A single newline is a paragraph boundary and earns `paragraphSpacing`. Blank lines are stepped over rather than rendered, so a `\n\n` doesn't gap twice.

## Cursor mapping

Pretext's `LayoutCursor.graphemeIndex` counts graphemes **within its segment**, not from the start of the text. `layout-engine.cursor.ts` converts in both directions; nothing else should touch a raw cursor.

This is worth knowing because it is easy to get wrong in a way that looks fine: with ASCII text and a cursor in the first segment, treating `graphemeIndex` as a string offset produces the right answer, and only starts drifting further into the text.

## Columns

Columns fill **in order**, like newsprint — never whichever is shortest. Reading order depends on it, and so does every decision made against "how much room is left". `columnStarts` lets each column resume from its own position, so text picks up where the flow actually got to rather than from a line ruled across the page.

The render callback returns what to do with each item:

| Result | Meaning |
| --- | --- |
| `text` | Flow it. `spaceBefore` / `spaceAfter`, `justify`. |
| `block` | Place it at a measured height. `fullWidth`, `padding`. |
| `skip` | Consume it without drawing anything. |
| `defer` | Leave it unplaced — try the next column, else end the page. |

`defer` is how a heading avoids being stranded at the foot of a column with its paragraph overleaf. `cursor.remaining` tells the callback how much room is left to decide with.

Source order is preserved: when a block doesn't fit, the flow ends rather than reaching past it for something smaller. The exception is a block too big for any page, which is clamped and placed so pagination always makes progress.

## Testing

The engine measures text with a canvas and reads computed styles off live elements. jsdom can do neither, so its tests run in a real browser:

```
task test:engine        # needs: pnpm exec playwright install chromium
```

These are not wired into `task test`, which runs in CI without browsers. If that changes, add `packages/layout-engine` to the workspace test run.

## Changes from upstream

- `LayoutCursor` replaced with plain UTF-16 offsets throughout the public model (`TextContent.offset`), fixing the segment-relative bug described above.
- `whiteSpace: 'pre-wrap'` (upstream used the default, which silently discarded paragraph breaks).
- Inline markup spans, with rendered-width justification.
- Sequential column filling and `columnStarts`.
- Container border/padding taken out of the text measure, so styled blocks lay out correctly.
- `defer`, `spaceBefore` / `spaceAfter`, `justify` on flow results.
- `paginate`, so callers stop hand-rolling the page loop and its safety counter.
- Progress measured by remaining text, not item count — an overflowing paragraph stays one item, so counting items stopped pagination after one page.
- House style: `type` over `interface`, arrow functions, `#` private fields, module-per-concern file naming.
