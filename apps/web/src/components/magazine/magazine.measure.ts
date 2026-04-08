/**
 * Magazine Measure
 *
 * Wraps pretext to measure text segments and produce height/line data
 * for the pagination engine. Defines font configurations for desktop
 * and mobile breakpoints.
 *
 * Key insight: pretext's `prepareWithSegments` is font-dependent but
 * width-independent. We cache the prepared result and only re-run
 * `layoutWithLines` when the column width changes (e.g. on resize).
 */

import {
  prepareWithSegments,
  layoutWithLines,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutLine,
  type LayoutCursor,
} from '@chenglou/pretext';

import type { Segment, TextSegment } from './magazine.segments.ts';

/* ── Font configuration ───────────────────────────────────────── */

type FontConfig = {
  body: { font: string; lineHeight: number };
  heading2: { font: string; lineHeight: number };
  heading3: { font: string; lineHeight: number };
  blockquote: { font: string; lineHeight: number };
  code: { font: string; lineHeight: number };
};

const desktopFontConfig: FontConfig = {
  body: { font: '18px Newsreader', lineHeight: 30 },
  heading2: { font: '500 28px Newsreader', lineHeight: 36 },
  heading3: { font: '500 22px Newsreader', lineHeight: 30 },
  blockquote: { font: 'italic 20px Newsreader', lineHeight: 32 },
  code: { font: '14px JetBrains Mono', lineHeight: 22 },
};

const mobileFontConfig: FontConfig = {
  body: { font: '16px Newsreader', lineHeight: 26 },
  heading2: { font: '500 24px Newsreader', lineHeight: 32 },
  heading3: { font: '500 20px Newsreader', lineHeight: 28 },
  blockquote: { font: 'italic 18px Newsreader', lineHeight: 28 },
  code: { font: '13px JetBrains Mono', lineHeight: 20 },
};

/* ── Measured segment types ───────────────────────────────────── */

type MeasuredTextSegment = {
  segment: TextSegment;
  height: number;
  lineCount: number;
  lines: LayoutLine[];
  prepared: PreparedTextWithSegments;
  fontEntry: { font: string; lineHeight: number };
};

type MeasuredImageSegment = {
  segment: Segment & { kind: 'image' };
  height: number;
};

type MeasuredSpacingSegment = {
  segment: Segment & { kind: 'spacing' };
  height: number;
};

type MeasuredHrSegment = {
  segment: Segment & { kind: 'hr' };
  height: number;
};

type MeasuredSegment =
  | MeasuredTextSegment
  | MeasuredImageSegment
  | MeasuredSpacingSegment
  | MeasuredHrSegment;

/* ── Font selection ───────────────────────────────────────────── */

const fontForSegment = (
  segment: TextSegment,
  config: FontConfig,
): { font: string; lineHeight: number } => {
  if (segment.kind === 'heading') {
    if (segment.headingLevel === 2) return config.heading2;
    return config.heading3;
  }
  if (segment.kind === 'blockquote') return config.blockquote;

  // Check if the entire segment is a code block
  const spans = segment.inlineSpans;
  const first = spans[0];
  if (spans.length === 1 && first && first.kind === 'code' && first.start === 0 && first.end === segment.text.length) {
    return config.code;
  }

  return config.body;
};

/* ── Image height calculation ─────────────────────────────────── */

/** Default aspect ratio for article images */
const IMAGE_ASPECT_RATIO = 16 / 9;
/** Maximum height for images as a fraction of viewport height */
const IMAGE_MAX_HEIGHT_FRACTION = 0.4;

const computeImageHeight = (columnWidth: number, viewportHeight: number): number => {
  const natural = columnWidth / IMAGE_ASPECT_RATIO;
  const maxHeight = viewportHeight * IMAGE_MAX_HEIGHT_FRACTION;
  return Math.min(natural, maxHeight);
};

/* ── HR height ────────────────────────────────────────────────── */

