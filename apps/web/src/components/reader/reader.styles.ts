/**
 * Reader — Style vocabulary
 *
 * One description of how each part of an article looks, used by both the paged
 * and the scrolling renderer. The paged engine measures text by reading
 * computed styles off a live element, so handing it the same classes the
 * scrolling renderer uses is what guarantees the two stay identical — there is
 * no second set of numbers to keep in sync.
 *
 * Size is separated from everything else on purpose. A two-page spread makes
 * each page half the window wide, so type has to scale to the *page*, not the
 * viewport — which rules out Tailwind's media-query prefixes for anything
 * dimensional.
 */

import type { InlineSpan } from '@editions/layout-engine';

/* ── Types ────────────────────────────────────────────────────── */

type Role =
  | 'title'
  | 'source'
  | 'summary'
  | 'byline'
  | 'body'
  | 'heading'
  | 'subheading'
  | 'blockquote'
  | 'code'
  | 'caption'
  | 'folio'
  | 'label';

type TypeSize = {
  size: number;
  leading: number;
};

type TypeScale = Record<Role, TypeSize>;

type PageMetrics = {
  /** Width of a single page, not of the window. */
  width: number;
  height: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/**
 * Family, colour and weight only. Everything dimensional comes from the scale
 * so it can follow the page rather than the viewport.
 */
const ROLE_CLASS: Record<Role, string> = {
  title: 'font-serif tracking-tight text-ink',
  source: 'font-mono tracking-wide text-accent uppercase',
  summary: 'font-serif text-ink-secondary',
  byline: 'font-mono tracking-wide text-ink-tertiary',
  body: 'font-serif text-ink-secondary',
  heading: 'font-serif font-medium tracking-tight text-ink',
  subheading: 'font-serif font-medium text-ink',
  blockquote: 'font-serif italic text-ink-secondary',
  code: 'font-mono text-ink-secondary',
  caption: 'font-mono text-ink-tertiary',
  folio: 'font-mono tracking-wide text-ink-faint',
  label: 'font-mono tracking-widest text-ink-faint uppercase',
};

const INLINE_CLASS: Record<InlineSpan['kind'], string> = {
  bold: 'font-semibold text-ink',
  italic: 'italic',
  code: 'font-mono text-[0.9em] text-ink',
  link: 'text-accent underline decoration-accent/30 underline-offset-2',
};

/** Below this a page is a phone held in one hand. */
const COMPACT_WIDTH = 520;
/** Above this a page has room for a proper reading measure. */
const ROOMY_WIDTH = 760;

/* ── Private helpers ──────────────────────────────────────────── */

const round = (value: number): number => Math.round(value);

/* ── Public functions ─────────────────────────────────────────── */

/**
 * The type scale for a page of a given width.
 *
 * Body size drives everything else, so a spread page and a phone page differ
 * in scale but not in proportion.
 */
const typeScale = ({ width, height }: PageMetrics): TypeScale => {
  const compact = width < COMPACT_WIDTH;
  const roomy = width >= ROOMY_WIDTH;
  const body = compact ? 16 : roomy ? 18 : 17;
  const leading = round(body * 1.7);

  // A short page can't afford a display-sized title.
  const titleCap = Math.max(24, Math.min(height * 0.075, 46));
  const title = compact ? Math.min(28, titleCap) : titleCap;

  return {
    title: { size: round(title), leading: round(title * 1.15) },
    source: { size: compact ? 10 : 11, leading: round((compact ? 10 : 11) * 1.4) },
    summary: { size: round(body * 1.05), leading: round(body * 1.05 * 1.55) },
    byline: { size: compact ? 10 : 11, leading: round((compact ? 10 : 11) * 1.5) },
    body: { size: body, leading },
    heading: { size: round(body * 1.35), leading: round(body * 1.35 * 1.3) },
    subheading: { size: round(body * 1.1), leading: round(body * 1.1 * 1.35) },
    blockquote: { size: round(body * 1.15), leading: round(body * 1.15 * 1.5) },
    code: { size: round(body * 0.85), leading: round(body * 0.85 * 1.6) },
    caption: { size: compact ? 10 : 11, leading: round((compact ? 10 : 11) * 1.5) },
    folio: { size: 10, leading: 14 },
    label: { size: 10, leading: 14 },
  };
};

/** Apply a role's look to an element. Used by both renderers. */
const applyRole = (el: HTMLElement, role: Role, scale: TypeScale): void => {
  el.className = ROLE_CLASS[role];
  el.style.fontSize = `${scale[role].size}px`;
  el.style.lineHeight = `${scale[role].leading}px`;
};

/** The same look as React style props, for the scrolling renderer. */
const roleStyle = (role: Role, scale: TypeScale): React.CSSProperties => ({
  fontSize: scale[role].size,
  lineHeight: `${scale[role].leading}px`,
});

const roleClass = (role: Role): string => ROLE_CLASS[role];

const inlineClass = (kind: InlineSpan['kind']): string => INLINE_CLASS[kind];

/** Builds inline markup elements wearing the reader's own styling. */
const inlineRenderer = (span: InlineSpan): HTMLElement => {
  const el = document.createElement(
    span.kind === 'link' ? 'a' : span.kind === 'code' ? 'code' : span.kind === 'bold' ? 'strong' : 'em',
  );
  el.className = INLINE_CLASS[span.kind];

  if (span.kind === 'link' && span.href !== undefined) {
    const anchor = el as HTMLAnchorElement;
    anchor.href = span.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }

  return el;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Role, TypeScale, TypeSize, PageMetrics };
export { typeScale, applyRole, roleStyle, roleClass, inlineClass, inlineRenderer };
