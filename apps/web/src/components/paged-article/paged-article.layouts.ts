/**
 * Paged Article — Layouts
 *
 * Pure typesetter model. Every element on the page is positioned at
 * exact coordinates. pretext measures all text; layoutNextLine enables
 * text to flow around obstacles (drop caps, floated images).
 *
 * Region types: text, image, rule, separator (column divider).
 *
 * Layout functions compose pages like a magazine designer:
 * - featureOpener: hero floated right, text flows around it, full-width
 *   drop-cap intro, then two-column body with column separator
 * - standardOpener: title → byline → image → drop-cap intro → columns
 * - minimalOpener: compact title block → columns
 * - bodyLayout: continues body text in columns
 */

import { layoutWithLines, layoutNextLine, type LayoutCursor } from '@chenglou/pretext';
import type { LayoutLine, PreparedTextWithSegments } from '@chenglou/pretext';
import type { InlineSpan } from './paged-article.segments.ts';
import { getPrepared, SERIF_STACK, SANS_STACK, MONO_STACK } from './paged-article.measure.ts';

/* ── Regions ──────────────────────────────────────────────────── */

type TextRegion = {
  kind: 'text';
  x: number; y: number; width: number;
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
  x: number; y: number; width: number; height: number;
  src: string;
  alt: string;
  rounded?: boolean;
};

type RuleRegion = {
  kind: 'rule';
  x: number; y: number; width: number;
  accent?: boolean;
};

type SeparatorRegion = {
  kind: 'separator';
  x: number; y: number; height: number;
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

type PageLayoutFn = (
  content: ArticleContent,
  config: PageConfig,
) => { page: Page; remaining: ArticleContent };

/* ── Helpers ──────────────────────────────────────────────────── */

const contentWidth = (config: PageConfig): number =>
  config.width - config.padding.horizontal * 2;

const colWidth = (config: PageConfig): number => {
  const w = contentWidth(config);
  return config.columns === 2 ? (w - config.columnGap) / 2 : w;
};

const pageHeight = (config: PageConfig): number =>
  config.height - config.padding.top - config.padding.bottom - config.navHeight - config.footerHeight;

const elHeight = (el: BodyElement): number =>
  el.kind === 'text' ? (el.endLine - el.startLine) * el.lineHeight : el.height;

const elLines = (el: TextElement): number => el.endLine - el.startLine;

const colX = (col: number, w: number, gap: number): number =>
  col === 0 ? 0 : w + gap;

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
    case 'feature':  return { font: `600 36px ${SERIF_STACK}`, lineHeight: 42 };
    case 'standard': return { font: `500 28px ${SERIF_STACK}`, lineHeight: 34 };
    case 'minimal':  return { font: `500 24px ${SERIF_STACK}`, lineHeight: 30 };
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
  if (meta.author) parts.push(`By ${meta.author}`);
  if (meta.consumptionTimeSeconds) {
    const min = Math.round(meta.consumptionTimeSeconds / 60);
    parts.push(`${min} min ${meta.sourceType === 'podcast' ? 'listen' : 'read'}`);
  }
  return parts.join(' \u00b7 ');
};

/* ── Place a text block ───────────────────────────────────────── */

const placeText = (
  text: string, font: string, lineHeight: number,
  maxWidth: number, x: number, y: number,
  role: TextRegion['role'], inlineSpans: InlineSpan[] = [],
): { region: TextRegion; height: number } => {
  const prepared = getPrepared(text, font);
  const result = layoutWithLines(prepared, maxWidth, lineHeight);
  return {
    region: {
      kind: 'text', x, y, width: maxWidth,
      text, inlineSpans, allLines: result.lines,
      font, lineHeight, startLine: 0, endLine: result.lineCount, role,
    },
    height: result.height,
  };
};

/* ── Flow text around an obstacle ─────────────────────────────── */

/**
 * Re-measure text with variable-width lines to flow around an obstacle.
 * Lines within obstacleSpan use narrowWidth; remaining use fullWidth.
 * Returns regions for narrow + full portions and total height.
 */
