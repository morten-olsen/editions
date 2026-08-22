/**
 * Paged Article — Flow
 *
 * Text placement primitives and column flow. pretext measures all text;
 * layoutNextLine enables text to flow around obstacles (drop caps,
 * floated images).
 */

import { layoutWithLines, layoutNextLine, type LayoutCursor, type LayoutLine } from '@chenglou/pretext';

import type { InlineSpan } from './paged-article.segments.ts';
import { getPrepared, SERIF_STACK } from './paged-article.measure.ts';
import type { BodyElement, PageConfig, Region, TextElement, TextRegion } from './paged-article.model.ts';
import { colWidth, colX, elHeight, elLines, MIN_LINES, pageHeight } from './paged-article.model.ts';

/* ── Place a text block ───────────────────────────────────────── */

type PlaceTextArgs = {
  text: string;
  font: string;
  lineHeight: number;
  maxWidth: number;
  x: number;
  y: number;
  role: TextRegion['role'];
  inlineSpans?: InlineSpan[];
};

const placeText = ({
  text,
  font,
  lineHeight,
  maxWidth,
  x,
  y,
  role,
  inlineSpans = [],
}: PlaceTextArgs): { region: TextRegion; height: number } => {
  const prepared = getPrepared(text, font);
  const result = layoutWithLines(prepared, maxWidth, lineHeight);
  return {
    region: {
      kind: 'text',
      x,
      y,
      width: maxWidth,
      text,
      inlineSpans,
      allLines: result.lines,
      font,
      lineHeight,
      startLine: 0,
      endLine: result.lineCount,
      role,
    },
    height: result.height,
  };
};

/* ── Flow text around an obstacle ─────────────────────────────── */

type FlowAroundObstacleArgs = {
  text: string;
  font: string;
  lineHeight: number;
  inlineSpans: InlineSpan[];
  fullWidth: number;
  narrowWidth: number;
  narrowX: number;
  fullX: number;
  y: number;
  obstacleSpan: number;
  role: TextRegion['role'];
};

/**
 * Re-measure text with variable-width lines to flow around an obstacle.
 * Lines within obstacleSpan use narrowWidth; remaining use fullWidth.
 * Returns regions for narrow + full portions and total height.
 */
const flowTextAroundObstacle = ({
  text,
  font,
  lineHeight,
  inlineSpans,
  fullWidth,
  narrowWidth,
  narrowX,
  fullX,
  y,
  obstacleSpan,
  role,
}: FlowAroundObstacleArgs): { regions: TextRegion[]; height: number } => {
  const prepared = getPrepared(text, font);
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  const allLines: LayoutLine[] = [];

  while (true) {
    const w = allLines.length < obstacleSpan ? narrowWidth : fullWidth;
    const line = layoutNextLine(prepared, cursor, w);
    if (line === null) {
      break;
    }
    allLines.push(line);
    cursor = line.end;
  }

  const regions: TextRegion[] = [];
  const narrowCount = Math.min(obstacleSpan, allLines.length);

  if (narrowCount > 0) {
    regions.push({
      kind: 'text',
      x: narrowX,
      y,
      width: narrowWidth,
      text,
      inlineSpans,
      allLines,
      font,
      lineHeight,
      startLine: 0,
      endLine: narrowCount,
      role,
    });
  }

  if (allLines.length > narrowCount) {
    regions.push({
      kind: 'text',
      x: fullX,
      y: y + narrowCount * lineHeight,
      width: fullWidth,
      text,
      inlineSpans,
      allLines,
      font,
      lineHeight,
      startLine: narrowCount,
      endLine: allLines.length,
      role,
    });
  }

  return { regions, height: allLines.length * lineHeight };
};

/* ── Drop cap ─────────────────────────────────────────────────── */

const DROP_CAP_FONT = `600 58px ${SERIF_STACK}`;
const DROP_CAP_LH = 58;
const DROP_CAP_GAP = 10;
const DROP_CAP_SPAN = 3;

const placeDropCapParagraph = (
  el: TextElement,
  x: number,
  y: number,
  fullWidth: number,
): { regions: Region[]; height: number } => {
  const firstChar = el.text[0];
  if (!firstChar || !/[A-Za-zÀ-ɏ]/.test(firstChar)) {
    const t = placeText({
      text: el.text,
      font: el.font,
      lineHeight: el.lineHeight,
      maxWidth: fullWidth,
      x,
      y,
      role: 'body',
      inlineSpans: el.inlineSpans,
    });
    return { regions: [t.region], height: t.height };
  }

  const regions: Region[] = [];

  // Measure drop cap
  const dcPrepared = getPrepared(firstChar, DROP_CAP_FONT);
  const dcLayout = layoutWithLines(dcPrepared, fullWidth, DROP_CAP_LH);
  const dcW = Math.ceil(dcLayout.lines[0]?.width ?? 24) + DROP_CAP_GAP;

  regions.push({
    kind: 'text',
    x,
    y: y + 4,
    width: dcW,
    text: firstChar,
    inlineSpans: [],
    allLines: dcLayout.lines,
    font: DROP_CAP_FONT,
    lineHeight: DROP_CAP_LH,
    startLine: 0,
    endLine: 1,
    role: 'dropcap',
  });

  // Body text without first char, flowing around drop cap
  const bodyText = el.text.slice(1);
  const bodySpans = el.inlineSpans
    .map((s) => ({ ...s, start: s.start - 1, end: s.end - 1 }))
    .filter((s) => s.end > 0)
    .map((s) => ({ ...s, start: Math.max(0, s.start) }));

  const flow = flowTextAroundObstacle({
    text: bodyText,
    font: el.font,
    lineHeight: el.lineHeight,
    inlineSpans: bodySpans,
    fullWidth,
    narrowWidth: fullWidth - dcW,
    narrowX: x + dcW,
    fullX: x,
    y,
    obstacleSpan: DROP_CAP_SPAN,
    role: 'body',
  });
  regions.push(...flow.regions);

  return { regions, height: flow.height };
};

