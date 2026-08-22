/**
 * Paged Article — Model
 *
 * Shared types, geometry helpers, and typography constants for the
 * pure typesetter. Regions are positioned elements on a page; body
 * elements are unconsumed content waiting to be flowed.
 */

import type { LayoutLine, PreparedTextWithSegments } from '@chenglou/pretext';

import type { InlineSpan } from './paged-article.segments.ts';
import { SERIF_STACK, SANS_STACK, MONO_STACK } from './paged-article.measure.ts';

/* ── Regions ──────────────────────────────────────────────────── */

type TextRegion = {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  text: string;
  inlineSpans: InlineSpan[];
  allLines: LayoutLine[];
  font: string;
  lineHeight: number;
  startLine: number;
  endLine: number;
  role: 'title' | 'source' | 'summary' | 'byline' | 'body' | 'heading' | 'blockquote' | 'dropcap';
};

type ImageRegion = {
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  alt: string;
  rounded?: boolean;
};

type RuleRegion = {
  kind: 'rule';
  x: number;
  y: number;
  width: number;
  accent?: boolean;
};

type SeparatorRegion = {
  kind: 'separator';
  x: number;
  y: number;
  height: number;
};

type Region = TextRegion | ImageRegion | RuleRegion | SeparatorRegion;

type Page = { regions: Region[] };

/* ── Body elements (unconsumed content) ───────────────────────── */

type TextElement = {
  kind: 'text';
  variant: 'paragraph' | 'heading' | 'blockquote';
  text: string;
  inlineSpans: InlineSpan[];
  headingLevel?: number;
  isFirstParagraph?: boolean;
  allLines: LayoutLine[];
  font: string;
  lineHeight: number;
  prepared: PreparedTextWithSegments;
  startLine: number;
  endLine: number;
};

type ImageElement = { kind: 'image'; src: string; alt: string; height: number };
type SpacingElement = { kind: 'spacing'; height: number };
type HrElement = { kind: 'hr'; height: number };
type BodyElement = TextElement | ImageElement | SpacingElement | HrElement;

/* ── Article content ──────────────────────────────────────────── */

type ArticleMeta = {
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  sourceType?: string | null;
  heroImage?: string | null;
};

type ArticleContent = {
  meta: ArticleMeta | null;
  elements: BodyElement[];
};

/* ── Page config ──────────────────────────────────────────────── */

type PagePadding = { top: number; bottom: number; horizontal: number };

type PageConfig = {
  width: number;
  height: number;
  padding: PagePadding;
  columns: 1 | 2;
  columnGap: number;
  navHeight: number;
  footerHeight: number;
};

type PageLayoutFn = (content: ArticleContent, config: PageConfig) => { page: Page; remaining: ArticleContent };

/* ── Geometry helpers ─────────────────────────────────────────── */

const contentWidth = (config: PageConfig): number => config.width - config.padding.horizontal * 2;

const colWidth = (config: PageConfig): number => {
  const w = contentWidth(config);
  return config.columns === 2 ? (w - config.columnGap) / 2 : w;
};

const pageHeight = (config: PageConfig): number =>
  config.height - config.padding.top - config.padding.bottom - config.navHeight - config.footerHeight;

const elHeight = (el: BodyElement): number =>
  el.kind === 'text' ? (el.endLine - el.startLine) * el.lineHeight : el.height;

const elLines = (el: TextElement): number => el.endLine - el.startLine;

const colX = (col: number, w: number, gap: number): number => (col === 0 ? 0 : w + gap);

/* ── Typography ───────────────────────────────────────────────── */

const MIN_LINES = 2;

/** Spacing scale — like a typographer's leading hierarchy */
const SPACE = {
  /** Between tightly coupled elements: source → title */
  tight: 6,
  /** Default gap between opener elements */
  element: 14,
  /** After title, before summary/byline — room to breathe */
  after_title: 18,
  /** After hero image or before/after major dividers */
  section: 24,
  /** Between full-width intro and column body */
  columns: 36,
};

const HERO_HEIGHT = 260;
const HERO_HEIGHT_SMALL = 180;

const titleFontFor = (style: 'feature' | 'standard' | 'minimal'): { font: string; lineHeight: number } => {
  switch (style) {
    case 'feature':
      return { font: `600 36px ${SERIF_STACK}`, lineHeight: 42 };
    case 'standard':
      return { font: `500 28px ${SERIF_STACK}`, lineHeight: 34 };
    case 'minimal':
      return { font: `500 24px ${SERIF_STACK}`, lineHeight: 30 };
  }
};

const SOURCE_FONT = `12px ${MONO_STACK}`;
const SOURCE_LH = 18;
const BYLINE_FONT = `12px ${SANS_STACK}`;
const BYLINE_LH = 18;
const SUMMARY_FONT = `18px ${SERIF_STACK}`;
const SUMMARY_LH = 28;

const composeByline = (meta: ArticleMeta): string => {
  const parts: string[] = [];
  if (meta.author) {
    parts.push(`By ${meta.author}`);
  }
  if (meta.consumptionTimeSeconds) {
    const min = Math.round(meta.consumptionTimeSeconds / 60);
    parts.push(`${min} min ${meta.sourceType === 'podcast' ? 'listen' : 'read'}`);
  }
  return parts.join(' · ');
};

/* ── Exports ──────────────────────────────────────────────────── */

export type {
  TextRegion,
  ImageRegion,
  RuleRegion,
  SeparatorRegion,
  Region,
  Page,
  TextElement,
  ImageElement,
  SpacingElement,
  HrElement,
  BodyElement,
  ArticleMeta,
  ArticleContent,
  PagePadding,
  PageConfig,
  PageLayoutFn,
};

export {
  contentWidth,
  colWidth,
  pageHeight,
  elHeight,
  elLines,
  colX,
  MIN_LINES,
  SPACE,
  HERO_HEIGHT,
  HERO_HEIGHT_SMALL,
  titleFontFor,
  SOURCE_FONT,
  SOURCE_LH,
  BYLINE_FONT,
  BYLINE_LH,
  SUMMARY_FONT,
  SUMMARY_LH,
  composeByline,
};
