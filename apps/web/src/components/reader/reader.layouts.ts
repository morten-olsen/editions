/**
 * Reader — Page layouts
 *
 * Layout functions compose one page of an article: where the title sits, how
 * wide the hero runs, where the body picks up. They read the same design
 * tokens the rest of the app uses, so a page typeset here and a paragraph
 * rendered in React look like the same publication.
 *
 * The opener carries the article's identity — source, title, summary, byline,
 * hero. Continuation pages carry only prose and a folio, which is what makes
 * turning a page feel like turning a page rather than loading a screen.
 */

import type {
  Content,
  FlowCursor,
  FlowItemResult,
  ImageContent,
  LayoutFn,
  Page,
  Rect,
  TextContent,
} from '@editions/layout-engine';

import { bodyStream, metaItem } from './reader.content.ts';
import { applyRole, inlineRenderer, typeScale, type Role, type TypeScale } from './reader.styles.ts';

/* ── Types ────────────────────────────────────────────────────── */

type PageStyle = {
  scale: TypeScale;
  compact: boolean;
  columns: number;
  gap: number;
  margin: number;
  top: number;
  bottom: number;
  contentWidth: number;
};

type PlaceRuleArgs = {
  page: Page;
  x: number;
  y: number;
  width: number;
  /** Accent-coloured, for the mark under an opener. */
  accent?: boolean;
};