const HR_HEIGHT = 24;

/* ── Prepare cache ────────────────────────────────────────────── */

/**
 * Cache for PreparedTextWithSegments. Keyed by `text + font` since
 * preparation is font-dependent but width-independent. On resize,
 * only layoutWithLines needs to re-run.
 */
const prepareCache = new Map<string, PreparedTextWithSegments>();

const getPrepared = (text: string, font: string): PreparedTextWithSegments => {
  const key = `${font}\0${text}`;
  let prepared = prepareCache.get(key);
  if (!prepared) {
    prepared = prepareWithSegments(text, font);
    prepareCache.set(key, prepared);
  }
  return prepared;
};

/** Clear the prepare cache (e.g. when navigating away from the magazine view) */
const clearPrepareCache = (): void => {
  prepareCache.clear();
};

/* ── Measurement ──────────────────────────────────────────────── */

type MeasureArgs = {
  segments: Segment[];
  columnWidth: number;
  viewportHeight: number;
  fontConfig: FontConfig;
};

/**
 * Measure all segments for a given column width.
 * Returns measured segments with heights and line data for text segments.
 */
const measureSegments = ({
  segments,
  columnWidth,
  viewportHeight,
  fontConfig,
}: MeasureArgs): MeasuredSegment[] =>
  segments.map((segment): MeasuredSegment => {
    switch (segment.kind) {
      case 'paragraph':
      case 'heading':
      case 'blockquote': {
        const fontEntry = fontForSegment(segment, fontConfig);
        const prepared = getPrepared(segment.text, fontEntry.font);
        // Blockquotes have pl-4 (16px) + border (2px) CSS padding — reduce measurement width
        const effectiveWidth = segment.kind === 'blockquote' ? columnWidth - 18 : columnWidth;
        const result = layoutWithLines(prepared, effectiveWidth, fontEntry.lineHeight);
        return {
          segment,
          height: result.height,
          lineCount: result.lineCount,
          lines: result.lines,
          prepared,
          fontEntry,
        };
      }

      case 'image':
        return {
          segment,
          height: computeImageHeight(columnWidth, viewportHeight),
        };

      case 'spacing':
        return {
          segment,
          height: segment.lines * fontConfig.body.lineHeight,
        };

      case 'hr':
        return {
          segment,
          height: HR_HEIGHT,
        };
    }
  });

/**
 * Re-measure a text segment at a specific width, returning individual lines.
 * Used by the paginator when splitting a text segment across columns/pages.
 */
const relayoutTextSegment = (
  measured: MeasuredTextSegment,
  maxWidth: number,
): LayoutLine[] => {
  const result = layoutWithLines(measured.prepared, maxWidth, measured.fontEntry.lineHeight);
  return result.lines;
};

/**
 * Lay out text one line at a time with variable width per line.
 * Returns the lines that fit and the cursor to continue from.
 */
const layoutLinesIteratively = (
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  maxWidth: number,
  maxLines: number,
): { lines: LayoutLine[]; endCursor: LayoutCursor | null } => {
  const lines: LayoutLine[] = [];
  let cursor = startCursor;

  for (let i = 0; i < maxLines; i++) {
    const line = layoutNextLine(prepared, cursor, maxWidth);
    if (line === null) return { lines, endCursor: null };
    lines.push(line);
    cursor = line.end;
  }

  // Check if there's more content
  const next = layoutNextLine(prepared, cursor, maxWidth);
  return { lines, endCursor: next === null ? null : cursor };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FontConfig, MeasuredSegment, MeasuredTextSegment, MeasuredImageSegment, MeasuredSpacingSegment, MeasuredHrSegment };
export {
  desktopFontConfig,
  mobileFontConfig,
  fontForSegment,
  measureSegments,
  relayoutTextSegment,
  layoutLinesIteratively,
  clearPrepareCache,
  getPrepared,
  HR_HEIGHT,
  IMAGE_ASPECT_RATIO,
};
