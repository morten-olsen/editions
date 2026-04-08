/**
 * Paged Article — Measure
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

import type { Segment, TextSegment } from './paged-article.segments.ts';

/* ── Font configuration ───────────────────────────────────────── */

type FontConfig = {
  body: { font: string; lineHeight: number };
  heading2: { font: string; lineHeight: number };
  heading3: { font: string; lineHeight: number };
  blockquote: { font: string; lineHeight: number };
  code: { font: string; lineHeight: number };
};

/**
 * Font strings must match the CSS font stack exactly so pretext's canvas
 * measurement agrees with what the browser renders. These mirror the
 * --font-serif and --font-mono CSS custom properties in design-tokens.css.
 */
const SERIF_STACK = '"Newsreader", "Georgia", "Times New Roman", ui-serif, serif';
const SANS_STACK = '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif';
const MONO_STACK = '"JetBrains Mono", ui-monospace, "Cascadia Code", monospace';

const desktopFonts: FontConfig = {
  body: { font: `18px ${SERIF_STACK}`, lineHeight: 30 },
  heading2: { font: `500 28px ${SERIF_STACK}`, lineHeight: 36 },
  heading3: { font: `500 22px ${SERIF_STACK}`, lineHeight: 30 },
  blockquote: { font: `italic 20px ${SERIF_STACK}`, lineHeight: 32 },
  code: { font: `14px ${MONO_STACK}`, lineHeight: 22 },
};

const mobileFonts: FontConfig = {
  body: { font: `16px ${SERIF_STACK}`, lineHeight: 26 },
  heading2: { font: `500 24px ${SERIF_STACK}`, lineHeight: 32 },
  heading3: { font: `500 20px ${SERIF_STACK}`, lineHeight: 28 },
  blockquote: { font: `italic 18px ${SERIF_STACK}`, lineHeight: 28 },
  code: { font: `13px ${MONO_STACK}`, lineHeight: 20 },
};

/* ── Measured segment types ───────────────────────────────────── */

type MeasuredText = {
  segment: TextSegment;
  height: number;
  lineCount: number;
  lines: LayoutLine[];
  prepared: PreparedTextWithSegments;
  fontEntry: { font: string; lineHeight: number };
};

type MeasuredImage = {
  segment: Segment & { kind: 'image' };
  height: number;
};

type MeasuredSpacing = {
  segment: Segment & { kind: 'spacing' };
  height: number;
};

type MeasuredHr = {
  segment: Segment & { kind: 'hr' };
  height: number;
};

type MeasuredSegment = MeasuredText | MeasuredImage | MeasuredSpacing | MeasuredHr;

/* ── Font selection ───────────────────────────────────────────── */

const fontForSegment = (
  segment: TextSegment,
  config: FontConfig,
): { font: string; lineHeight: number } => {
  if (segment.kind === 'heading') {
    return segment.headingLevel === 2 ? config.heading2 : config.heading3;
  }
  if (segment.kind === 'blockquote') return config.blockquote;

  const spans = segment.inlineSpans;
  const first = spans[0];
  if (spans.length === 1 && first && first.kind === 'code' && first.start === 0 && first.end === segment.text.length) {
    return config.code;
  }

  return config.body;
};

/* ── Image height ─────────────────────────────────────────────── */

const IMAGE_ASPECT_RATIO = 16 / 9;
const IMAGE_MAX_HEIGHT_FRACTION = 0.4;

const computeImageHeight = (columnWidth: number, viewportHeight: number): number => {
  const natural = columnWidth / IMAGE_ASPECT_RATIO;
  const maxHeight = viewportHeight * IMAGE_MAX_HEIGHT_FRACTION;
  return Math.min(natural, maxHeight);
};

/* ── HR height ────────────────────────────────────────────────── */

const HR_HEIGHT = 24;

/* ── Prepare cache ────────────────────────────────────────────── */

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
        return { segment, height: computeImageHeight(columnWidth, viewportHeight) };

      case 'spacing':
        return { segment, height: segment.lines * fontConfig.body.lineHeight };

      case 'hr':
        return { segment, height: HR_HEIGHT };
    }
  });

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

  const next = layoutNextLine(prepared, cursor, maxWidth);
  return { lines, endCursor: next === null ? null : cursor };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FontConfig, MeasuredSegment, MeasuredText, MeasuredImage, MeasuredSpacing, MeasuredHr };
export {
  SERIF_STACK,
  SANS_STACK,
  MONO_STACK,
  desktopFonts,
  mobileFonts,
  fontForSegment,
  measureSegments,
  layoutLinesIteratively,
  clearPrepareCache,
  getPrepared,
  HR_HEIGHT,
  IMAGE_ASPECT_RATIO,
};