/* ── Column separator ─────────────────────────────────────────── */

const addColumnSeparator = (regions: Region[], startY: number, config: PageConfig): void => {
  if (config.columns < 2) {
    return;
  }
  const w = colWidth(config);
  const sepX = w + config.columnGap / 2;
  const sepHeight = pageHeight(config) - startY;
  if (sepHeight > 0) {
    regions.push({ kind: 'separator', x: sepX, y: startY, height: sepHeight });
  }
};

/* ── Flow body elements into columns ──────────────────────────── */

/** Mutable cursor for the column-flow loop. */
type ColumnFlow = {
  config: PageConfig;
  w: number;
  maxY: number;
  startY: number;
  col: number;
  y: number;
};

const flowSpace = (flow: ColumnFlow): number => flow.maxY - flow.y;

const tryNextCol = (flow: ColumnFlow): boolean => {
  if (flow.col < flow.config.columns - 1) {
    flow.col++;
    flow.y = flow.startY;
    return true;
  }
  return false;
};

const bodyRole = (el: TextElement): 'heading' | 'blockquote' | 'body' =>
  el.variant === 'heading' ? 'heading' : el.variant === 'blockquote' ? 'blockquote' : 'body';

/** Height needed after a heading: look past spacing to the next text element. */
const neededAfterHeading = (remaining: BodyElement[]): number => {
  let needed = 0;
  for (let i = 1; i < remaining.length; i++) {
    const peek = remaining[i];
    if (!peek) {
      break;
    }
    if (peek.kind === 'spacing') {
      needed += peek.height;
      continue;
    }
    if (peek.kind === 'text') {
      needed += Math.min(MIN_LINES, elLines(peek)) * peek.lineHeight;
    }
    break;
  }
  return needed;
};

const textRegionAt = (el: TextElement, flow: ColumnFlow, endLine: number): TextRegion => ({
  kind: 'text',
  x: colX(flow.col, flow.w, flow.config.columnGap),
  y: flow.y,
  width: flow.w,
  text: el.text,
  inlineSpans: el.inlineSpans,
  allLines: el.allLines,
  font: el.font,
  lineHeight: el.lineHeight,
  startLine: el.startLine,
  endLine,
  role: bodyRole(el),
});

/** Place an element that fits entirely in the current column. */
const placeWholeElement = (regions: Region[], el: BodyElement, flow: ColumnFlow): void => {
  const rx = colX(flow.col, flow.w, flow.config.columnGap);
  if (el.kind === 'text') {
    regions.push(textRegionAt(el, flow, el.endLine));
  } else if (el.kind === 'image') {
    regions.push({
      kind: 'image',
      x: rx,
      y: flow.y,
      width: flow.w,
      height: el.height,
      src: el.src,
      alt: el.alt,
      rounded: true,
    });
  } else if (el.kind === 'hr') {
    regions.push({ kind: 'rule', x: rx, y: flow.y, width: 48 });
  }
};

/**
 * How many lines of a text element to place in the remaining space.
 * Returns null when the split would violate MIN_LINES (widow/orphan control).
 */
const linesToPlace = (el: TextElement, spaceLeft: number): number | null => {
  const linesAvail = Math.floor(spaceLeft / el.lineHeight);
  if (linesAvail < MIN_LINES) {
    return null;
  }
  const total = elLines(el);
  const linesLeft = total - linesAvail;
  let toPlace = linesAvail;
  if (linesLeft > 0 && linesLeft < MIN_LINES) {
    toPlace = total - MIN_LINES;
    if (toPlace < MIN_LINES) {
      return null;
    }
  }
  return toPlace;
};

const flowIntoColumns = (
  elements: BodyElement[],
  startY: number,
  config: PageConfig,
): { regions: Region[]; remaining: BodyElement[] } => {
  const flow: ColumnFlow = { config, w: colWidth(config), maxY: pageHeight(config), startY, col: 0, y: startY };
  const regions: Region[] = [];
  let remaining = elements;

  while (remaining.length > 0) {
    const el = remaining[0];
    if (!el) {
      break;
    }
    const h = elHeight(el);

    if (el.kind === 'spacing') {
      if (flow.y > startY) {
        flow.y += h;
      }
      remaining = remaining.slice(1);
      continue;
    }

    if (el.kind === 'text' && el.variant === 'heading' && h + neededAfterHeading(remaining) > flowSpace(flow)) {
      if (!tryNextCol(flow)) {
        break;
      }
      continue;
    }

    if (h <= flowSpace(flow)) {
      placeWholeElement(regions, el, flow);
      flow.y += h;
      remaining = remaining.slice(1);
      continue;
    }

    if (el.kind === 'text') {
      const toPlace = linesToPlace(el, flowSpace(flow));
      if (toPlace === null) {
        if (!tryNextCol(flow)) {
          break;
        }
        continue;
      }
      regions.push(textRegionAt(el, flow, el.startLine + toPlace));
      remaining = [{ ...el, startLine: el.startLine + toPlace, isFirstParagraph: undefined }, ...remaining.slice(1)];
      if (!tryNextCol(flow)) {
        break;
      }
      continue;
    }

    if (!tryNextCol(flow)) {
      break;
    }
  }

  // Column separator
  addColumnSeparator(regions, startY, config);

  return { regions, remaining };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PlaceTextArgs, FlowAroundObstacleArgs };
export { placeText, flowTextAroundObstacle, placeDropCapParagraph, flowIntoColumns };
