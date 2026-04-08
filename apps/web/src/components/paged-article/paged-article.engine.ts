/**
 * Paged Article — Engine
 *
 * Prepares article content for layout and runs the build loop.
 *
 * Flow:
 *   1. prepareArticle() — parse markdown + measure → ArticleContent
 *   2. buildPages()     — apply layout functions until content is consumed
 *   3. layoutArticle()  — high-level API combining both
 */

import { parseSegments } from './paged-article.segments.ts';
import {
  measureSegments,
  desktopFonts,
  mobileFonts,
  clearPrepareCache,
  type FontConfig,
  type MeasuredText,
} from './paged-article.measure.ts';
import {
  openerLayout,
  bodyLayout,
  colWidth,
  NAV_HEIGHT,
  desktopPadding,
  tabletPadding,
  mobilePadding,
  desktopColumnGap,
  type ArticleContent,
  type ArticleMeta,
  type BodyElement,
  type TextElement,
  type Page,
  type PageConfig,
  type PageLayoutFn,
  type PagePadding,
} from './paged-article.layouts.ts';

/* ── Input types ──────────────────────────────────────────────── */

type ArticleInput = {
  title: string;
  sourceName: string;
  content: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  sourceType?: string | null;
};

type ArticleStyle = 'feature' | 'standard' | 'minimal';

type LayoutOptions = {
  viewport: { width: number; height: number };
  style?: ArticleStyle;
};

/* ── Result type ──────────────────────────────────────────────── */

type LayoutResult = {
  pages: Page[];
  pageCount: number;
  meta: ArticleMeta;
  config: PageConfig;
  breakpoint: Breakpoint;
};

/* ── Responsive breakpoints ───────────────────────────────────── */

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = 640;
const TABLET_MAX = 1024;

const getBreakpoint = (width: number): Breakpoint => {
  if (width < MOBILE_MAX) return 'mobile';
  if (width < TABLET_MAX) return 'tablet';
  return 'desktop';
};

type BreakpointConfig = {
  fontConfig: FontConfig;
  padding: PagePadding;
  columns: 1 | 2;
  columnGap: number;
};

const configForBreakpoint = (bp: Breakpoint): BreakpointConfig => {
  switch (bp) {
    case 'mobile':
      return { fontConfig: mobileFonts, padding: mobilePadding, columns: 1, columnGap: 0 };
    case 'tablet':
      return { fontConfig: desktopFonts, padding: tabletPadding, columns: 2, columnGap: 32 };
    case 'desktop':
      return { fontConfig: desktopFonts, padding: desktopPadding, columns: 2, columnGap: desktopColumnGap };
  }
};

/* ── Prepare article content ──────────────────────────────────── */

/**
 * Parse markdown and measure all segments for a given page config.
 * Returns an ArticleContent ready to be consumed by layout functions.
 */
const prepareArticle = (
  input: ArticleInput,
  pageConfig: PageConfig,
  fontConfig: FontConfig,
): ArticleContent => {
  const segments = parseSegments(input.content);
  const colW = colWidth(pageConfig);

  const measured = measureSegments({
    segments,
    columnWidth: colW,
    viewportHeight: pageConfig.height,
    fontConfig,
  });

  // Convert measured segments → body elements
  const elements: BodyElement[] = measured.map((m): BodyElement => {
    switch (m.segment.kind) {
      case 'paragraph':
      case 'heading':
      case 'blockquote': {
        const tm = m as MeasuredText;
        return {
          kind: 'text',
          variant: m.segment.kind,
          text: m.segment.text,
          inlineSpans: m.segment.inlineSpans,
          headingLevel: m.segment.headingLevel,
          isFirstParagraph: m.segment.isFirstParagraph,
          allLines: tm.lines,
          font: tm.fontEntry.font,
          lineHeight: tm.fontEntry.lineHeight,
          prepared: tm.prepared,
          startLine: 0,
          endLine: tm.lineCount,
        } satisfies TextElement;
      }
      case 'image':
        return { kind: 'image', src: m.segment.src, alt: m.segment.alt, height: m.height };
      case 'spacing':
        return { kind: 'spacing', height: m.height };
      case 'hr':
        return { kind: 'hr', height: m.height };
    }
  });

  const meta: ArticleMeta = {
    title: input.title,
    sourceName: input.sourceName,
    author: input.author,
    summary: input.summary,
    publishedAt: input.publishedAt,
    consumptionTimeSeconds: input.consumptionTimeSeconds,
    sourceType: input.sourceType,
    heroImage: input.imageUrl,
  };

  return { meta, elements };
};

/* ── Build pages ──────────────────────────────────────────────── */

const MAX_PAGES = 100;

/**
 * Apply layout functions to content until all content is consumed.
 *
 * The first layout in the sequence is used for the first page,
 * the second for the second, etc. When the sequence runs out,
 * the last layout is repeated for all remaining pages.
 */
const buildPages = (
  content: ArticleContent,
  config: PageConfig,
  layouts: PageLayoutFn[],
): Page[] => {
  const pages: Page[] = [];
  let remaining = content;
  let idx = 0;

  while (remaining.meta || remaining.elements.length > 0) {
    const layout = layouts[Math.min(idx, layouts.length - 1)]!;
    const result = layout(remaining, config);
    pages.push(result.page);
    remaining = result.remaining;
    idx++;

    if (pages.length >= MAX_PAGES) break;
  }

  return pages;
};

/* ── High-level API ───────────────────────────────────────────── */

/**
 * Lay out an article into pages.
 *
 * This is the main entry point. Pass article data and viewport dimensions;
 * get back an array of pages ready for rendering.
 */
const layoutArticle = (input: ArticleInput, options: LayoutOptions): LayoutResult => {
  const { viewport, style = 'standard' } = options;
  const bp = getBreakpoint(viewport.width);
  const bpConfig = configForBreakpoint(bp);

  const pageConfig: PageConfig = {
    width: viewport.width,
    height: viewport.height,
    padding: bpConfig.padding,
    columns: bpConfig.columns,
    columnGap: bpConfig.columnGap,
    navHeight: NAV_HEIGHT,
    footerHeight: 48,
  };

  const content = prepareArticle(input, pageConfig, bpConfig.fontConfig);
  const meta = content.meta!;

  // Layout sequence: opener first, then body pages
  const layouts: PageLayoutFn[] = [
    openerLayout(style),
    bodyLayout,
  ];

  const pages = buildPages(content, pageConfig, layouts);

  return {
    pages,
    pageCount: pages.length,
    meta,
    config: pageConfig,
    breakpoint: bp,
  };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ArticleInput, ArticleStyle, LayoutOptions, LayoutResult, Breakpoint, BreakpointConfig };
export { prepareArticle, buildPages, layoutArticle, getBreakpoint, configForBreakpoint, clearPrepareCache };
