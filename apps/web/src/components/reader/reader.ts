/**
 * Reader
 *
 * The reading surface. One parse of an article, one description of how it
 * looks, and a paged renderer that typesets it into pages that fit the screen
 * exactly — so reading is turning pages, not scrolling a column.
 *
 *   <PagedArticle article={article} footer={<VoteControls … />} />
 *
 * Both the paged renderer and anything else that displays article prose work
 * from `articleContent` and `reader.styles`, which is what keeps them looking
 * like the same publication.
 */

/* ── Content ──────────────────────────────────────────────────── */

export type { ArticleInput } from './reader.content.ts';
export { articleContent, bodyStream, metaItem, formatReadingTime, formatDate } from './reader.content.ts';

export type { Block, TextRole } from './reader.markdown.ts';
export { parseBlocks } from './reader.markdown.ts';

/* ── Style vocabulary ─────────────────────────────────────────── */

export type { Role, TypeScale, PageMetrics } from './reader.styles.ts';
export { typeScale, applyRole, roleStyle, roleClass, inlineClass, inlineRenderer } from './reader.styles.ts';

/* ── Layouts ──────────────────────────────────────────────────── */

export type { PageStyle } from './reader.layouts.ts';
export { openerLayout, bodyLayout, pageStyle, placeRule, placeText, FOOTER_SPACE } from './reader.layouts.ts';

/* ── Surface ──────────────────────────────────────────────────── */

export type { PagedReaderProps } from './reader.paged.tsx';
export { PagedReader } from './reader.paged.tsx';

export type { Sheet, PagedSurfaceProps, PageFooterArgs } from './reader.surface.tsx';
export { PagedSurface, PageView } from './reader.surface.tsx';

export type { PagedArticleProps } from './reader.article.tsx';
export { PagedArticle, Folio } from './reader.article.tsx';

/* ── Format ───────────────────────────────────────────────────── */

export type { FormatMode, ReaderFormat, TurnModel } from './reader.format.ts';
export { formatFor, spreadStart, pagesShown, nextIndex, previousIndex } from './reader.format.ts';

/* ── Hooks ────────────────────────────────────────────────────── */

export type { Size, PaginatedArticle } from './reader.hooks.ts';
export { useElementSize, useFontsReady, usePagination, useArticlePagination, usePageSlot } from './reader.hooks.ts';
