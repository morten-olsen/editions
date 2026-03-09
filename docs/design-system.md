# Design System

The Editions design system encodes the product's core values — calm, finite, focused — into reusable design decisions. The interactive reference lives in Storybook (`pnpm --filter @editions/web storybook`).

## Design philosophy

The best interface is the one that disappears. Every token, component, and interaction serves one purpose: to let the reader read, think, and feel done.

- **Calm over anxious** — no unread counts, no urgency signals, no red badges
- **Finite over infinite** — every surface has a natural end
- **Proportional over prolific** — source budgeting prevents any single feed from dominating
- **Focused** — when reading, the interface steps back; content is foreground

## Tokens

All design tokens are defined in `apps/web/src/design-tokens.css` using Tailwind CSS v4's `@theme` directive. Tokens are available as both CSS custom properties and Tailwind utility classes.

### Color

Warm, papery palette inspired by quality print:

- **Surface** — warm off-whites (`surface`, `surface-raised`, `surface-sunken`, `surface-overlay`)
- **Ink** — warm charcoal tones, never pure black (`ink`, `ink-secondary`, `ink-tertiary`, `ink-faint`)
- **Accent** — muted sage green, used sparingly (`accent`, `accent-hover`, `accent-subtle`)
- **Semantic** — soft signals (`positive`, `caution`, `critical` + `-subtle` variants)
- **Border** — subtle dividers (`border`, `border-strong`)

Colors use `oklch()` for perceptual uniformity.

### Typography

- **Sans** (Inter) — interface text: navigation, labels, metadata
- **Serif** (Newsreader) — reading text: articles, editions
- **Mono** (JetBrains Mono) — technical content only

Scale follows a minor third ratio (1.2): `xs` through `5xl`. Display text uses `tracking-tight`; small text uses `tracking-wide`.

### Spacing

4px base grid. Use generous spacing — density is the enemy of calm. Content areas get `p-6` to `p-8`; sections get `py-16` between them.

### Shadows

Warm, diffused shadows using ink color instead of pure black. Five levels: `xs` through `xl`. Most of the interface lives flat — shadows signal interactivity, not importance.

### Motion

Two easing curves (`ease-gentle`, `ease-out-soft`). Four durations (`fast` 120ms, `normal` 200ms, `slow` 350ms, `slower` 500ms). Nothing exceeds 500ms.

## Fonts

Google Fonts loaded in `index.html` and `.storybook/preview-head.html`:
- Inter (400, 500, 600, 700)
- Newsreader (400, 500, 600 + italic)
- JetBrains Mono (400, 500)
