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
 *
 * Types and geometry live in paged-article.model.ts; text placement and
 * column flow live in paged-article.flow.ts. Both are re-exported here.
 */

import type { ArticleMeta, BodyElement, PageConfig, PageLayoutFn, PagePadding, Region } from './paged-article.model.ts';
import {
  BYLINE_FONT,
  BYLINE_LH,
  composeByline,
  contentWidth,
  HERO_HEIGHT,
  HERO_HEIGHT_SMALL,
  SOURCE_FONT,
  SOURCE_LH,
  SPACE,
  SUMMARY_FONT,
  SUMMARY_LH,
  titleFontFor,
} from './paged-article.model.ts';
import { flowIntoColumns, flowTextAroundObstacle, placeDropCapParagraph, placeText } from './paged-article.flow.ts';

/* ── Opener body flow (drop cap + columns) ────────────────────── */

type OpenerBodyArgs = {
  elements: BodyElement[];
  regions: Region[];
  y: number;
  cw: number;
  config: PageConfig;
};

/**
 * Full-width first paragraph with drop cap, section gap, then column
 * body flow. Pushes regions in place; returns unconsumed elements.
 */
const flowOpenerBody = ({ elements, regions, y, cw, config }: OpenerBodyArgs): BodyElement[] => {
  let bodyElements = elements;
  let curY = y;

  const firstEl = bodyElements[0];
  if (firstEl && firstEl.kind === 'text' && firstEl.variant === 'paragraph') {
    const dc = placeDropCapParagraph(firstEl, 0, curY, cw);
    regions.push(...dc.regions);
    curY += dc.height;
    bodyElements = bodyElements.slice(1);
  }

  // Section gap before columns
  curY += SPACE.columns;

  const { regions: bodyRegions, remaining } = flowIntoColumns(bodyElements, curY, config);
  regions.push(...bodyRegions);
  return remaining;
};

/* ── Feature opener ───────────────────────────────────────────── */

/** Desktop feature header: hero floated right, text flows beside it. */
const featureHeaderWithHero = (meta: ArticleMeta, heroImage: string, cw: number): { regions: Region[]; y: number } => {
  const regions: Region[] = [];
  let y = 0;

  const heroW = Math.round(cw * 0.45);
  const heroH = HERO_HEIGHT;
  const heroX = cw - heroW;
  const textW = heroX - SPACE.element * 2;
  const heroSpanLines = Math.ceil(heroH / 42); // ~lines of title text the hero spans

  regions.push({
    kind: 'image',
    x: heroX,
    y,
    width: heroW,
    height: heroH,
    src: heroImage,
    alt: '',
    rounded: true,
  });

  // Source
  const src = placeText({
    text: meta.sourceName.toUpperCase(),
    font: SOURCE_FONT,
    lineHeight: SOURCE_LH,
    maxWidth: textW,
    x: 0,
    y,
    role: 'source',
  });
  regions.push(src.region);
  y += src.height + SPACE.tight;

  // Title — measured at narrow width beside the hero
  const tf = titleFontFor('feature');
  const titleResult = flowTextAroundObstacle({
    text: meta.title,
    font: tf.font,
    lineHeight: tf.lineHeight,
    inlineSpans: [],
    fullWidth: cw,
    narrowWidth: textW,
    narrowX: 0,
    fullX: 0,
    y,
    obstacleSpan: heroSpanLines,
    role: 'title',
  });
  regions.push(...titleResult.regions);
  y += titleResult.height + SPACE.after_title;

  // Summary
  if (meta.summary) {
    const sumW = Math.min(textW, 600);
    const summary = placeText({
      text: meta.summary,
      font: SUMMARY_FONT,
      lineHeight: SUMMARY_LH,
      maxWidth: sumW,
      x: 0,
      y,
      role: 'summary',
    });
    regions.push(summary.region);
    y += summary.height + SPACE.element;
  }

  // Byline
  const byline = placeText({
    text: composeByline(meta),
    font: BYLINE_FONT,
    lineHeight: BYLINE_LH,
    maxWidth: textW,
    x: 0,
    y,
    role: 'byline',
  });
  regions.push(byline.region);
  y += byline.height + SPACE.element;

  // Ensure y is past the hero
  const heroBottom = heroH + SPACE.section;
  if (y < heroBottom) {
    y = heroBottom;
  }

  return { regions, y };
};

/** Mobile / no-hero feature header: stacked vertically. */
const featureHeaderStacked = (meta: ArticleMeta, cw: number): { regions: Region[]; y: number } => {
  const regions: Region[] = [];
  let y = 0;

  if (meta.heroImage) {
    regions.push({
      kind: 'image',
      x: 0,
      y,
      width: cw,
      height: HERO_HEIGHT_SMALL,
      src: meta.heroImage,
      alt: '',
      rounded: true,
    });
    y += HERO_HEIGHT_SMALL + SPACE.section;
  }

  const src = placeText({
    text: meta.sourceName.toUpperCase(),
    font: SOURCE_FONT,
    lineHeight: SOURCE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'source',
  });
  regions.push(src.region);
  y += src.height + SPACE.tight;

  const tf = titleFontFor('feature');
  const title = placeText({
    text: meta.title,
    font: tf.font,
    lineHeight: tf.lineHeight,
    maxWidth: cw,
    x: 0,
    y,
    role: 'title',
  });
  regions.push(title.region);
  y += title.height + SPACE.after_title;

  if (meta.summary) {
    const summary = placeText({
      text: meta.summary,
      font: SUMMARY_FONT,
      lineHeight: SUMMARY_LH,
      maxWidth: cw,
      x: 0,
      y,
      role: 'summary',
    });
    regions.push(summary.region);
    y += summary.height + SPACE.element;
  }

  const byline = placeText({
    text: composeByline(meta),
    font: BYLINE_FONT,
    lineHeight: BYLINE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'byline',
  });
  regions.push(byline.region);
  y += byline.height + SPACE.element;

  return { regions, y };
};

