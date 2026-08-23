/**
 * Layout Engine — Line rendering
 *
 * Turns laid-out lines into positioned DOM, re-applying inline markup and
 * justifying to the free span each line was measured against.
 *
 * Justification has to account for markup: line breaking measures a paragraph
 * in one font, but bold, italic and monospace runs render wider or narrower
 * than that. Lines carrying markup are therefore measured as rendered before
 * their word spacing is set — otherwise emphasis quietly pushes text past the
 * column edge. Lines without markup use the width the breaker already knows,
 * so the common case costs no layout read.
 */

import type { InlineRenderer, InlineSpan } from './layout-engine.types.ts';
import type { FlowLine } from './layout-engine.text.ts';
import { buildLineContent } from './layout-engine.inline.ts';

/* ── Types ────────────────────────────────────────────────────── */

type RenderLinesArgs = {
  container: HTMLElement;
  lines: FlowLine[];
  /** Origin the line coordinates are measured from — the container's padding box. */
  origin: { x: number; y: number };
  /** The paragraph the lines came from — spans address this text. */
  spans?: InlineSpan[];
  inlineRenderer?: InlineRenderer;
  /** Spread lines to the full measure. Body copy yes, headlines no. */
  justify?: boolean;
};

type PendingJustification = {
  el: HTMLElement;
  line: FlowLine;
  /** Null until measured; unmarked lines use the breaker's width. */
  measuredWidth: number | null;
};

/* ── Private helpers ──────────────────────────────────────────── */

const countSpaces = (text: string): number => (text.match(/ /g) ?? []).length;

const overlapsSpans = (line: FlowLine, spans: InlineSpan[]): boolean => {
  const end = line.offset + line.text.length;
  return spans.some((span) => span.start < end && span.end > line.offset);
};

const createLineElement = (line: FlowLine, origin: { x: number; y: number }): HTMLElement => {
  const el = document.createElement('span');
  el.style.position = 'absolute';
  el.style.left = `${line.x - origin.x}px`;
  el.style.top = `${line.y - origin.y}px`;
  el.style.whiteSpace = 'nowrap';
  return el;
};

/**
 * Spread the slack across the line's spaces. Negative slack means markup made
 * the line wider than the column, so tighten rather than overflow.
 */
const applyJustification = (pending: PendingJustification): void => {
  const { el, line, measuredWidth } = pending;
  if (line.isLast) {
    return;
  }

  const spaces = countSpaces(line.text);
  if (spaces === 0) {
    return;
  }

  const naturalWidth = measuredWidth ?? line.width;
  const slack = line.spanWidth - naturalWidth;
  if (Math.abs(slack) < 0.5) {
    return;
  }

  el.style.wordSpacing = `${slack / spaces}px`;
};

/* ── Public functions ─────────────────────────────────────────── */

/**
 * Render lines into a container positioned at `bbox`.
 * The container itself is left to the caller to place.
 */
const renderLines = ({ container, lines, origin, spans, inlineRenderer, justify = true }: RenderLinesArgs): void => {
  const pending: PendingJustification[] = [];

  for (const line of lines) {
    const el = createLineElement(line, origin);
    el.appendChild(buildLineContent({ text: line.text, offset: line.offset, spans, renderer: inlineRenderer }));
    container.appendChild(el);

    const needsMeasurement = justify && spans !== undefined && spans.length > 0 && overlapsSpans(line, spans);
    pending.push({ el, line, measuredWidth: needsMeasurement ? 0 : null });
  }

  if (!justify) {
    return;
  }

  // One batched read, so at most a single forced layout per flow.
  for (const entry of pending) {
    if (entry.measuredWidth !== null) {
      entry.measuredWidth = entry.el.getBoundingClientRect().width;
    }
  }

  for (const entry of pending) {
    applyJustification(entry);
  }
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { RenderLinesArgs };
export { renderLines };
