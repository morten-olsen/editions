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

import {
  layoutWithLines,
} from '@chenglou/pretext';

import type {
  MeasuredSegment,
  MeasuredTextSegment,
  FontConfig,
} from './magazine.measure.ts';

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

/**
 * Estimate the height of the article opener (source badge + title + byline + optional image + summary).
 * This is an approximation — we use pretext to measure the title text, and fixed heights for other elements.
 */
const estimateOpenerHeight = (
  opener: ArticleOpener,
  contentWidth: number,
  fontConfig: FontConfig,
  viewportHeight: number,
  style: 'standard' | 'feature' | 'minimal' = 'standard',
): number => {
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

/* ── Paginate ─────────────────────────────────────────────────── */

const paginateArticle = (args: PaginateArgs): PaginateResult => {
  const {
    opener,
    measuredSegments,
    viewport,
    columns,
    padding,
    columnGap,
    fontConfig,
    footerHeight,
  } = args;

  const contentWidth = viewport.width - padding.horizontal * 2;
  const columnWidth = columns === 2
    ? (contentWidth - columnGap) / 2
    : contentWidth;

  // Account for nav bar at the bottom of the viewport
  const pageContentHeight = viewport.height - padding.top - padding.bottom - NAV_BAR_HEIGHT;

  // Calculate opener height for first page
  const style = args.style ?? 'standard';
  const openerHeight = estimateOpenerHeight(opener, contentWidth, fontConfig, viewport.height, style);

  const pages: ArticlePage[] = [];
  let currentPage: PageRegion[] = [];
  let pageIndex = 0;

  // On the first page, body content starts below the opener
  let cursor: ColumnCursor = { column: 0, y: openerHeight };

  const availableHeight = (isLastPage: boolean): number =>
    pageContentHeight - (isLastPage ? footerHeight : 0);

  const remainingInColumn = (isLastPage: boolean): number =>
    availableHeight(isLastPage) - cursor.y;

  const advanceColumn = (): boolean => {
    if (cursor.column < columns - 1) {
      cursor = { column: cursor.column + 1, y: 0 };
      return true;
    }
    return false;
  };

  const newPage = (): void => {
    pages.push({
      pageIndex,
      regions: currentPage,
      isFirstPage: pageIndex === 0,
      isLastPage: false, // will be corrected at the end
    });
    pageIndex++;
    currentPage = [];
    cursor = { column: 0, y: 0 };
  };

  const nextColumn = (): void => {
    if (!advanceColumn()) {
      newPage();
    }
  };

  const placeRegion = (region: PageRegion, height: number): void => {
    currentPage.push(region);
    cursor.y += height;
  };

  // Process each segment
  let segIdx = 0;
  while (segIdx < measuredSegments.length) {
    const measured = measuredSegments[segIdx]!;
    const remaining = remainingInColumn(false);

    switch (measured.segment.kind) {
      case 'paragraph':
      case 'heading':
      case 'blockquote': {
        const textMeasured = measured as MeasuredTextSegment;
        const lineHeight = textMeasured.fontEntry.lineHeight;
        const totalLines = textMeasured.lineCount;

        // Check if heading would be orphaned at column bottom
        if (measured.segment.kind === 'heading') {
          // A heading needs itself + at least MIN_LINES of the next segment
          const nextSeg = measuredSegments[segIdx + 1];
          const neededAfter = nextSeg && 'lineCount' in nextSeg
            ? Math.min(MIN_LINES, (nextSeg as MeasuredTextSegment).lineCount) * (nextSeg as MeasuredTextSegment).fontEntry.lineHeight
            : 0;
          if (measured.height + neededAfter > remaining && remaining < pageContentHeight * 0.8) {
            nextColumn();
            continue; // re-process this segment in the new column
          }
        }

        // Does it fit entirely?
        if (measured.height <= remainingInColumn(false)) {
          placeRegion(
            { measured, column: cursor.column, y: cursor.y },
            measured.height,
          );
          segIdx++;
          break;
        }

        // Split: how many lines fit?
        const linesAvailable = Math.floor(remainingInColumn(false) / lineHeight);

        if (linesAvailable < MIN_LINES) {
          // Not enough room for even MIN_LINES — move to next column
          nextColumn();
          continue; // re-process
        }

        // Check orphan on the remaining side
        const linesRemaining = totalLines - linesAvailable;
        let linesToPlace = linesAvailable;

        if (linesRemaining > 0 && linesRemaining < MIN_LINES) {
          // Would leave orphan lines in next column — give them room
          linesToPlace = totalLines - MIN_LINES;
          if (linesToPlace < MIN_LINES) {
            // Can't split well — move entire segment to next column
            nextColumn();
            continue;
          }
        }

        // Place first part
        placeRegion(
          {
            measured,
            lineRange: { start: 0, end: linesToPlace },
            column: cursor.column,
            y: cursor.y,
          },
          linesToPlace * lineHeight,
        );

        // Continue with remaining lines in next column
        nextColumn();

        // Place remaining as continuation
        const remainingLines = totalLines - linesToPlace;
        if (remainingLines > 0) {
          placeRegion(
            {
              measured,
              lineRange: { start: linesToPlace, end: totalLines },
              column: cursor.column,
              y: cursor.y,
            },
            remainingLines * lineHeight,
          );
        }

        segIdx++;
        break;
      }

      case 'image': {
        // Images don't split — if they don't fit, move to next column
        if (measured.height > remaining && remaining < pageContentHeight * 0.9) {
          nextColumn();
          continue;
        }
        placeRegion(
          { measured, column: cursor.column, y: cursor.y },
          measured.height,
        );
        segIdx++;
        break;
      }

      case 'spacing': {
        // Spacing at column/page top is suppressed
        if (cursor.y === 0 || (cursor.y === openerHeight && pageIndex === 0 && cursor.column === 0)) {
          segIdx++;
          break;
        }
        const height = measured.height;
        if (height > remaining) {
          // Don't add spacing that would overflow — just move on
          segIdx++;
          break;
        }
        placeRegion(
          { measured, column: cursor.column, y: cursor.y },
          height,
        );
        segIdx++;
        break;
      }

      case 'hr': {
        if (measured.height > remaining) {
          nextColumn();
          continue;
        }
        placeRegion(
          { measured, column: cursor.column, y: cursor.y },
          measured.height,
        );
        segIdx++;
        break;
      }
    }
  }

  // Push the final page
  pages.push({
    pageIndex,
    regions: currentPage,
    isFirstPage: pageIndex === 0,
    isLastPage: true,
  });

  // If the only page has no body content regions but has an opener, that's fine
  // If we ended up with an empty last page (all content fit on previous), merge
  if (pages.length > 1) {
    const lastPage = pages.at(-1)!;
    if (lastPage.regions.length === 0) {
      // Move isLastPage flag to the previous page
      pages.pop();
      pages.at(-1)!.isLastPage = true;
    }
  }

  // Handle case where footer doesn't fit on the last page
  const lastPage = pages.at(-1)!;
  if (lastPage.isLastPage) {
    const maxY = lastPage.regions.reduce((max, r) => {
      const h = r.measured.height;
      const regionBottom = r.y + (r.lineRange
        ? (r.lineRange.end - r.lineRange.start) * (r.measured as MeasuredTextSegment).fontEntry.lineHeight
        : h);
      return Math.max(max, regionBottom);
    }, 0);

    if (maxY + footerHeight > pageContentHeight) {
      // Footer doesn't fit — add an empty page for it
      pages.at(-1)!.isLastPage = false;
      pages.push({
        pageIndex: pages.length,
        regions: [],
        isFirstPage: false,
        isLastPage: true,
      });
    }
  }

  return {
    pages,
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
export {
  paginateArticle,
  estimateOpenerHeight,
  desktopPadding,
  mobilePadding,
  desktopColumnGap,
  footerReservedHeight,
};