const flowTextAroundObstacle = (
  text: string,
  font: string,
  lineHeight: number,
  inlineSpans: InlineSpan[],
  fullWidth: number,
  narrowWidth: number,
  narrowX: number,
  fullX: number,
  y: number,
  obstacleSpan: number,
  role: TextRegion['role'],
): { regions: TextRegion[]; height: number } => {
  const prepared = getPrepared(text, font);
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 };
  const allLines: LayoutLine[] = [];

  while (true) {
    const w = allLines.length < obstacleSpan ? narrowWidth : fullWidth;
    const line = layoutNextLine(prepared, cursor, w);
    if (line === null) break;
    allLines.push(line);
    cursor = line.end;
  }

  const regions: TextRegion[] = [];
  const narrowCount = Math.min(obstacleSpan, allLines.length);

  if (narrowCount > 0) {
    regions.push({
      kind: 'text', x: narrowX, y, width: narrowWidth,
      text, inlineSpans, allLines, font, lineHeight,
      startLine: 0, endLine: narrowCount, role,
    });
  }

  if (allLines.length > narrowCount) {
    regions.push({
      kind: 'text', x: fullX, y: y + narrowCount * lineHeight, width: fullWidth,
      text, inlineSpans, allLines, font, lineHeight,
      startLine: narrowCount, endLine: allLines.length, role,
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
  el: TextElement, x: number, y: number, fullWidth: number,
): { regions: Region[]; height: number } => {
  const firstChar = el.text[0];
  if (!firstChar || !/[A-Za-z\u00C0-\u024F]/.test(firstChar)) {
    const t = placeText(el.text, el.font, el.lineHeight, fullWidth, x, y, 'body', el.inlineSpans);
    return { regions: [t.region], height: t.height };
  }

  const regions: Region[] = [];

  // Measure drop cap
  const dcPrepared = getPrepared(firstChar, DROP_CAP_FONT);
  const dcLayout = layoutWithLines(dcPrepared, fullWidth, DROP_CAP_LH);
  const dcW = Math.ceil(dcLayout.lines[0]?.width ?? 24) + DROP_CAP_GAP;

  regions.push({
    kind: 'text', x, y: y + 4, width: dcW,
    text: firstChar, inlineSpans: [],
    allLines: dcLayout.lines, font: DROP_CAP_FONT, lineHeight: DROP_CAP_LH,
    startLine: 0, endLine: 1, role: 'dropcap',
  });

  // Body text without first char, flowing around drop cap
  const bodyText = el.text.slice(1);
  const bodySpans = el.inlineSpans
    .map((s) => ({ ...s, start: s.start - 1, end: s.end - 1 }))
    .filter((s) => s.end > 0)
    .map((s) => ({ ...s, start: Math.max(0, s.start) }));

  const flow = flowTextAroundObstacle(
    bodyText, el.font, el.lineHeight, bodySpans,
    fullWidth, fullWidth - dcW, x + dcW, x, y, DROP_CAP_SPAN, 'body',
  );
  regions.push(...flow.regions);

  return { regions, height: flow.height };
};

/* ── Column separator ─────────────────────────────────────────── */

const addColumnSeparator = (regions: Region[], startY: number, config: PageConfig): void => {
  if (config.columns < 2) return;
  const w = colWidth(config);
  const sepX = w + config.columnGap / 2;
  const sepHeight = pageHeight(config) - startY;
  if (sepHeight > 0) {
    regions.push({ kind: 'separator', x: sepX, y: startY, height: sepHeight });
  }
};

/* ── Flow body elements into columns ──────────────────────────── */

const flowIntoColumns = (
  elements: BodyElement[],
  startY: number,
  config: PageConfig,
): { regions: Region[]; remaining: BodyElement[] } => {
  const w = colWidth(config);
  const maxY = pageHeight(config);
  const regions: Region[] = [];

  let remaining = elements;
  let col = 0;
  let y = startY;

  const space = (): number => maxY - y;

  const tryNextCol = (): boolean => {
    if (col < config.columns - 1) {
      col++;
      y = startY;
      return true;
    }
    return false;
  };

  const bodyRole = (el: TextElement): 'heading' | 'blockquote' | 'body' =>
    el.variant === 'heading' ? 'heading' : el.variant === 'blockquote' ? 'blockquote' : 'body';

  while (remaining.length > 0) {
    const el = remaining[0]!;
    const h = elHeight(el);

    if (el.kind === 'spacing') {
      if (y > startY) y += h;
      remaining = remaining.slice(1);
      continue;
    }

    if (el.kind === 'text' && el.variant === 'heading') {
      // Look past spacing to find the next text element
      let neededAfter = 0;
      for (let i = 1; i < remaining.length; i++) {
        const peek = remaining[i]!;
        if (peek.kind === 'spacing') {
          neededAfter += peek.height;
          continue;
        }
        if (peek.kind === 'text') {
          neededAfter += Math.min(MIN_LINES, elLines(peek)) * peek.lineHeight;
        }
        break;
      }
      if (h + neededAfter > space()) {
        if (!tryNextCol()) break;
        continue;
      }
    }

    if (h <= space()) {
      const rx = colX(col, w, config.columnGap);
      if (el.kind === 'text') {
        regions.push({
          kind: 'text', x: rx, y, width: w,
          text: el.text, inlineSpans: el.inlineSpans,
          allLines: el.allLines, font: el.font, lineHeight: el.lineHeight,
          startLine: el.startLine, endLine: el.endLine, role: bodyRole(el),
        });
      } else if (el.kind === 'image') {
        regions.push({ kind: 'image', x: rx, y, width: w, height: el.height, src: el.src, alt: el.alt, rounded: true });
      } else if (el.kind === 'hr') {
        regions.push({ kind: 'rule', x: rx, y, width: 48 });
      }
      y += h;
      remaining = remaining.slice(1);
      continue;
    }

    if (el.kind === 'text') {
      const linesAvail = Math.floor(space() / el.lineHeight);
      if (linesAvail < MIN_LINES) { if (!tryNextCol()) break; continue; }

      const total = elLines(el);
      const linesLeft = total - linesAvail;
      let toPlace = linesAvail;
      if (linesLeft > 0 && linesLeft < MIN_LINES) {
        toPlace = total - MIN_LINES;
        if (toPlace < MIN_LINES) { if (!tryNextCol()) break; continue; }
      }

      const rx = colX(col, w, config.columnGap);
      regions.push({
        kind: 'text', x: rx, y, width: w,
        text: el.text, inlineSpans: el.inlineSpans,
        allLines: el.allLines, font: el.font, lineHeight: el.lineHeight,
        startLine: el.startLine, endLine: el.startLine + toPlace, role: bodyRole(el),
      });

      remaining = [{ ...el, startLine: el.startLine + toPlace, isFirstParagraph: undefined }, ...remaining.slice(1)];
      if (!tryNextCol()) break;
      continue;
    }

    if (!tryNextCol()) break;
  }

  // Column separator
  addColumnSeparator(regions, startY, config);

  return { regions, remaining };
};

/* ── Feature opener ───────────────────────────────────────────── */

/**
 * Feature front page. On desktop:
 *   hero image floated right, source/title/summary/byline flow beside it,
 *   then a rule, full-width drop-cap intro, section gap, two-column body.
 * On mobile: stacked vertically, single column.
 */
const featureOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) return bodyLayout(content, config);

  const cw = contentWidth(config);
  const regions: Region[] = [];
  let y = 0;
  const multiCol = config.columns >= 2;

  if (multiCol && meta.heroImage) {
    // ── Desktop: hero floated right, text flows beside it ──
    const heroW = Math.round(cw * 0.45);
    const heroH = HERO_HEIGHT;
    const heroX = cw - heroW;
    const textW = heroX - SPACE.element * 2;
    const heroSpanLines = Math.ceil(heroH / 42); // ~lines of title text the hero spans

    regions.push({
      kind: 'image', x: heroX, y, width: heroW, height: heroH,
      src: meta.heroImage, alt: '', rounded: true,
    });

    // Source
    const src = placeText(meta.sourceName.toUpperCase(), SOURCE_FONT, SOURCE_LH, textW, 0, y, 'source');
    regions.push(src.region);
    y += src.height + SPACE.tight;

    // Title — measured at narrow width beside the hero
    const tf = titleFontFor('feature');
    const titleResult = flowTextAroundObstacle(
      meta.title, tf.font, tf.lineHeight, [],
      cw, textW, 0, 0, y, heroSpanLines, 'title',
    );
    regions.push(...titleResult.regions);
    y += titleResult.height + SPACE.after_title;

    // Summary
    if (meta.summary) {
      const sumW = Math.min(textW, 600);
      const summary = placeText(meta.summary, SUMMARY_FONT, SUMMARY_LH, sumW, 0, y, 'summary');
      regions.push(summary.region);
      y += summary.height + SPACE.element;
    }

    // Byline
    const byline = placeText(composeByline(meta), BYLINE_FONT, BYLINE_LH, textW, 0, y, 'byline');
    regions.push(byline.region);
    y += byline.height + SPACE.element;

    // Ensure y is past the hero
    const heroBottom = heroH + SPACE.section;
    if (y < heroBottom) y = heroBottom;

  } else {
    // ── Mobile / no hero: stacked ──
    if (meta.heroImage) {
      regions.push({
        kind: 'image', x: 0, y, width: cw, height: HERO_HEIGHT_SMALL,
        src: meta.heroImage, alt: '', rounded: true,
      });
      y += HERO_HEIGHT_SMALL + SPACE.section;
    }

    const src = placeText(meta.sourceName.toUpperCase(), SOURCE_FONT, SOURCE_LH, cw, 0, y, 'source');
    regions.push(src.region);
    y += src.height + SPACE.tight;

    const tf = titleFontFor('feature');
    const title = placeText(meta.title, tf.font, tf.lineHeight, cw, 0, y, 'title');
    regions.push(title.region);
    y += title.height + SPACE.after_title;

    if (meta.summary) {
      const summary = placeText(meta.summary, SUMMARY_FONT, SUMMARY_LH, cw, 0, y, 'summary');
      regions.push(summary.region);
      y += summary.height + SPACE.element;
    }

    const byline = placeText(composeByline(meta), BYLINE_FONT, BYLINE_LH, cw, 0, y, 'byline');
    regions.push(byline.region);
    y += byline.height + SPACE.element;
  }

  // Accent rule
  regions.push({ kind: 'rule', x: 0, y, width: 64, accent: true });
  y += 1 + SPACE.section;

  // Full-width first paragraph with drop cap
  let bodyElements = content.elements;
  const firstEl = bodyElements[0];
  if (firstEl && firstEl.kind === 'text' && firstEl.variant === 'paragraph') {
    const dc = placeDropCapParagraph(firstEl, 0, y, cw);
    regions.push(...dc.regions);
    y += dc.height;
    bodyElements = bodyElements.slice(1);
  }

  // Section gap before columns
  y += SPACE.columns;

  // Two-column body flow
  const { regions: bodyRegions, remaining } = flowIntoColumns(bodyElements, y, config);
  regions.push(...bodyRegions);

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Standard opener ──────────────────────────────────────────── */

const standardOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) return bodyLayout(content, config);

  const cw = contentWidth(config);
  const regions: Region[] = [];
  let y = 0;

  const src = placeText(meta.sourceName, SOURCE_FONT, SOURCE_LH, cw, 0, y, 'source');
  regions.push(src.region);
  y += src.height + SPACE.tight;

  const tf = titleFontFor('standard');
  const title = placeText(meta.title, tf.font, tf.lineHeight, cw, 0, y, 'title');
  regions.push(title.region);
  y += title.height + SPACE.after_title;

  const byline = placeText(composeByline(meta), BYLINE_FONT, BYLINE_LH, cw, 0, y, 'byline');
  regions.push(byline.region);
  y += byline.height + SPACE.element;

  if (meta.heroImage) {
    regions.push({
      kind: 'image', x: 0, y, width: cw, height: HERO_HEIGHT_SMALL,
      src: meta.heroImage, alt: '', rounded: true,
    });
    y += HERO_HEIGHT_SMALL + SPACE.section;
  }

  regions.push({ kind: 'rule', x: 0, y, width: 48 });
  y += 1 + SPACE.section;

  let bodyElements = content.elements;
  const firstEl = bodyElements[0];
  if (firstEl && firstEl.kind === 'text' && firstEl.variant === 'paragraph') {
    const dc = placeDropCapParagraph(firstEl, 0, y, cw);
    regions.push(...dc.regions);
    y += dc.height;
    bodyElements = bodyElements.slice(1);
  }

  y += SPACE.columns;

  const { regions: bodyRegions, remaining } = flowIntoColumns(bodyElements, y, config);
  regions.push(...bodyRegions);

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Minimal opener ───────────────────────────────────────────── */

const minimalOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) return bodyLayout(content, config);

  const cw = contentWidth(config);
  const regions: Region[] = [];
  let y = 0;

  regions.push({ kind: 'rule', x: 0, y, width: 32 });
  y += 1 + SPACE.element;

  const src = placeText(meta.sourceName, SOURCE_FONT, SOURCE_LH, cw, 0, y, 'source');
  regions.push(src.region);
  y += src.height + SPACE.tight;

  const tf = titleFontFor('minimal');
  const title = placeText(meta.title, tf.font, tf.lineHeight, cw, 0, y, 'title');
  regions.push(title.region);
  y += title.height + SPACE.after_title;

  const byline = placeText(composeByline(meta), BYLINE_FONT, BYLINE_LH, cw, 0, y, 'byline');
  regions.push(byline.region);
  y += byline.height + SPACE.section;

  const { regions: bodyRegions, remaining } = flowIntoColumns(content.elements, y, config);
  regions.push(...bodyRegions);

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Opener factory ───────────────────────────────────────────── */

const openerLayout = (style: 'feature' | 'standard' | 'minimal' = 'standard'): PageLayoutFn => {
  switch (style) {
    case 'feature': return featureOpener;
    case 'standard': return standardOpener;
    case 'minimal': return minimalOpener;
  }
};

