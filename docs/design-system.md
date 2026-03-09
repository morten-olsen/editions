# Design System

The Editions design system encodes the product's core values — calm, finite, focused — into reusable design decisions. The interactive reference lives in Storybook (`pnpm --filter @editions/web storybook`).

## Design philosophy

The best interface is the one that disappears. Every token, component, and interaction serves one purpose: to let the reader read, think, and feel done.

- **Calm over anxious** — no unread counts, no urgency signals, no red badges
- **Finite over infinite** — every surface has a natural end
- **Proportional over prolific** — source budgeting prevents any single feed from dominating
- **Focused** — when reading, the interface steps back; content is foreground
- **Adaptive** — comfortable at any hour, on any device. Light and dark modes respect the reader's environment; layouts are mobile-first, scaling up gracefully

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

#### Dark mode

Dark mode uses the same warm hue angles, shifted to dark surfaces and light ink. Activated via `prefers-color-scheme: dark` or the `.dark` class on `<html>`. All semantic token names stay the same — components never need mode-specific classes.

- **Surface** — deep warm grays (`surface` → `oklch(0.16 …)`)
- **Ink** — warm off-whites, never pure white
- **Accent** — slightly lifted lightness for contrast on dark backgrounds
- **Shadows** — stronger opacity on dark backgrounds to remain visible

### Typography

- **Sans** (Inter) — interface text: navigation, labels, metadata
- **Serif** (Newsreader) — reading text: articles, editions
- **Mono** (JetBrains Mono) — technical content only

Scale follows a minor third ratio (1.2): `xs` through `5xl`. Display text uses `tracking-tight`; small text uses `tracking-wide`.

### Spacing

4px base grid. Use generous spacing — density is the enemy of calm. Content areas get `p-6` to `p-8`; sections get `py-16` between them.

### Responsive

Mobile-first — base styles target phones, scale up with `sm:`, `md:`, `lg:` breakpoints. Breakpoints follow Tailwind defaults (`sm` 640px, `md` 768px, `lg` 1024px). Tap targets are at least 44px. Reading text uses `--width-prose` (65ch) max-width to stay comfortable on wide screens.

### Shadows

Warm, diffused shadows using ink color instead of pure black. Five levels: `xs` through `xl`. Most of the interface lives flat — shadows signal interactivity, not importance.

### Motion

Two easing curves (`ease-gentle`, `ease-out-soft`). Four durations (`fast` 120ms, `normal` 200ms, `slow` 350ms, `slower` 500ms). Nothing exceeds 500ms.

## Fonts

Google Fonts loaded in `index.html` and `.storybook/preview-head.html`:
- Inter (400, 500, 600, 700)
- Newsreader (400, 500, 600 + italic)
- JetBrains Mono (400, 500)
