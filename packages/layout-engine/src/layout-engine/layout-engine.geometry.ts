/**
 * Layout Engine — Geometry
 *
 * Avoidance zones are the engine's only spatial primitive. Everything else —
 * which columns text can use, where a line may start, whether an image fits —
 * is derived from rectangles and the gaps between them.
 */

import type { Inset, Rect, RegionOptions } from './layout-engine.types.ts';

/* ── Types ────────────────────────────────────────────────────── */

type Span = {
  x: number;
  width: number;
};

type ResolvedRegionOptions = {
  columns: number;
  gap: number;
  inset: Required<Inset>;
  startY: number;
  endY: number;
  columnWidth: number;
  columnStarts: number[] | undefined;
  indentLeft: number;
  indentRight: number;
};

type SpanArgs = {
  y: number;
  lineHeight: number;
  /** Right edge of the area being filled. */
  rightEdge: number;
  zones: readonly Rect[];
  /** Left edge of the area being filled. */
  leftEdge?: number;
};

/* ── Public functions ─────────────────────────────────────────── */

const normalizeInset = (inset: number | Inset): Required<Inset> => {
  if (typeof inset === 'number') {
    return { top: inset, right: inset, bottom: inset, left: inset };
  }
  return {
    top: inset.top ?? 0,
    right: inset.right ?? 0,
    bottom: inset.bottom ?? 0,
    left: inset.left ?? 0,
  };
};

/** Do two rects overlap? Touching edges don't count. */
const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** Is a rect fully inside bounds? */
const rectWithinBounds = (rect: Rect, bounds: Rect): boolean =>
  rect.x >= bounds.x &&
  rect.y >= bounds.y &&
  rect.x + rect.width <= bounds.x + bounds.width &&
  rect.y + rect.height <= bounds.y + bounds.height;

const overlapsAnyZone = (candidate: Rect, zones: readonly Rect[]): boolean =>
  zones.some((zone) => rectsOverlap(candidate, zone));

/**
 * Free horizontal spans on one scan line (y to y + lineHeight), left to right.
 * A zone crossing the line splits it, which is how text flows around a drop
 * cap or an image without anyone computing a wrap shape.
 */
const availableSpans = ({ y, lineHeight, rightEdge, zones, leftEdge = 0 }: SpanArgs): Span[] => {
  const blocked: { start: number; end: number }[] = [];
  for (const zone of zones) {
    if (zone.y < y + lineHeight && zone.y + zone.height > y) {
      const start = Math.max(zone.x, leftEdge);
      const end = Math.min(zone.x + zone.width, rightEdge);
      // A zone entirely outside this area clips to an inverted range.
      if (start < end) {
        blocked.push({ start, end });
      }
    }
  }

  blocked.sort((a, b) => a.start - b.start);

  const spans: Span[] = [];
  let cursor = leftEdge;

  for (const block of blocked) {
    if (block.start > cursor) {
      spans.push({ x: cursor, width: block.start - cursor });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < rightEdge) {
    spans.push({ x: cursor, width: rightEdge - cursor });
  }

  return spans;
};

/** Every region option resolved to a number, so the geometry reads as geometry. */
const resolveRegionOptions = (
  pageWidth: number,
  pageHeight: number,
  options: RegionOptions | undefined,
): ResolvedRegionOptions => {
  const {
    columns = 1,
    gap = 0,
    inset: rawInset = 0,
    startY,
    endY,
    columnStarts,
    // A styled container (a quote's rule, a code block's padding) takes room
    // from the text inside it, exactly as the box model says it should.
    indent = { left: 0, right: 0 },
  } = options ?? {};

  const inset = normalizeInset(rawInset);

  return {
    columns,
    gap,
    inset,
    startY: startY ?? inset.top,
    endY: endY ?? pageHeight - inset.bottom,
    columnWidth: (pageWidth - inset.left - inset.right - (columns - 1) * gap) / columns,
    columnStarts,
    indentLeft: indent.left,
    indentRight: indent.right,
  };
};

/** Column rects text can flow into, given the page box and options. */
const computeRegions = (pageWidth: number, pageHeight: number, options?: RegionOptions): Rect[] => {
  const resolved = resolveRegionOptions(pageWidth, pageHeight, options);
  const { columns, gap, inset, columnWidth, indentLeft, indentRight } = resolved;

  const regions: Rect[] = [];
  for (let i = 0; i < columns; i++) {
    const top = resolved.columnStarts?.[i] ?? resolved.startY;
    regions.push({
      x: inset.left + i * (columnWidth + gap) + indentLeft,
      y: top,
      width: Math.max(0, columnWidth - indentLeft - indentRight),
      height: Math.max(0, resolved.endY - top),
    });
  }

  return regions;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Span, SpanArgs, ResolvedRegionOptions };
export { normalizeInset, rectsOverlap, rectWithinBounds, overlapsAnyZone, availableSpans, computeRegions };
