/**
 * Layout Engine — Text flow
 *
 * Walks a prepared paragraph line by line, asking the geometry what horizontal
 * room is free at each scan line and letting pretext break to that width. A
 * line at a time is what makes text flow *around* things rather than merely
 * inside a box, and what lets a paragraph resume mid-sentence on the next page.
 *
 * Every line carries its offset into the source text, so inline markup can be
 * re-applied after the fact.
 */

import {
  layoutNextLine,
  prepareWithSegments,
  type LayoutCursor,
  type LayoutLine,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';

import type { Rect } from './layout-engine.types.ts';
import { availableSpans, type Span } from './layout-engine.geometry.ts';
import { cursorToOffset, offsetToCursor } from './layout-engine.cursor.ts';

/* ── Types ────────────────────────────────────────────────────── */

type TextFlowParams = {
  text: string;
  /** Where to resume, as a UTF-16 offset into `text`. */
  offset?: number;
  font: string;
  lineHeight: number;
  /** Extra space at paragraph breaks. Defaults to half a line. */
  paragraphSpacing?: number;
  regions: Rect[];
  zones: readonly Rect[];
};

type FlowLine = {
  text: string;
  x: number;
  y: number;
  /** Measured width in the base font. */
  width: number;
  /** Width of the free span this line was laid into. */
  spanWidth: number;
  /** Start of this line in the source text, as a UTF-16 offset. */
  offset: number;
  /** Last line of a paragraph or of the flow — never justified. */
  isLast: boolean;
};

type TextFlowResult = {
  lines: FlowLine[];
  bbox: Rect;
  /** Where the next page should resume, or null when the text is finished. */
  remainingOffset: number | null;
  textZones: Rect[];
};

type RegionBounds = {
  minY: number;
  maxY: number;
};

type BuildResultArgs = {
  lines: FlowLine[];
  lineHeight: number;
  remainingOffset: number | null;
  usedRegionBounds: Map<number, RegionBounds>;
  regions: Rect[];
};

/* ── Constants ────────────────────────────────────────────────── */

/** Narrower than this and a line isn't worth setting. */
const MIN_SPAN_WIDTH = 20;

/**
 * Preserve whitespace exactly. Pretext's default mode collapses runs of spaces
 * and turns newlines into spaces, which would break two things at once: the
 * segments would no longer line up with the source string (so every offset —
 * and with it every inline span — would drift), and paragraph breaks would
 * vanish before they could be honoured.
 */
const PREPARE_OPTIONS = { whiteSpace: 'pre-wrap' } as const;

/** A newline in the source is a paragraph boundary. */
const PARAGRAPH_BREAK = '\n';

/** Backstop for a run of blank lines. */
const MAX_BLANK_LINES = 32;

/* ── Private helpers ──────────────────────────────────────────── */

/**
 * Pretext may trim whitespace at a line's edges, so a line's cursor is a hint
 * rather than an exact offset. Search forward from it for the real position.
 */
const resolveLineOffset = (text: string, lineText: string, hint: number): number => {
  if (lineText.length === 0) {
    return hint;
  }
  const found = text.indexOf(lineText, hint);
  return found >= 0 ? found : hint;
};

/**
 * The next line that has something on it.
 *
 * With whitespace preserved, a blank line in the source lays out as an empty
 * line. Rendering those would double every paragraph gap — the break itself
 * already earns `paragraphSpacing` — so they are stepped over here. Nothing is
 * committed: the caller advances the cursor only when it places the line, so
 * skipping is repeatable if this region turns out to be full.
 */
const nextVisibleLine = (
  prepared: PreparedTextWithSegments,
  from: LayoutCursor,
  maxWidth: number,
): LayoutLine | null => {
  let cursor = from;

  for (let guard = 0; guard < MAX_BLANK_LINES; guard++) {
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (line === null) {
      return null;
    }
    if (line.text.trim().length > 0) {
      return line;
    }
    // No forward progress would mean an endless loop.
    if (line.end.segmentIndex === cursor.segmentIndex && line.end.graphemeIndex === cursor.graphemeIndex) {
      return null;
    }
    cursor = line.end;
  }

  return null;
};

const boundingBox = (lines: FlowLine[], lineHeight: number): Rect => {
  if (lines.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    minX = Math.min(minX, line.x);
    minY = Math.min(minY, line.y);
    maxX = Math.max(maxX, line.x + Math.max(line.width, line.spanWidth));
    maxY = Math.max(maxY, line.y + lineHeight);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const buildResult = ({
  lines,
  lineHeight,
  remainingOffset,
  usedRegionBounds,
  regions,
}: BuildResultArgs): TextFlowResult => {
  const textZones: Rect[] = [];
  for (const [regionIdx, bounds] of usedRegionBounds) {
    const region = regions[regionIdx];
    if (region) {
      textZones.push({
        x: region.x,
        y: bounds.minY,
        width: region.width,
        height: bounds.maxY - bounds.minY,
      });
    }
  }

  return { lines, bbox: boundingBox(lines, lineHeight), remainingOffset, textZones };
};

const recordRegionUse = (bounds: Map<number, RegionBounds>, regionIdx: number, y: number, lineHeight: number): void => {
  const existing = bounds.get(regionIdx);
  if (existing) {
    existing.maxY = y + lineHeight;
  } else {
    bounds.set(regionIdx, { minY: y, maxY: y + lineHeight });
  }
};

type PlaceLineArgs = {
  span: Span;
  y: number;
  regionBottom: number;
  state: {
    lines: FlowLine[];
    cursor: LayoutCursor;
    previousEnd: number;
    y: number;
  };
  context: {
    text: string;
    prepared: PreparedTextWithSegments;
    lineHeight: number;
    paragraphSpacing: number;
  };
};

type PlaceLineResult =
  | { outcome: 'placed'; y: number; lineY: number; cursor: LayoutCursor; previousEnd: number }
  /** No text left. */
  | { outcome: 'exhausted' }
  /** Text left, but not the room for it here. */
  | { outcome: 'full' };

/**
 * Set one line into one free span, opening a paragraph gap first if the source
 * broke there. Nothing is committed unless the line is actually placed, so a
 * span that turns out to be too short simply re-offers the line further on.
 */
const placeLineInSpan = ({ span, y, regionBottom, state, context }: PlaceLineArgs): PlaceLineResult => {
  const { text, prepared, lineHeight, paragraphSpacing } = context;

  const line = nextVisibleLine(prepared, state.cursor, span.width);
  if (line === null) {
    return { outcome: 'exhausted' };
  }

  const offset = resolveLineOffset(text, line.text, cursorToOffset(prepared, line.start));

  let lineY = y;
  const endsParagraph =
    state.lines.length > 0 && paragraphSpacing > 0 && text.slice(state.previousEnd, offset).includes(PARAGRAPH_BREAK);

  if (endsParagraph) {
    if (lineY + paragraphSpacing + lineHeight > regionBottom) {
      return { outcome: 'full' };
    }
    const last = state.lines[state.lines.length - 1];
    if (last) {
      last.isLast = true;
    }
    lineY += paragraphSpacing;
  }

  state.lines.push({
    text: line.text,
    x: span.x,
    y: lineY,
    width: line.width,
    spanWidth: span.width,
    offset,
    isLast: false,
  });

  return {
    outcome: 'placed',
    y: lineY,
    lineY,
    cursor: line.end,
    previousEnd: offset + line.text.length,
  };
};

/* ── Public functions ─────────────────────────────────────────── */

/**
 * Flow text into the given regions, respecting avoidance zones.
 * Stops when the regions are full, reporting where to resume.
 */
const flowTextLayout = (params: TextFlowParams): TextFlowResult => {
  const { text, font, lineHeight, regions, zones } = params;
  const paragraphSpacing = params.paragraphSpacing ?? Math.round(lineHeight * 0.5);
  const prepared = prepareWithSegments(text, font, PREPARE_OPTIONS);

  const lines: FlowLine[] = [];
  const usedRegionBounds = new Map<number, RegionBounds>();

  let cursor = offsetToCursor(prepared, params.offset ?? 0);
  let previousEnd = params.offset ?? 0;

  for (let regionIdx = 0; regionIdx < regions.length; regionIdx++) {
    const region = regions[regionIdx];
    if (!region) {
      continue;
    }
    const regionBottom = region.y + region.height;
    let y = region.y;

    while (y + lineHeight <= regionBottom) {
      const spans = availableSpans({
        y,
        lineHeight,
        rightEdge: region.x + region.width,
        zones,
        leftEdge: region.x,
      });

      let exhausted = false;

      for (const span of spans) {
        if (span.width < MIN_SPAN_WIDTH) {
          continue;
        }

        const placed = placeLineInSpan({
          span,
          y,
          regionBottom,
          state: { lines, cursor, previousEnd, y },
          context: { text, prepared, lineHeight, paragraphSpacing },
        });

        if (placed.outcome === 'exhausted') {
          exhausted = true;
          break;
        }
        if (placed.outcome === 'full') {
          break;
        }

        y = placed.y;
        cursor = placed.cursor;
        previousEnd = placed.previousEnd;
        recordRegionUse(usedRegionBounds, regionIdx, placed.lineY, lineHeight);
      }

      if (exhausted) {
        const last = lines[lines.length - 1];
        if (last) {
          last.isLast = true;
        }
        return buildResult({ lines, lineHeight, remainingOffset: null, usedRegionBounds, regions });
      }

      y += lineHeight;
    }
  }

  // Ran out of room before running out of text.
  return buildResult({
    lines,
    lineHeight,
    remainingOffset: cursorToOffset(prepared, cursor),
    usedRegionBounds,
    regions,
  });
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { TextFlowParams, FlowLine, TextFlowResult };
export { flowTextLayout };
