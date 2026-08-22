/**
 * Magazine Paginate
 *
 * The bin-packing engine that assigns measured segments to pages and columns.
 * Takes measured segments + viewport dimensions and produces a flat array of
 * ArticlePage objects, each containing positioned regions.
 *
 * Key design decisions:
 * - Widow/orphan control: never fewer than 2 lines at column bottom or top
 * - Headings pull at least 2 following lines with them
 * - Text segments can split across columns/pages via lineRange
 * - The opener (title, source, byline) spans full width on the first page
 * - Footer is reserved on the last page
 */

import { layoutWithLines } from '@chenglou/pretext';

import type { MeasuredSegment, MeasuredTextSegment, FontConfig } from './magazine.measure.ts';
import { getPrepared } from './magazine.measure.ts';
import { NAV_BAR_HEIGHT } from './magazine.paged-article.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type PageRegion = {
  /** The measured segment this region represents */
  measured: MeasuredSegment;
  /** For text segments split across pages: which lines appear on this page */
  lineRange?: { start: number; end: number };
  /** Column index (0 or 1 for 2-column layouts) */
  column: number;
  /** Vertical offset from the top of the column content area */
  y: number;
};

type ArticlePage = {
  /** 0-based index within this article */
  pageIndex: number;
  /** Regions to render on this page */
  regions: PageRegion[];
  /** Whether this is the first page (render opener) */
  isFirstPage: boolean;
  /** Whether this is the last page (render footer) */
  isLastPage: boolean;
};

type ArticleOpener = {
  sourceName: string;
  title: string;
  author?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  sourceType?: string | null;
  imageUrl?: string | null;
  summary?: string | null;
};

type PagePadding = {
  top: number;
  bottom: number;
  horizontal: number;
};

type PaginateArgs = {
  opener: ArticleOpener;
  measuredSegments: MeasuredSegment[];
  viewport: { width: number; height: number };
  columns: 1 | 2;
  padding: PagePadding;
  columnGap: number;
  fontConfig: FontConfig;
  /** Reserved height for the footer on the last page */
  footerHeight: number;
  /** Visual style of the article opener */
  style?: 'standard' | 'feature' | 'minimal';
};

type PaginateResult = {
  pages: ArticlePage[];
  layout: {
    contentWidth: number;
    columnWidth: number;
    columnGap: number;
    columns: 1 | 2;
    padding: PagePadding;
    pageContentHeight: number;
    openerHeight: number;
  };
};

/* ── Opener height estimation ─────────────────────────────────── */

type EstimateOpenerHeightArgs = {
  opener: ArticleOpener;
  contentWidth: number;
  fontConfig: FontConfig;
  viewportHeight: number;
  style?: 'standard' | 'feature' | 'minimal';
};

/**
 * Estimate the height of the article opener (source badge + title + byline + optional image + summary).
 * This is an approximation — we use pretext to measure the title text, and fixed heights for other elements.
 */
const estimateOpenerHeight = ({
  opener,
  contentWidth,
  fontConfig,
  viewportHeight,
  style = 'standard',
}: EstimateOpenerHeightArgs): number => {
  let height = 0;

  if (style === 'minimal') {
    // Minimal: rule + source + title + byline + margin
    height += 4 + 8 + 20; // rule + gaps
    const titleFont = '500 24px Newsreader';
    const titlePrepared = getPrepared(opener.title, titleFont);
    const titleLayout = layoutWithLines(titlePrepared, contentWidth, 30);
    height += titleLayout.height;
    height += 20 + 8; // byline + margin
    return height;
  }

  // Source badge + gap
  height += 20 + 8;

  // Title: measure with pretext
  const isFeature = style === 'feature';
  const titleFont = isFeature ? '600 32px Newsreader' : '500 28px Newsreader';
  const titleLineHeight = isFeature ? 38 : 34;
  const titlePrepared = getPrepared(opener.title, titleFont);
  const titleLayout = layoutWithLines(titlePrepared, contentWidth, titleLineHeight);
  height += titleLayout.height + 8;

  // Summary (feature style only)
  if (isFeature && opener.summary) {
    const summaryPrepared = getPrepared(opener.summary, fontConfig.body.font);
    const summaryLayout = layoutWithLines(summaryPrepared, Math.min(contentWidth, 600), fontConfig.body.lineHeight);
    height += summaryLayout.height + 8;
  }

  // Byline + gap
  height += 20 + 8;

  // Hero image if present
  if (opener.imageUrl) {
    const navBarSpace = NAV_BAR_HEIGHT;
    const maxImageHeight = (viewportHeight - navBarSpace) * 0.25;
    const imageHeight = Math.min(contentWidth / (16 / 9), maxImageHeight);
    height += imageHeight + 12;
  }

  // Divider + margin
  height += 1 + 12;

  return height;
};

/* ── Minimum lines for widow/orphan control ───────────────────── */

const MIN_LINES = 2;

/* ── Column cursor ────────────────────────────────────────────── */

type ColumnCursor = {
  column: number;
  y: number;
};

/* ── Paginator state ──────────────────────────────────────────── */

