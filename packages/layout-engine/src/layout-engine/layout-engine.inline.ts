/**
 * Layout Engine — Inline markup
 *
 * Line breaking measures a paragraph as one uniform run of text, but the
 * rendered line has to carry the emphasis, code and links the source markup
 * asked for. Spans are addressed by offsets into the whole paragraph, so once
 * a line's character range is known its markup can be reconstructed exactly.
 *
 * Spans may nest and overlap (a bold link, an italic run inside a quote). The
 * line is cut at every span edge, and each piece is wrapped in the elements
 * whose range covers it — outermost first.
 */

import type { InlineRenderer, InlineSpan } from './layout-engine.types.ts';

/* ── Private helpers ──────────────────────────────────────────── */

const createDefaultElement = (span: InlineSpan): HTMLElement => {
  switch (span.kind) {
    case 'bold':
      return document.createElement('strong');
    case 'italic':
      return document.createElement('em');
    case 'code':
      return document.createElement('code');
    case 'link': {
      const anchor = document.createElement('a');
      if (span.href !== undefined) {
        anchor.href = span.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
      return anchor;
    }
  }
};

/** Spans overlapping [start, end), ordered so that enclosing spans come first. */
const spansOverlapping = (spans: InlineSpan[], start: number, end: number): InlineSpan[] =>
  spans.filter((span) => span.start < end && span.end > start).sort((a, b) => a.start - b.start || b.end - a.end);

/** Every offset in [start, end) where the set of active spans changes. */
const cutPoints = (spans: InlineSpan[], start: number, end: number): number[] => {
  const points = new Set<number>([start, end]);
  for (const span of spans) {
    if (span.start > start && span.start < end) {
      points.add(span.start);
    }
    if (span.end > start && span.end < end) {
      points.add(span.end);
    }
  }
  return [...points].sort((a, b) => a - b);
};

/** Wrap a piece of text in the elements covering it, innermost text last. */
const wrapPiece = (pieceText: string, active: InlineSpan[], renderer: InlineRenderer): Node => {
  if (active.length === 0) {
    return document.createTextNode(pieceText);
  }

  const outermost = renderer(active[0] as InlineSpan);
  let innermost = outermost;
  for (let i = 1; i < active.length; i++) {
    const nested = renderer(active[i] as InlineSpan);
    innermost.appendChild(nested);
    innermost = nested;
  }
  innermost.textContent = pieceText;
  return outermost;
};

/* ── Public functions ─────────────────────────────────────────── */

type LineContentArgs = {
  /** The line's text as laid out. */
  text: string;
  /** Where this line starts in the owning paragraph, as a UTF-16 offset. */
  offset: number;
  /** All spans on the paragraph. Only those overlapping the line are applied. */
  spans?: InlineSpan[];
  renderer?: InlineRenderer;
};

/**
 * Build the contents of one laid-out line, with inline markup re-applied.
 * Returns a fragment so the caller decides what element hosts it.
 */
const buildLineContent = ({ text, offset, spans, renderer }: LineContentArgs): DocumentFragment => {
  const fragment = document.createDocumentFragment();

  if (spans === undefined || spans.length === 0 || text.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const lineEnd = offset + text.length;
  const relevant = spansOverlapping(spans, offset, lineEnd);
  if (relevant.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const renderSpan = renderer ?? createDefaultElement;
  const points = cutPoints(relevant, offset, lineEnd);

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i] as number;
    const to = points[i + 1] as number;
    const pieceText = text.slice(from - offset, to - offset);
    if (pieceText.length === 0) {
      continue;
    }
    const active = relevant.filter((span) => span.start <= from && span.end >= to);
    fragment.appendChild(wrapPiece(pieceText, active, renderSpan));
  }

  return fragment;
};

/** Shift spans so they address a text that was sliced at `offset`. */
const shiftSpans = (spans: InlineSpan[] | undefined, offset: number): InlineSpan[] | undefined => {
  if (spans === undefined) {
    return undefined;
  }
  return spans
    .filter((span) => span.end > offset)
    .map((span) => ({ ...span, start: Math.max(0, span.start - offset), end: span.end - offset }));
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { LineContentArgs };
export { buildLineContent, shiftSpans, createDefaultElement };
