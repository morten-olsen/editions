/**
 * Reader — Article content
 *
 * Assembles an article into the layout engine's content model: metadata first,
 * then the body blocks in source order. Roles are the vocabulary layout
 * functions pick from — an opener asks for the title and the hero, a body page
 * takes whatever is left.
 */

import { image, placedImage, text, type Content, type TextContent } from '@editions/layout-engine';

import { parseBlocks, type Block } from './reader.markdown.ts';

/* ── Types ────────────────────────────────────────────────────── */

type ArticleInput = {
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  sourceType?: string | null;
  /** Extracted article body, as markdown. */
  content?: string | null;
};

/* ── Constants ────────────────────────────────────────────────── */

/** Assumed shape of an inline figure when the real one isn't known yet. */
const DEFAULT_ASPECT = 16 / 9;

/* ── Private helpers ──────────────────────────────────────────── */

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatReadingTime = (seconds: number, sourceType?: string | null): string => {
  const minutes = Math.round(seconds / 60);
  const verb = sourceType === 'podcast' ? 'listen' : 'read';
  return minutes < 1 ? `< 1 min ${verb}` : `${minutes} min ${verb}`;
};

/** 'By Elena Marchetti · 8 min read · 4 March 2026' — whichever parts exist. */
const bylineFor = (article: ArticleInput): string => {
  const parts: string[] = [];

  if (article.author) {
    parts.push(`By ${article.author}`);
  }
  if (article.consumptionTimeSeconds) {
    parts.push(formatReadingTime(article.consumptionTimeSeconds, article.sourceType));
  }
  if (article.publishedAt) {
    const date = formatDate(article.publishedAt);
    if (date) {
      parts.push(date);
    }
  }

  return parts.join(' · ');
};

const contentForBlock = (block: Block): Content => {
  if (block.kind === 'image') {
    return image(block.src, 'figure', DEFAULT_ASPECT, block.alt || undefined);
  }
  if (block.kind === 'rule') {
    return text('', { role: 'rule' });
  }
  return text(block.text, { role: block.role, spans: block.spans });
};

/* ── Public functions ─────────────────────────────────────────── */

/**
 * Article to content stream. Metadata carries fixed roles so opener layouts can
 * find it; body blocks keep source order so the reader meets them as written.
 */
const articleContent = (article: ArticleInput): Content[] => {
  const items: Content[] = [text(article.sourceName, { role: 'source' }), text(article.title, { role: 'title' })];

  if (article.summary) {
    items.push(text(article.summary, { role: 'summary' }));
  }

  const byline = bylineFor(article);
  if (byline) {
    items.push(text(byline, { role: 'byline' }));
  }

  if (article.imageUrl) {
    items.push(placedImage(article.imageUrl, 'hero', DEFAULT_ASPECT));
  }

  if (article.content) {
    items.push(...parseBlocks(article.content).map(contentForBlock));
  }

  return items;
};

/** The parts of the stream that belong in the body flow. */
const bodyStream = (items: Content[]): Content[] => items.filter((item) => item.role !== 'hero' && !isMetadata(item));

const isMetadata = (item: Content): boolean =>
  item.type === 'text' && ['source', 'title', 'summary', 'byline'].includes(item.role);

/** Find one metadata item by role. */
const metaItem = (items: Content[], role: string): TextContent | null => {
  const found = items.find((item) => item.type === 'text' && item.role === role);
  return found?.type === 'text' ? found : null;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ArticleInput };
export { articleContent, bodyStream, metaItem, isMetadata, formatReadingTime, formatDate };