type PlaceTextArgs = {
  page: Page;
  item: TextContent;
  role: Role;
  style: PageStyle;
  x: number;
  width: number;
  y: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/** Two columns need a measure wide enough that neither turns into a gutter. */
const TWO_COLUMN_WIDTH = 660;

/** Room kept at the foot of every page for the folio and the nav. */
const FOOTER_SPACE = 56;

/** Share of the opener the hero may take when it sits beside the title. */
const HERO_SHARE = 0.42;

/** A heading needs this much prose under it or it belongs on the next page. */
const ORPHAN_LINES = 2;

/**
 * Only running prose is justified. A justified headline or byline is mostly
 * gaps — the measure is too short for the spacing to disappear.
 */
const JUSTIFIED_ROLES = new Set<Role>(['body', 'blockquote']);

/* ── Private helpers ──────────────────────────────────────────── */

const pageStyle = (page: Page): PageStyle => {
  const scale = typeScale({ width: page.width, height: page.height });
  const compact = page.width < 520;
  const margin = compact ? 24 : page.width < 760 ? 40 : 56;

  return {
    scale,
    compact,
    margin,
    columns: page.width >= TWO_COLUMN_WIDTH ? 2 : 1,
    gap: compact ? 20 : 32,
    top: compact ? 28 : 40,
    bottom: FOOTER_SPACE,
    contentWidth: page.width - margin * 2,
  };
};

const bodyEnd = (page: Page, style: PageStyle): number => page.height - style.bottom;

/**
 * Place a run of text in a box and report where it ended.
 * Zones already on the page are avoided, so a title set beside a hero wraps
 * around it without anyone measuring the gap.
 */
const placeText = ({ page, item, role, style, x, width, y }: PlaceTextArgs): number => {
  const result = page.flowText(item, {
    columns: 1,
    inset: { left: x, right: page.width - x - width, top: 0, bottom: 0 },
    startY: y,
    endY: page.height,
    setup: (el) => applyRole(el, role, style.scale),
    inlineRenderer,
    justify: JUSTIFIED_ROLES.has(role),
  });

  return result.lineCount > 0 ? result.lastY : y;
};

/** A hairline rule, the one the article presets already use. */
const placeRule = ({ page, x, y, width, accent = false }: PlaceRuleArgs): void => {
  const rule = document.createElement('div');
  rule.className = accent ? 'bg-accent' : 'bg-border';
  rule.style.position = 'absolute';
  rule.style.left = `${x}px`;
  rule.style.top = `${y}px`;
  rule.style.width = `${width}px`;
  rule.style.height = '1px';
  page.el.appendChild(rule);
};

/** The hero: beside the title on a roomy page, above it on a narrow one. */
const placeHero = (
  page: Page,
  style: PageStyle,
  hero: ImageContent,
  y: number,
): { textX: number; textWidth: number; nextY: number } => {
  const full = { textX: style.margin, textWidth: style.contentWidth, nextY: y };

  if (style.compact || style.columns === 1) {
    const height = Math.min(style.contentWidth / hero.aspect, page.height * 0.26);
    const el = page.place(hero, { x: style.margin, y, width: style.contentWidth, height }, { bottom: 20 });
    el.className = 'object-cover rounded-lg';
    return { ...full, nextY: y + height + 20 };
  }

  const width = Math.round(style.contentWidth * HERO_SHARE);
  const height = Math.min(width / hero.aspect, page.height * 0.3);
  const x = style.margin + style.contentWidth - width;
  const el = page.place(hero, { x, y, width, height }, { left: 24, bottom: 20 });
  el.className = 'object-cover rounded-lg';

  return { textX: style.margin, textWidth: style.contentWidth, nextY: y };
};

/** How the body stream renders — shared by the opener and continuation pages. */
const bodyRenderer =
  (page: Page, style: PageStyle) =>
  (item: Content, cursor: FlowCursor): FlowItemResult => {
    if (item.type === 'text') {
      if (item.role === 'rule') {
        return {
          type: 'block',
          height: 1,
          padding: 16,
          render: (el) => {
            el.className = 'bg-border';
          },
        };
      }

      const role: Role =
        item.role === 'heading' || item.role === 'subheading' || item.role === 'blockquote' || item.role === 'code'
          ? item.role
          : 'body';

      // Don't strand a heading at the foot of a column.
      if (role === 'heading' || role === 'subheading') {
        const needed = style.scale[role].leading + style.scale.body.leading * ORPHAN_LINES;
        if (cursor.remaining < needed) {
          return { type: 'defer' };
        }
      }

      const set = role === 'body' ? 0 : Math.round(style.scale.body.leading * 0.75);

      return {
        type: 'text',
        justify: JUSTIFIED_ROLES.has(role),
        // Headings sit closer to what follows than to what precedes; quotes
        // and code need air on both sides.
        spaceBefore: set,
        spaceAfter: role === 'heading' || role === 'subheading' ? 0 : set,
        setup: (el) => {
          applyRole(el, role, style.scale);
          if (role === 'blockquote') {
            el.style.paddingLeft = '16px';
            el.style.borderLeft = '2px solid var(--color-accent)';
          }
        },
        inlineRenderer,
      };
    }

    if (item.type === 'image') {
      return figureBlock(page, style, item, cursor);
    }

    return { type: 'skip' };
  };

const figureBlock = (page: Page, style: PageStyle, item: ImageContent, cursor: FlowCursor): FlowItemResult => {
  const width = cursor.columnWidth;
  const imageHeight = Math.min(width / item.aspect, page.height * 0.32);
  const captionHeight = item.caption
    ? page.measureText(item.caption, width, (el) => applyRole(el, 'caption', style.scale)).height + 8
    : 0;

  return {
    type: 'block',
    height: imageHeight + captionHeight,
    padding: 16,
    render: (el: HTMLDivElement, rect: Rect) => {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption ?? '';
      img.draggable = false;
      img.className = 'w-full object-cover rounded-lg bg-surface-sunken';
      img.style.height = `${imageHeight}px`;
      el.appendChild(img);

      if (item.caption) {
        const caption = document.createElement('div');
        applyRole(caption, 'caption', style.scale);
        caption.style.marginTop = '8px';
        caption.style.width = `${rect.width}px`;
        caption.textContent = item.caption;
        el.appendChild(caption);
      }
    },
  };
};

/* ── Public functions ─────────────────────────────────────────── */

/**
 * The first page of an article: everything that identifies it, then as much
 * prose as the page will hold.
 */
const openerLayout: LayoutFn = (items, page) => {
  const style = pageStyle(page);
  const hero = items.find((item): item is ImageContent => item.type === 'image' && item.role === 'hero');

  let y = style.top;
  let textX = style.margin;
  let textWidth = style.contentWidth;

  if (hero) {
    const placed = placeHero(page, style, hero, y);
    textX = placed.textX;
    textWidth = placed.textWidth;
    y = placed.nextY;
  }

  const source = metaItem(items, 'source');
  if (source) {
    y = placeText({ page, item: source, role: 'source', style, x: textX, width: textWidth, y }) + 10;
  }

  const title = metaItem(items, 'title');
  if (title) {
    y = placeText({ page, item: title, role: 'title', style, x: textX, width: textWidth, y }) + 14;
  }

  const summary = metaItem(items, 'summary');
  if (summary) {
    y = placeText({ page, item: summary, role: 'summary', style, x: textX, width: textWidth, y }) + 12;
  }

  const byline = metaItem(items, 'byline');
  if (byline) {
    y = placeText({ page, item: byline, role: 'byline', style, x: textX, width: textWidth, y }) + 20;
  }

  placeRule({ page, x: style.margin, y, width: 48, accent: true });
  y += 24;

  page.flow(bodyStream(items), {
    columns: style.columns,
    gap: style.gap,
    inset: style.margin,
    startY: y,
    endY: bodyEnd(page, style),
    render: bodyRenderer(page, style),
  });
};

/** A continuation page: prose, and nothing that competes with it. */
const bodyLayout: LayoutFn = (items, page) => {
  const style = pageStyle(page);

  page.flow(bodyStream(items), {
    columns: style.columns,
    gap: style.gap,
    inset: style.margin,
    startY: style.top,
    endY: bodyEnd(page, style),
    render: bodyRenderer(page, style),
  });

  // Metadata and the hero belong to the opener alone.
  for (const item of items) {
    if (item.role === 'hero' || (item.type === 'text' && !bodyStream(items).includes(item))) {
      page.consume(item);
    }
  }
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PageStyle };
export { openerLayout, bodyLayout, pageStyle, placeRule, placeText, FOOTER_SPACE };
