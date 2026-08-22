/**
 * Magazine Segments
 *
 * Parses markdown article content into typed segments suitable for
 * pretext measurement and paged layout. Each segment is a block-level
 * element (paragraph, heading, blockquote, image, hr) with plain text
 * extracted for measurement and inline markup spans recorded for
 * DOM rendering after line-breaking.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, PhrasingContent, Paragraph, Heading, Blockquote, List, Code } from 'mdast';

/* ── Types ────────────────────────────────────────────────────── */

type InlineSpanKind = 'bold' | 'italic' | 'code' | 'link';

type InlineSpan = {
  kind: InlineSpanKind;
  /** Character offset in the plain text string */
  start: number;
  /** Character offset (exclusive) in the plain text string */
  end: number;
  /** Only for link spans */
  href?: string;
};

type TextSegment = {
  kind: 'paragraph' | 'heading' | 'blockquote';
  /** Plain text with all markup stripped — used for pretext measurement */
  text: string;
  /** Inline formatting spans with character offsets into `text` */
  inlineSpans: InlineSpan[];
  /** Heading level (2–6), only present when kind === 'heading' */
  headingLevel?: number;
  /** Whether this is the first paragraph of the article body */
  isFirstParagraph?: boolean;
};

type ImageSegment = {
  kind: 'image';
  src: string;
  alt: string;
};

type SpacingSegment = {
  kind: 'spacing';
  /** Height in relative units (multiplied by line height during measurement) */
  lines: number;
};

type HrSegment = {
  kind: 'hr';
};

type Segment = TextSegment | ImageSegment | SpacingSegment | HrSegment;

/* ── Parser ───────────────────────────────────────────────────── */

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Extract plain text and inline spans from an array of phrasing (inline) content nodes.
 * Walks the inline tree recursively, building a plain string and recording
 * the character offsets of bold/italic/code/link spans.
 */
const extractInlineContent = (nodes: PhrasingContent[]): { text: string; spans: InlineSpan[] } => {
  let text = '';
  const spans: InlineSpan[] = [];

  const walk = (node: PhrasingContent): void => {
    switch (node.type) {
      case 'text':
        text += node.value;
        break;

      case 'inlineCode':
        spans.push({ kind: 'code', start: text.length, end: text.length + node.value.length });
        text += node.value;
        break;

      case 'strong': {
        const start = text.length;
        for (const child of node.children) {
          walk(child);
        }
        spans.push({ kind: 'bold', start, end: text.length });
        break;
      }

      case 'emphasis': {
        const start = text.length;
        for (const child of node.children) {
          walk(child);
        }
        spans.push({ kind: 'italic', start, end: text.length });
        break;
      }

      case 'link': {
        const start = text.length;
        for (const child of node.children) {
          walk(child);
        }
        spans.push({ kind: 'link', start, end: text.length, href: node.url });
        break;
      }

      case 'delete': {
        // Strikethrough — render as plain text (no special styling in magazine)
        for (const child of node.children) {
          walk(child);
        }
        break;
      }

      case 'break':
        text += '\n';
        break;

      case 'html':
        // Inline HTML — skip in magazine layout
        break;

      default:
        // footnoteReference, imageReference, linkReference, etc. — skip
        break;
    }
  };

  for (const node of nodes) {
    walk(node);
  }
  return { text, spans };
};

/* ── Block handlers ───────────────────────────────────────────── */

type BuilderState = {
  segments: Segment[];
  paragraphIndex: number;
};

const addSpacing = (segments: Segment[], lines: number): void => {
  // Merge consecutive spacing segments
  const last = segments.at(-1);
  if (last?.kind === 'spacing') {
    last.lines += lines;
    return;
  }
  segments.push({ kind: 'spacing', lines });
};

/** Add spacing only when segments already exist (never lead with spacing). */
const spacingBefore = (segments: Segment[], lines: number): void => {
  if (segments.length > 0) {
    addSpacing(segments, lines);
  }
};

const appendParagraph = (state: BuilderState, node: Paragraph): void => {
  const { segments } = state;
  spacingBefore(segments, 0.75);
  const { text, spans } = extractInlineContent(node.children);
  if (text.trim()) {
    const isFirst = state.paragraphIndex === 0;
    state.paragraphIndex++;
    segments.push({
      kind: 'paragraph',
      text,
      inlineSpans: spans,
      isFirstParagraph: isFirst || undefined,
    });
  }
};

