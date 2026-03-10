# Design System

The Editions design system encodes the product's core values — calm, finite, focused — into reusable design decisions. The interactive reference lives in Storybook (`pnpm --filter @editions/web storybook`).

## Design philosophy

The best interface is the one that disappears. Every token, component, and interaction serves one purpose: to let the reader read, think, and feel done.

- **Calm over anxious** — no unread counts, no urgency signals, no red badges
- **Finite over infinite** — every surface has a natural end
- **Proportional over prolific** — source budgeting prevents any single feed from dominating
- **Focused** — when reading, the interface steps back; content is foreground
- **Adaptive** — comfortable at any hour, on any device. Light and dark modes respect the reader's environment; layouts are mobile-first, scaling up gracefully
- **Alive** — elements enter, settle, and depart with intention. Motion is subtle and purposeful — it makes the interface feel physical without drawing attention to itself

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

In the real world, things don't just appear — they enter. Motion gives the interface a sense of physicality: elements arrive, settle, and depart with intention. But motion in Editions is always **subordinate to content** — it should feel like breathing, not performing.

#### Philosophy

- **Enter, don't appear** — new content fades or slides in rather than popping into existence
- **Calm over flashy** — motion should be barely noticed; if the user is thinking about the animation, it's too much
- **Purposeful** — every animation communicates something: arrival, departure, connection, change
- **Fast by default** — nothing exceeds 500ms; most interactions complete in 200ms or less
- **Respect preferences** — honor `prefers-reduced-motion` by falling back to instant transitions

#### Tokens

Two easing curves:
- `ease-gentle` — `cubic-bezier(0.25, 0.1, 0.25, 1)` — default for general transitions
- `ease-out-soft` — `cubic-bezier(0, 0, 0.15, 1)` — for entering elements (decelerates into place)

Four durations:
- `fast` (120ms) — hover states, color changes, micro-interactions
- `normal` (200ms) — default transitions, focus rings, button feedback
- `slow` (350ms) — panel slides, layout shifts, content reveals
- `slower` (500ms) — page transitions, modal entries — the upper bound

#### Animation primitives (`components/animate.tsx`)

Reusable `motion` components that encode the design system's animation values:

| Primitive | Purpose | Default duration |
|-----------|---------|-----------------|
| `FadeIn` | Elements gently materialize | slow (350ms) |
| `SlideIn` | Elements enter from a direction with fade | slow (350ms) |
| `ScaleIn` | Subtle scale for popovers, cards, dialogs | normal (200ms) |
| `Collapse` | Animate height for expand/collapse | slow (350ms) |
| `Presence` | Animate mount and unmount (fade) | normal (200ms) |
| `StaggerList` + `StaggerItem` | Children animate in sequence | 60ms stagger |
| `PageTransition` | Route-level crossfade + slide | slower (500ms) enter, normal (200ms) exit |

All primitives accept `duration` (token name) and `delay` props. Use them instead of writing raw `motion.div` — they ensure consistent timing across the app.

#### When to use motion vs CSS transitions

- **CSS transitions** (`transition-colors duration-fast ease-gentle`) — hover states, focus rings, color changes. Simpler, no JS overhead.
- **Motion primitives** — mount/unmount animations, layout changes, staggered lists, anything needing `AnimatePresence`. Use for entrance animations and coordinated sequences.

#### Guidelines

- Lists of items (articles, sources, focuses) should use `StaggerList` for their initial render
- Page content should `SlideIn` from below with a subtle 8-12px offset
- Modals and popovers use `ScaleIn` for a natural "approaching" feel
- Collapsible sections use `Collapse` for smooth height transitions
- Never animate text content itself (no typewriter effects, no letter-by-letter reveals)

## Fonts

Google Fonts loaded in `index.html` and `.storybook/preview-head.html`:
- Inter (400, 500, 600, 700)
- Newsreader (400, 500, 600 + italic)
- JetBrains Mono (400, 500)
