/**
 * Paged Article — Segments
 *
 * Parses markdown into typed block-level segments suitable for pretext
 * measurement and paged layout. Each segment carries plain text for
 * measurement and inline markup spans for rendering after line-breaking.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, RootContent, PhrasingContent, Paragraph, Heading, Blockquote, List, Code } from 'mdast';

/* ── Types ────────────────────────────────────────────────────── */

type InlineSpanKind = 'bold' | 'italic' | 'code' | 'link';

type InlineSpan = {
  kind: InlineSpanKind;
  start: number;
  end: number;
  href?: string;
};

type TextSegment = {
  kind: 'paragraph' | 'heading' | 'blockquote';
  text: string;
  inlineSpans: InlineSpan[];
  headingLevel?: number;
  isFirstParagraph?: boolean;
};

type ImageSegment = {
  kind: 'image';
  src: string;
  alt: string;
};

type SpacingSegment = {
  kind: 'spacing';
  lines: number;
};

type HrSegment = {
  kind: 'hr';
};

type Segment = TextSegment | ImageSegment | SpacingSegment | HrSegment;

/* ── Parser ───────────────────────────────────────────────────── */

const parser = unified().use(remarkParse).use(remarkGfm);

/**
 * Extract plain text and inline spans from phrasing content nodes.
 * Walks the inline tree, building a plain string and recording
 * character offsets of bold/italic/code/link spans.
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

      case 'delete':
        for (const child of node.children) {
          walk(child);
        }
        break;

      case 'break':
        text += '\n';
        break;

      case 'html':
      default:
        break;
    }
  };

  for (const node of nodes) {
    walk(node);
  }
  return { text, spans };
};

/* \u2500\u2500 Block handlers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

type BuilderState = {
  segments: Segment[];
  paragraphIndex: number;
};

const addSpacing = (segments: Segment[], lines: number): void => {
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

const appendImage = (segments: Segment[], image: { url: string; alt?: string | null }): void => {
  spacingBefore(segments, 0.75);
  segments.push({ kind: 'image', src: image.url, alt: image.alt ?? '' });
  addSpacing(segments, 0.75);
};

const appendParagraph = (state: BuilderState, node: Paragraph): void => {
  const { segments } = state;
  // Detect image-only paragraphs: promote to block-level image
  const onlyChild = node.children[0];
  if (node.children.length === 1 && onlyChild?.type === 'image') {
    appendImage(segments, onlyChild);
    return;
  }

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
      for (const span of result.spans) {
        spans.push({ ...span, start: span.start + offset, end: span.end + offset });
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
  spacingBefore(segments, 0.75);
  node.children.forEach((item: { children: RootContent[] }, idx: number) => {
    if (idx > 0) {
      addSpacing(segments, 0.25);
    }
    const prefix = node.ordered ? `${(node.start ?? 1) + idx}. ` : '\u2022 ';
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        const { text, spans } = extractInlineContent(child.children);
        const shifted = spans.map((s) => ({
          ...s,
          start: s.start + prefix.length,
          end: s.end + prefix.length,
        }));
        segments.push({ kind: 'paragraph', text: prefix + text, inlineSpans: shifted });
      }
    }
  });
  addSpacing(segments, 0.75);
};

const appendCode = (segments: Segment[], node: Code): void => {
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
      appendImage(state.segments, node);
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
    default:
      break;
  }
};

/**
 * Parse a markdown string into a flat array of layout segments.
 */
const parseSegments = (markdown: string): Segment[] => {
  const tree = parser.parse(markdown) as Root;
  const state: BuilderState = { segments: [], paragraphIndex: 0 };

  for (const node of tree.children) {
    processBlock(state, node);
  }

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