const appendHeading = (segments: Segment[], node: Heading): void => {
  spacingBefore(segments, 1.5);
  const { text, spans } = extractInlineContent(node.children);
  if (text.trim()) {
    segments.push({
      kind: 'heading',
      text,
      inlineSpans: spans,
      headingLevel: node.depth,
    });
    addSpacing(segments, 0.5);
  }
};

const appendBlockquote = (segments: Segment[], node: Blockquote): void => {
  spacingBefore(segments, 1);
  // Flatten blockquote children into a single text block
  const parts: string[] = [];
  const spans: InlineSpan[] = [];
  let offset = 0;
  for (const child of node.children) {
    if (child.type === 'paragraph') {
      if (parts.length > 0) {
        parts.push(' ');
        offset += 1;
      }
      const result = extractInlineContent(child.children);
      // Shift span offsets by current position
      for (const span of result.spans) {
        spans.push({
          ...span,
          start: span.start + offset,
          end: span.end + offset,
        });
      }
      parts.push(result.text);
      offset += result.text.length;
    }
  }
  const text = parts.join('');
  if (text.trim()) {
    segments.push({ kind: 'blockquote', text, inlineSpans: spans });
    addSpacing(segments, 1);
  }
};

const appendList = (segments: Segment[], node: List): void => {
  // Flatten list items into paragraphs with bullet/number prefix
  spacingBefore(segments, 0.75);
  node.children.forEach((item: { children: RootContent[] }, idx: number) => {
    if (idx > 0) {
      addSpacing(segments, 0.25);
    }
    const prefix = node.ordered ? `${(node.start ?? 1) + idx}. ` : '• ';
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        const { text, spans } = extractInlineContent(child.children);
        const fullText = prefix + text;
        // Shift all spans by prefix length
        const shifted = spans.map((s) => ({
          ...s,
          start: s.start + prefix.length,
          end: s.end + prefix.length,
        }));
        segments.push({ kind: 'paragraph', text: fullText, inlineSpans: shifted });
      }
    }
  });
  addSpacing(segments, 0.75);
};

const appendCode = (segments: Segment[], node: Code): void => {
  // Code blocks — treat as a paragraph with code styling
  spacingBefore(segments, 0.75);
  const text = node.value;
  if (text.trim()) {
    segments.push({
      kind: 'paragraph',
      text,
      inlineSpans: [{ kind: 'code', start: 0, end: text.length }],
    });
  }
  addSpacing(segments, 0.75);
};

const processBlock = (state: BuilderState, node: RootContent): void => {
  switch (node.type) {
    case 'paragraph':
      appendParagraph(state, node);
      break;
    case 'heading':
      appendHeading(state.segments, node);
      break;
    case 'blockquote':
      appendBlockquote(state.segments, node);
      break;
    case 'image':
      spacingBefore(state.segments, 0.75);
      state.segments.push({ kind: 'image', src: node.url, alt: node.alt ?? '' });
      addSpacing(state.segments, 0.75);
      break;
    case 'thematicBreak':
      spacingBefore(state.segments, 0.5);
      state.segments.push({ kind: 'hr' });
      addSpacing(state.segments, 0.5);
      break;
    case 'list':
      appendList(state.segments, node);
      break;
    case 'code':
      appendCode(state.segments, node);
      break;
    case 'html':
    case 'definition':
    case 'footnoteDefinition':
      // Skip non-visual block elements
      break;
    default:
      // table, etc. — skip for now
      break;
  }
};

/**
 * Parse a markdown string into a flat array of layout segments.
 * Block-level elements become individual segments; inline formatting
 * is recorded as spans with character offsets for post-line-break rendering.
 */
const parseSegments = (markdown: string): Segment[] => {
  const tree = parser.parse(markdown) as Root;
  const state: BuilderState = { segments: [], paragraphIndex: 0 };

  for (const node of tree.children) {
    processBlock(state, node);
  }

  // Trim leading/trailing spacing
  const { segments } = state;
  while (segments.at(0)?.kind === 'spacing') {
    segments.shift();
  }
  while (segments.at(-1)?.kind === 'spacing') {
    segments.pop();
  }

  return segments;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Segment, TextSegment, ImageSegment, SpacingSegment, HrSegment, InlineSpan, InlineSpanKind };
export { parseSegments };