type PaginatorState = {
  columns: 1 | 2;
  pageContentHeight: number;
  openerHeight: number;
  pages: ArticlePage[];
  currentPage: PageRegion[];
  pageIndex: number;
  cursor: ColumnCursor;
};

const remainingInColumn = (state: PaginatorState): number => state.pageContentHeight - state.cursor.y;

const advanceColumn = (state: PaginatorState): boolean => {
  if (state.cursor.column < state.columns - 1) {
    state.cursor = { column: state.cursor.column + 1, y: 0 };
    return true;
  }
  return false;
};

const newPage = (state: PaginatorState): void => {
  state.pages.push({
    pageIndex: state.pageIndex,
    regions: state.currentPage,
    isFirstPage: state.pageIndex === 0,
    isLastPage: false, // will be corrected at the end
  });
  state.pageIndex++;
  state.currentPage = [];
  state.cursor = { column: 0, y: 0 };
};

const nextColumn = (state: PaginatorState): void => {
  if (!advanceColumn(state)) {
    newPage(state);
  }
};

const placeRegion = (state: PaginatorState, region: PageRegion, height: number): void => {
  state.currentPage.push(region);
  state.cursor.y += height;
};

/* ── Segment placement ────────────────────────────────────────── */

type PlaceOutcome = 'placed' | 'retry';

/** A heading needs itself + at least MIN_LINES of the next segment. */
const headingOrphaned = (
  state: PaginatorState,
  measured: MeasuredSegment,
  nextSeg: MeasuredSegment | undefined,
  remaining: number,
): boolean => {
  const neededAfter =
    nextSeg && 'lineCount' in nextSeg
      ? Math.min(MIN_LINES, (nextSeg as MeasuredTextSegment).lineCount) *
        (nextSeg as MeasuredTextSegment).fontEntry.lineHeight
      : 0;
  return measured.height + neededAfter > remaining && remaining < state.pageContentHeight * 0.8;
};

/**
 * How many lines fit in the remaining space, with widow/orphan control.
 * Returns null when the segment should move to the next column instead.
 */
const splitLineCount = (totalLines: number, lineHeight: number, remaining: number): number | null => {
  const linesAvailable = Math.floor(remaining / lineHeight);

  if (linesAvailable < MIN_LINES) {
    // Not enough room for even MIN_LINES — move to next column
    return null;
  }

  // Check orphan on the remaining side
  const linesRemaining = totalLines - linesAvailable;
  let linesToPlace = linesAvailable;

  if (linesRemaining > 0 && linesRemaining < MIN_LINES) {
    // Would leave orphan lines in next column — give them room
    linesToPlace = totalLines - MIN_LINES;
    if (linesToPlace < MIN_LINES) {
      // Can't split well — move entire segment to next column
      return null;
    }
  }

  return linesToPlace;
};

const placeTextSegment = (
  state: PaginatorState,
  measured: MeasuredSegment,
  nextSeg: MeasuredSegment | undefined,
): PlaceOutcome => {
  const remaining = remainingInColumn(state);
  const textMeasured = measured as MeasuredTextSegment;
  const lineHeight = textMeasured.fontEntry.lineHeight;
  const totalLines = textMeasured.lineCount;

  // Check if heading would be orphaned at column bottom
  if (measured.segment.kind === 'heading' && headingOrphaned(state, measured, nextSeg, remaining)) {
    nextColumn(state);
    return 'retry'; // re-process this segment in the new column
  }

  // Does it fit entirely?
  if (measured.height <= remainingInColumn(state)) {
    placeRegion(state, { measured, column: state.cursor.column, y: state.cursor.y }, measured.height);
    return 'placed';
  }

  // Split: how many lines fit?
  const linesToPlace = splitLineCount(totalLines, lineHeight, remainingInColumn(state));
  if (linesToPlace === null) {
    nextColumn(state);
    return 'retry'; // re-process
  }

  // Place first part
  placeRegion(
    state,
    {
      measured,
      lineRange: { start: 0, end: linesToPlace },
      column: state.cursor.column,
      y: state.cursor.y,
    },
    linesToPlace * lineHeight,
  );

  // Continue with remaining lines in next column
  nextColumn(state);

  // Place remaining as continuation
  const remainingLines = totalLines - linesToPlace;
  if (remainingLines > 0) {
    placeRegion(
      state,
      {
        measured,
        lineRange: { start: linesToPlace, end: totalLines },
        column: state.cursor.column,
        y: state.cursor.y,
      },
      remainingLines * lineHeight,
    );
  }

  return 'placed';
};

const placeImageSegment = (state: PaginatorState, measured: MeasuredSegment): PlaceOutcome => {
  const remaining = remainingInColumn(state);
  // Images don't split — if they don't fit, move to next column
  if (measured.height > remaining && remaining < state.pageContentHeight * 0.9) {
    nextColumn(state);
    return 'retry';
  }
  placeRegion(state, { measured, column: state.cursor.column, y: state.cursor.y }, measured.height);
  return 'placed';
};

