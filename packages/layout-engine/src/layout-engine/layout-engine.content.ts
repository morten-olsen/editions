/**
 * Layout Engine — Content factories
 *
 * Content is pure data: what the page contains, never how it looks. Roles are
 * free-form strings so a design can name its own parts ('deck', 'pullquote',
 * 'standfirst') and layout functions can pick them out.
 */

import type { Content, GroupContent, ImageContent, InlineSpan, TextContent } from './layout-engine.types.ts';

/* ── Types ────────────────────────────────────────────────────── */

type TextOptions = {
  role?: string;
  spans?: InlineSpan[];
  /** Start partway into the text — used when resuming across pages. */
  offset?: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/**
 * A single newline. The flow reads one newline as a paragraph boundary and
 * adds its own spacing, so a blank line would gap twice.
 */
const PARAGRAPH_SEPARATOR = '\n';

/* ── Public functions ─────────────────────────────────────────── */

const text = (value: string, options: TextOptions = {}): TextContent => ({
  type: 'text',
  role: options.role ?? 'body',
  text: value,
  inline: true,
  spans: options.spans,
  offset: options.offset,
});

/** An image that takes its turn in the content stream. */
const image = (src: string, role = 'image', aspect = 16 / 9, caption?: string): ImageContent => ({
  type: 'image',
  role,
  src,
  aspect,
  inline: true,
  caption,
});

/** An image a layout function positions itself, outside the stream. */
const placedImage = (src: string, role: string, aspect = 16 / 9, caption?: string): ImageContent => ({
  type: 'image',
  role,
  src,
  aspect,
  inline: false,
  caption,
});

const group = (children: Content[], role = 'group'): GroupContent => ({
  type: 'group',
  role,
  children,
  inline: true,
});

const placedGroup = (children: Content[], role: string): GroupContent => ({
  type: 'group',
  role,
  children,
  inline: false,
});

/**
 * Join several text items into one so they flow as continuous prose, with a
 * blank line between them. Each item contributes only what it has left, and
 * their inline spans are rebased onto the merged text. When the merge
 * overflows a page, the engine maps the resume point back onto the originals.
 */
const mergeText = (items: TextContent[], role = 'body'): TextContent => {
  const parts: string[] = [];
  const spans: InlineSpan[] = [];
  const sources: TextContent[] = [];
  let offset = 0;

  for (const item of items) {
    const start = item.offset ?? 0;
    const part = item.text.slice(start);
    sources.push(item);
    if (part.length === 0) {
      continue;
    }

    for (const span of item.spans ?? []) {
      if (span.end > start) {
        spans.push({
          ...span,
          start: offset + Math.max(0, span.start - start),
          end: offset + (span.end - start),
        });
      }
    }

    parts.push(part);
    offset += part.length + PARAGRAPH_SEPARATOR.length;
  }

  return {
    type: 'text',
    role,
    text: parts.join(PARAGRAPH_SEPARATOR),
    inline: true,
    spans: spans.length > 0 ? spans : undefined,
    sources,
  };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { TextOptions };
export { text, image, placedImage, group, placedGroup, mergeText };
