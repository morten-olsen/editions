/**
 * Reader — Markdown
 *
 * Turns extracted article markdown into flat blocks: prose runs carrying
 * inline markup offsets, images, and rules. This is the single parse in the
 * reading path — both the paged and scrolling renderers consume its output, so
 * neither can drift from the other in what it considers a heading or a quote.
 *
 * Consecutive paragraphs are joined into one run separated by newlines. The
 * layout engine reads a newline as a paragraph boundary and sets its own
 * spacing, and a run that spans pages resumes mid-sentence on the next one.
 */

import type { InlineSpan } from '@editions/layout-engine';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Blockquote, Code, Heading, List, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';

/* ── Types ────────────────────────────────────────────────────── */

type TextRole = 'body' | 'heading' | 'subheading' | 'blockquote' | 'code';

type Block =
  | { kind: 'text'; role: TextRole; text: string; spans: InlineSpan[] }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'rule' };

type InlineContent = {
  text: string;
  spans: InlineSpan[];
};

/* ── Constants ────────────────────────────────────────────────── */

const parser = unified().use(remarkParse).use(remarkGfm);

const PARAGRAPH_SEPARATOR = '\n';

const NBSP = '\u00a0';

/** Beyond h2 the distinction stops carrying information at reading size. */
const SUBHEADING_LEVEL = 3;

/* ── Private helpers ──────────────────────────────────────────── */

/**
 * Flatten inline nodes to plain text, recording where each markup run starts
 * and ends. Offsets are what survive line breaking — the renderer re-applies
 * the markup once it knows which characters landed on which line.
 */
const extractInline = (nodes: PhrasingContent[]): InlineContent => {
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
        node.children.forEach(walk);
        spans.push({ kind: 'bold', start, end: text.length });
        break;
      }

      case 'emphasis': {
        const start = text.length;
        node.children.forEach(walk);
        spans.push({ kind: 'italic', start, end: text.length });
        break;
      }

      case 'link': {
        const start = text.length;
        node.children.forEach(walk);
        spans.push({ kind: 'link', start, end: text.length, href: node.url });
        break;
      }

      case 'delete':
        node.children.forEach(walk);
        break;

      case 'break':
        text += ' ';
        break;

      default:
        break;
    }
  };

  nodes.forEach(walk);
  return { text, spans };
};

const shiftSpans = (spans: InlineSpan[], by: number): InlineSpan[] =>
  spans.map((span) => ({ ...span, start: span.start + by, end: span.end + by }));

const textBlock = (role: TextRole, content: InlineContent): Block | null =>
  content.text.trim().length > 0 ? { kind: 'text', role, text: content.text.trim(), spans: content.spans } : null;

const headingBlock = (node: Heading): Block | null =>
  textBlock(node.depth >= SUBHEADING_LEVEL ? 'subheading' : 'heading', extractInline(node.children));

/** A blockquote reads as one passage, however many paragraphs it was written as. */
const blockquoteBlock = (node: Blockquote): Block | null => {
  const parts: string[] = [];
  const spans: InlineSpan[] = [];
  let offset = 0;

  for (const child of node.children) {
    if (child.type !== 'paragraph') {
      continue;
    }
    if (parts.length > 0) {
      offset += PARAGRAPH_SEPARATOR.length;
    }
    const content = extractInline(child.children);
    spans.push(...shiftSpans(content.spans, offset));
    parts.push(content.text);
    offset += content.text.length;
  }

  return textBlock('blockquote', { text: parts.join(PARAGRAPH_SEPARATOR), spans });
};

/** List items become their own paragraphs, marked the way print does it. */
const listBlocks = (node: List): Block[] => {
  const blocks: Block[] = [];

  node.children.forEach((item, index) => {
    // A non-breaking space keeps the marker on the same line as its item.
    const marker = node.ordered === true ? `${(node.start ?? 1) + index}.${NBSP}` : `•${NBSP}`;
    for (const child of item.children) {
      if (child.type !== 'paragraph') {
        continue;
      }
      const content = extractInline(child.children);
      const block = textBlock('body', {
        text: marker + content.text,
        spans: shiftSpans(content.spans, marker.length),
      });
      if (block) {
        blocks.push(block);
      }
    }
  });

  return blocks;
};

const codeBlock = (node: Code): Block | null => textBlock('code', { text: node.value, spans: [] });

const paragraphBlocks = (node: Paragraph): Block[] => {
  // A paragraph holding nothing but an image is a figure.
  const only = node.children[0];
  if (node.children.length === 1 && only?.type === 'image') {
    return [{ kind: 'image', src: only.url, alt: only.alt ?? '' }];
  }

  const block = textBlock('body', extractInline(node.children));
  return block ? [block] : [];
};

const blocksFor = (node: RootContent): Block[] => {
  switch (node.type) {
    case 'paragraph':
      return paragraphBlocks(node);
    case 'heading': {
      const block = headingBlock(node);
      return block ? [block] : [];
    }
    case 'blockquote': {
      const block = blockquoteBlock(node);
      return block ? [block] : [];
    }
    case 'image':
      return [{ kind: 'image', src: node.url, alt: node.alt ?? '' }];
    case 'thematicBreak':
      return [{ kind: 'rule' }];
    case 'list':
      return listBlocks(node);
    case 'code': {
      const block = codeBlock(node);
      return block ? [block] : [];
    }
    default:
      return [];
  }
};

/**
 * Join neighbouring prose into single runs. One run of many paragraphs flows
 * and breaks better than many runs of one — the engine can carry it across a
 * page boundary, and it spaces the paragraphs itself.
 */
const mergeProse = (blocks: Block[]): Block[] => {
  const merged: Block[] = [];

  for (const block of blocks) {
    const previous = merged[merged.length - 1];

    if (block.kind === 'text' && block.role === 'body' && previous?.kind === 'text' && previous.role === 'body') {
      const offset = previous.text.length + PARAGRAPH_SEPARATOR.length;
      merged[merged.length - 1] = {
        kind: 'text',
        role: 'body',
        text: previous.text + PARAGRAPH_SEPARATOR + block.text,
        spans: [...previous.spans, ...shiftSpans(block.spans, offset)],
      };
      continue;
    }

    merged.push(block);
  }

  return merged;
};

/* ── Public functions ─────────────────────────────────────────── */

/** Parse article markdown into the blocks both renderers work from. */
const parseBlocks = (markdown: string): Block[] => {
  const tree = parser.parse(markdown) as Root;
  const blocks = tree.children.flatMap(blocksFor);
  return mergeProse(blocks);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Block, TextRole, InlineContent };
export { parseBlocks, extractInline };