const placeSpacingSegment = (state: PaginatorState, measured: MeasuredSegment): PlaceOutcome => {
  const { cursor, openerHeight, pageIndex } = state;
  // Spacing at column/page top is suppressed
  if (cursor.y === 0 || (cursor.y === openerHeight && pageIndex === 0 && cursor.column === 0)) {
    return 'placed';
  }
  const height = measured.height;
  if (height > remainingInColumn(state)) {
    // Don't add spacing that would overflow — just move on
    return 'placed';
  }
  placeRegion(state, { measured, column: cursor.column, y: cursor.y }, height);
  return 'placed';
};

const placeHrSegment = (state: PaginatorState, measured: MeasuredSegment): PlaceOutcome => {
  if (measured.height > remainingInColumn(state)) {
    nextColumn(state);
    return 'retry';
  }
  placeRegion(state, { measured, column: state.cursor.column, y: state.cursor.y }, measured.height);
  return 'placed';
};

const placeSegment = (
  state: PaginatorState,
  measured: MeasuredSegment,
  nextSeg: MeasuredSegment | undefined,
): PlaceOutcome => {
  switch (measured.segment.kind) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
      return placeTextSegment(state, measured, nextSeg);
    case 'image':
      return placeImageSegment(state, measured);
    case 'spacing':
      return placeSpacingSegment(state, measured);
    case 'hr':
      return placeHrSegment(state, measured);
  }
};

/* ── Finalization ─────────────────────────────────────────────── */

const finalizePages = (state: PaginatorState, footerHeight: number): void => {
  const { pages, pageContentHeight } = state;

  // Push the final page
  pages.push({
    pageIndex: state.pageIndex,
    regions: state.currentPage,
    isFirstPage: state.pageIndex === 0,
    isLastPage: true,
  });

  // If the only page has no body content regions but has an opener, that's fine
  // If we ended up with an empty last page (all content fit on previous), merge
  if (pages.length > 1) {
    const trailing = pages.at(-1);
    if (trailing && trailing.regions.length === 0) {
      // Move isLastPage flag to the previous page
      pages.pop();
      const previous = pages.at(-1);
      if (previous) {
        previous.isLastPage = true;
      }
    }
  }

  // Handle case where footer doesn't fit on the last page
  const lastPage = pages.at(-1);
  if (lastPage?.isLastPage) {
    const maxY = lastPage.regions.reduce((max, r) => {
      const h = r.measured.height;
      const regionBottom =
        r.y +
        (r.lineRange
          ? (r.lineRange.end - r.lineRange.start) * (r.measured as MeasuredTextSegment).fontEntry.lineHeight
          : h);
      return Math.max(max, regionBottom);
    }, 0);

    if (maxY + footerHeight > pageContentHeight) {
      // Footer doesn't fit — add an empty page for it
      lastPage.isLastPage = false;
      pages.push({
        pageIndex: pages.length,
        regions: [],
        isFirstPage: false,
        isLastPage: true,
      });
    }
  }
};

/* ── Paginate ─────────────────────────────────────────────────── */

const paginateArticle = (args: PaginateArgs): PaginateResult => {
  const { opener, measuredSegments, viewport, columns, padding, columnGap, fontConfig, footerHeight } = args;

  const contentWidth = viewport.width - padding.horizontal * 2;
  const columnWidth = columns === 2 ? (contentWidth - columnGap) / 2 : contentWidth;

  // Account for nav bar at the bottom of the viewport
  const pageContentHeight = viewport.height - padding.top - padding.bottom - NAV_BAR_HEIGHT;

  // Calculate opener height for first page
  const style = args.style ?? 'standard';
  const openerHeight = estimateOpenerHeight({
    opener,
    contentWidth,
    fontConfig,
    viewportHeight: viewport.height,
    style,
  });

  const state: PaginatorState = {
    columns,
    pageContentHeight,
    openerHeight,
    pages: [],
    currentPage: [],
    pageIndex: 0,
    // On the first page, body content starts below the opener
    cursor: { column: 0, y: openerHeight },
  };

  // Process each segment; 'retry' re-processes the segment in a fresh column
  let segIdx = 0;
  while (segIdx < measuredSegments.length) {
    const measured = measuredSegments[segIdx];
    if (!measured) {
      break;
    }
    const outcome = placeSegment(state, measured, measuredSegments[segIdx + 1]);
    if (outcome === 'placed') {
      segIdx++;
    }
  }

  finalizePages(state, footerHeight);

  return {
    pages: state.pages,
    layout: {
      contentWidth,
      columnWidth,
      columnGap,
      columns,
      padding,
      pageContentHeight,
      openerHeight,
    },
  };
};

/* ── Layout dimensions ────────────────────────────────────────── */

const desktopPadding: PagePadding = { top: 48, bottom: 48, horizontal: 80 };
const mobilePadding: PagePadding = { top: 40, bottom: 40, horizontal: 24 };
const desktopColumnGap = 40;
const footerReservedHeight = 120;

/* ── Exports ──────────────────────────────────────────────────── */

export type { PageRegion, ArticlePage, ArticleOpener, PagePadding, PaginateArgs, PaginateResult };
export { paginateArticle, estimateOpenerHeight, desktopPadding, mobilePadding, desktopColumnGap, footerReservedHeight };