/* ── Body page ────────────────────────────────────────────────── */

const bodyLayout: PageLayoutFn = (content, config) => {
  const { regions, remaining } = flowIntoColumns(content.elements, 0, config);
  return { page: { regions }, remaining: { meta: content.meta, elements: remaining } };
};

/* ── Default dimensions ───────────────────────────────────────── */

const NAV_HEIGHT = 56;
const desktopPadding: PagePadding = { top: 48, bottom: 48, horizontal: 80 };
const tabletPadding: PagePadding = { top: 44, bottom: 44, horizontal: 48 };
const mobilePadding: PagePadding = { top: 40, bottom: 40, horizontal: 24 };
const desktopColumnGap = 40;

/* ── Exports ──────────────────────────────────────────────────── */

export type {
  TextRegion, ImageRegion, RuleRegion, SeparatorRegion, Region,
  Page,
  TextElement, ImageElement, SpacingElement, HrElement, BodyElement,
  ArticleMeta, ArticleContent,
  PagePadding, PageConfig, PageLayoutFn,
};

export {
  elHeight, elLines, contentWidth, colWidth, pageHeight,
  flowIntoColumns, openerLayout, bodyLayout,
  HERO_HEIGHT, NAV_HEIGHT,
  desktopPadding, tabletPadding, mobilePadding, desktopColumnGap,
};
