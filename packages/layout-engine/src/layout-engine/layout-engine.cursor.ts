/**
 * Layout Engine — Cursor mapping
 *
 * Pretext addresses positions as `{ segmentIndex, graphemeIndex }`, where
 * `graphemeIndex` counts graphemes *within that segment* — not from the start
 * of the text. Everything outside the line breaker wants a plain UTF-16 offset
 * into the source string: consuming a drop cap, detecting paragraph breaks,
 * slicing inline markup spans, resuming an overflowed paragraph on the next
 * page. This module owns the conversion in both directions.
 *
 * `prepared.segments` concatenates back to the original text, so a segment's
 * start offset is the running sum of the lengths before it.
 */

import type { LayoutCursor, PreparedTextWithSegments } from '@chenglou/pretext';

/* ── Constants ────────────────────────────────────────────────── */

const ASCII_ONLY = /^[\x20-\x7E\t\n\r]*$/;

/* ── Caches ───────────────────────────────────────────────────── */

/** Running start offset of each segment, plus the total length as a final entry. */
const segmentStarts = new WeakMap<PreparedTextWithSegments, number[]>();

/** Per-segment grapheme boundaries, only computed for segments that need it. */
const graphemeBoundaries = new Map<string, number[]>();

/* ── Private helpers ──────────────────────────────────────────── */

const startsFor = (prepared: PreparedTextWithSegments): number[] => {
  const cached = segmentStarts.get(prepared);
  if (cached) {
    return cached;
  }

  const starts: number[] = new Array(prepared.segments.length + 1);
  let offset = 0;
  for (let i = 0; i < prepared.segments.length; i++) {
    starts[i] = offset;
    offset += prepared.segments[i]?.length ?? 0;
  }
  starts[prepared.segments.length] = offset;

  segmentStarts.set(prepared, starts);
  return starts;
};

/**
 * Code-unit offset of every grapheme boundary in a segment, including the end.
 * ASCII segments have one grapheme per code unit, so they skip segmentation.
 */
const boundariesFor = (segment: string): number[] | null => {
  if (ASCII_ONLY.test(segment)) {
    return null;
  }

  const cached = graphemeBoundaries.get(segment);
  if (cached) {
    return cached;
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const boundaries: number[] = [];
  for (const { index } of segmenter.segment(segment)) {
    boundaries.push(index);
  }
  boundaries.push(segment.length);

  graphemeBoundaries.set(segment, boundaries);
  return boundaries;
};

/** Code-unit offset of a grapheme index within a segment. */
const graphemeToCodeUnit = (segment: string, graphemeIndex: number): number => {
  if (graphemeIndex <= 0) {
    return 0;
  }
  const boundaries = boundariesFor(segment);
  if (boundaries === null) {
    return Math.min(graphemeIndex, segment.length);
  }
  return boundaries[Math.min(graphemeIndex, boundaries.length - 1)] ?? segment.length;
};

/** Grapheme index of a code-unit offset within a segment. */
const codeUnitToGrapheme = (segment: string, codeUnit: number): number => {
  if (codeUnit <= 0) {
    return 0;
  }
  const boundaries = boundariesFor(segment);
  if (boundaries === null) {
    return Math.min(codeUnit, segment.length);
  }
  // Snap down: an offset inside a grapheme belongs to that grapheme, so a
  // span boundary landing mid-character never splits it.
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if ((boundaries[i] ?? 0) <= codeUnit) {
      return i;
    }
  }
  return 0;
};

/* ── Public functions ─────────────────────────────────────────── */

/** UTF-16 offset into the source text for a pretext cursor. */
const cursorToOffset = (prepared: PreparedTextWithSegments, cursor: LayoutCursor): number => {
  const starts = startsFor(prepared);
  const total = starts[prepared.segments.length] ?? 0;

  if (cursor.segmentIndex >= prepared.segments.length) {
    return total;
  }

  const segment = prepared.segments[cursor.segmentIndex] ?? '';
  const start = starts[cursor.segmentIndex] ?? 0;
  return Math.min(start + graphemeToCodeUnit(segment, cursor.graphemeIndex), total);
};

/** Pretext cursor for a UTF-16 offset into the source text. */
const offsetToCursor = (prepared: PreparedTextWithSegments, offset: number): LayoutCursor => {
  const starts = startsFor(prepared);
  const count = prepared.segments.length;
  const total = starts[count] ?? 0;

  if (offset <= 0) {
    return { segmentIndex: 0, graphemeIndex: 0 };
  }
  if (offset >= total) {
    return { segmentIndex: count, graphemeIndex: 0 };
  }

  // Binary search for the segment containing this offset.
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  const segment = prepared.segments[low] ?? '';
  return { segmentIndex: low, graphemeIndex: codeUnitToGrapheme(segment, offset - (starts[low] ?? 0)) };
};

/** Total length of the prepared text, in UTF-16 code units. */
const preparedLength = (prepared: PreparedTextWithSegments): number =>
  startsFor(prepared)[prepared.segments.length] ?? 0;

/* ── Exports ──────────────────────────────────────────────────── */

export { cursorToOffset, offsetToCursor, preparedLength };