/**
 * Feature front page. On desktop:
 *   hero image floated right, source/title/summary/byline flow beside it,
 *   then a rule, full-width drop-cap intro, section gap, two-column body.
 * On mobile: stacked vertically, single column.
 */
const featureOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) {
    return bodyLayout(content, config);
  }

  const cw = contentWidth(config);
  const multiCol = config.columns >= 2;

  const header =
    multiCol && meta.heroImage ? featureHeaderWithHero(meta, meta.heroImage, cw) : featureHeaderStacked(meta, cw);
  const regions: Region[] = [...header.regions];
  let y = header.y;

  // Accent rule
  regions.push({ kind: 'rule', x: 0, y, width: 64, accent: true });
  y += 1 + SPACE.section;

  const remaining = flowOpenerBody({ elements: content.elements, regions, y, cw, config });

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Standard opener ──────────────────────────────────────────── */

const standardOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) {
    return bodyLayout(content, config);
  }

  const cw = contentWidth(config);
  const regions: Region[] = [];
  let y = 0;

  const src = placeText({
    text: meta.sourceName,
    font: SOURCE_FONT,
    lineHeight: SOURCE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'source',
  });
  regions.push(src.region);
  y += src.height + SPACE.tight;

  const tf = titleFontFor('standard');
  const title = placeText({
    text: meta.title,
    font: tf.font,
    lineHeight: tf.lineHeight,
    maxWidth: cw,
    x: 0,
    y,
    role: 'title',
  });
  regions.push(title.region);
  y += title.height + SPACE.after_title;

  const byline = placeText({
    text: composeByline(meta),
    font: BYLINE_FONT,
    lineHeight: BYLINE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'byline',
  });
  regions.push(byline.region);
  y += byline.height + SPACE.element;

  if (meta.heroImage) {
    regions.push({
      kind: 'image',
      x: 0,
      y,
      width: cw,
      height: HERO_HEIGHT_SMALL,
      src: meta.heroImage,
      alt: '',
      rounded: true,
    });
    y += HERO_HEIGHT_SMALL + SPACE.section;
  }

  regions.push({ kind: 'rule', x: 0, y, width: 48 });
  y += 1 + SPACE.section;

  const remaining = flowOpenerBody({ elements: content.elements, regions, y, cw, config });

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Minimal opener ───────────────────────────────────────────── */

const minimalOpener: PageLayoutFn = (content, config) => {
  const meta = content.meta;
  if (!meta) {
    return bodyLayout(content, config);
  }

  const cw = contentWidth(config);
  const regions: Region[] = [];
  let y = 0;

  regions.push({ kind: 'rule', x: 0, y, width: 32 });
  y += 1 + SPACE.element;

  const src = placeText({
    text: meta.sourceName,
    font: SOURCE_FONT,
    lineHeight: SOURCE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'source',
  });
  regions.push(src.region);
  y += src.height + SPACE.tight;

  const tf = titleFontFor('minimal');
  const title = placeText({
    text: meta.title,
    font: tf.font,
    lineHeight: tf.lineHeight,
    maxWidth: cw,
    x: 0,
    y,
    role: 'title',
  });
  regions.push(title.region);
  y += title.height + SPACE.after_title;

  const byline = placeText({
    text: composeByline(meta),
    font: BYLINE_FONT,
    lineHeight: BYLINE_LH,
    maxWidth: cw,
    x: 0,
    y,
    role: 'byline',
  });
  regions.push(byline.region);
  y += byline.height + SPACE.section;

  const { regions: bodyRegions, remaining } = flowIntoColumns(content.elements, y, config);
  regions.push(...bodyRegions);

  return { page: { regions }, remaining: { meta: null, elements: remaining } };
};

/* ── Opener factory ───────────────────────────────────────────── */

const openerLayout = (style: 'feature' | 'standard' | 'minimal' = 'standard'): PageLayoutFn => {
  switch (style) {
    case 'feature':
      return featureOpener;
    case 'standard':
      return standardOpener;
    case 'minimal':
      return minimalOpener;
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
} from './paged-article.model.ts';

export { elHeight, elLines, contentWidth, colWidth, pageHeight, HERO_HEIGHT } from './paged-article.model.ts';
export { flowIntoColumns } from './paged-article.flow.ts';

export { openerLayout, bodyLayout, NAV_HEIGHT, desktopPadding, tabletPadding, mobilePadding, desktopColumnGap };
