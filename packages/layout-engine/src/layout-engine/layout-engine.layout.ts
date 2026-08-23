/**
 * Layout Engine — Page composition
 *
 * Runs one layout function against one page and reports what it couldn't fit.
 * Pagination is the caller's loop: feed the leftovers to the next layout until
 * nothing remains. That keeps page sequencing (cover, opener, continuation) a
 * design decision rather than something baked into the engine.
 */

import type { Content, LayoutFn, LayoutResult, PageSpec, TextContent } from './layout-engine.types.ts';
import { PageImpl } from './layout-engine.page.ts';

/* ── Types ────────────────────────────────────────────────────── */

type LayoutPageArgs = {
  content: Content[];
  spec: PageSpec;
  layout: LayoutFn;
  /**
   * Where to attach the page while it is being composed. Computed styles only
   * resolve for elements in the document, so layout cannot happen detached.
   * Defaults to a hidden corner of `document.body`.
   */
  mount?: HTMLElement;
};

type PaginateArgs = {
  content: Content[];
  spec: PageSpec;
  /** Applied in order; the last one repeats for every page after it. */
  layouts: LayoutFn[];
  mount?: HTMLElement;
  /** Backstop against a layout that never consumes anything. */
  maxPages?: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/** Matches the separator `mergeText` joins with. */
const SEPARATOR_LENGTH = 1;
const MAX_PAGES = 200;

/* ── Private helpers ──────────────────────────────────────────── */

/**
 * Map a merged text's resume offset back onto the items it was built from.
 * `mergeText` slices each source at its own offset and joins with a blank
 * line, so the arithmetic just retraces that construction.
 */
const distributeMergedOffset = (merged: TextContent, mergedOffset: number): Map<TextContent, number> => {
  const offsets = new Map<TextContent, number>();
  let cursor = 0;

  for (const source of merged.sources ?? []) {
    const start = source.offset ?? 0;
    const length = source.text.length - start;
    if (length <= 0) {
      continue;
    }

    const end = cursor + length;
    if (mergedOffset <= cursor) {
      offsets.set(source, start);
    } else if (mergedOffset < end) {
      offsets.set(source, start + (mergedOffset - cursor));
    }
    cursor = end + SEPARATOR_LENGTH;
  }

  return offsets;
};

const resumeOffsets = (page: PageImpl): Map<TextContent, number> => {
  const offsets = new Map<TextContent, number>();

  for (const [item, offset] of page.textOffsets) {
    if (item.sources === undefined) {
      offsets.set(item, offset);
      continue;
    }
    for (const [source, sourceOffset] of distributeMergedOffset(item, offset)) {
      offsets.set(source, sourceOffset);
    }
  }

  return offsets;
};

const withOffset = (item: TextContent, offset: number): TextContent => ({
  type: 'text',
  role: item.role,
  text: item.text,
  inline: item.inline,
  spans: item.spans,
  offset,
});

const buildRemaining = (content: Content[], page: PageImpl): Content[] => {
  const offsets = resumeOffsets(page);
  const remaining: Content[] = [];

  for (const item of content) {
    if (item.type === 'text') {
      const offset = offsets.get(item);
      if (offset !== undefined) {
        if (offset < item.text.length) {
          remaining.push(withOffset(item, offset));
        }
        continue;
      }
    }

    if (!page.isConsumed(item)) {
      remaining.push(item);
    }
  }

  return remaining;
};

/**
 * How much work the content still represents.
 *
 * Counting items alone would call a page wasted whenever a long paragraph
 * merely advanced its offset — which is exactly what a continuation page does,
 * and pagination would stop after one page.
 */
const remainingWeight = (content: Content[]): number => {
  let weight = content.length;
  for (const item of content) {
    if (item.type === 'text') {
      weight += item.text.length - (item.offset ?? 0);
    }
  }
  return weight;
};

/* ── Public functions ─────────────────────────────────────────── */

/** Compose a single page, returning its element and the content left over. */
const layoutPage = ({ content, spec, layout, mount }: LayoutPageArgs): LayoutResult => {
  const page = new PageImpl(spec.width, spec.height);
  const target = mount ?? document.body;
  const isTemporary = mount === undefined;

  if (isTemporary) {
    page.el.style.visibility = 'hidden';
    page.el.style.position = 'absolute';
    page.el.style.left = '-9999px';
  }
  target.appendChild(page.el);

  layout(content, page);

  if (isTemporary) {
    page.el.style.visibility = '';
    page.el.style.position = 'relative';
    page.el.style.left = '';
    target.removeChild(page.el);
  }

  return { el: page.el, remaining: buildRemaining(content, page), zones: [...page.zones] };
};

/**
 * Compose pages until the content runs out.
 *
 * Layouts are applied in order and the last one repeats, so `[cover, opener,
 * body]` means one cover, one opener, then as many body pages as it takes.
 * A page that consumes nothing ends the run — without that, a layout with no
 * room for its next item would paginate forever.
 */
const paginate = ({ content, spec, layouts, mount, maxPages = MAX_PAGES }: PaginateArgs): LayoutResult[] => {
  if (layouts.length === 0) {
    return [];
  }

  const pages: LayoutResult[] = [];
  let remaining = content;
  let weight = remainingWeight(remaining);

  for (let index = 0; index < maxPages && remaining.length > 0; index++) {
    const layout = layouts[Math.min(index, layouts.length - 1)];
    if (!layout) {
      break;
    }

    const page = layoutPage({ content: remaining, spec, layout, mount });
    const nextWeight = remainingWeight(page.remaining);
    const madeProgress = nextWeight < weight;

    // A page that placed nothing is only worth keeping if it is the first —
    // a cover consumes no body content but is still a page.
    if (madeProgress || index === 0) {
      pages.push(page);
    }

    // Layouts still to come may yet consume something; a repeating layout that
    // placed nothing never will.
    if (!madeProgress && index >= layouts.length - 1) {
      break;
    }

    remaining = page.remaining;
    weight = nextWeight;
  }

  return pages;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { LayoutPageArgs, PaginateArgs };
export { layoutPage, paginate };
