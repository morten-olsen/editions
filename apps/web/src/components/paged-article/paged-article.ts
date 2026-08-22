/**
 * Paged Article
 *
 * A typesetter-model layout engine for rendering markdown articles as
 * paginated, magazine-style pages. Every element on every page is measured
 * with pretext and absolutely positioned — no HTML flow.
 *
 * Public API:
 * - layoutArticle()      — article + viewport → pages (array of positioned regions)
 * - prepareArticle()     — parse markdown + measure → ArticleContent
 * - buildPages()         — apply layout functions until content is consumed
 * - PagedArticleView     — drop-in React component
 * - openerLayout()       — title page layout function
 * - bodyLayout           — body content layout function
 */

/* ── Engine ───────────────────────────────────────────────────── */

export type { ArticleInput, ArticleStyle, LayoutOptions, LayoutResult, Breakpoint } from './paged-article.engine.ts';
export {
  layoutArticle,
  prepareArticle,
  buildPages,
  getBreakpoint,
  configForBreakpoint,
  clearPrepareCache,
} from './paged-article.engine.ts';

/* ── Layout functions ─────────────────────────────────────────── */

export type { PageLayoutFn, PageConfig, PagePadding } from './paged-article.layouts.ts';
export { openerLayout, bodyLayout } from './paged-article.layouts.ts';

/* ── React components ─────────────────────────────────────────── */

export type { PagedArticleViewProps } from './paged-article.view.tsx';
export { PagedArticleView } from './paged-article.view.tsx';

export type { PageRendererProps } from './paged-article.render.tsx';
export { PageRenderer } from './paged-article.render.tsx';

/* ── Core types (for custom layouts and composition) ──────────── */

export type {
  Region,
  TextRegion,
  ImageRegion,
  RuleRegion,
  SeparatorRegion,
  Page,
  ArticleContent,
  ArticleMeta,
  BodyElement,
  TextElement,
  ImageElement,
  SpacingElement,
  HrElement,
} from './paged-article.layouts.ts';

export type { Segment, TextSegment, InlineSpan } from './paged-article.segments.ts';
export type { FontConfig, MeasuredSegment, MeasuredText } from './paged-article.measure.ts';
