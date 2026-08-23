/**
 * Layout Engine
 *
 * A typesetter for the browser. Content goes in as pure data; layout functions
 * place it at exact coordinates on a fixed-size page; text flows around
 * whatever is already there and resumes on the next page where it left off.
 *
 * Two properties make it usable as a design tool rather than a text box:
 *
 * - **Measurement is DOM-driven.** Style an element however the design system
 *   already does — a class, a token, inline CSS — and the engine reads the
 *   computed font back. What is measured is what renders.
 * - **Positions are offsets, not cursors.** Every line knows where it starts in
 *   the source text, so inline markup survives line breaking and a paragraph
 *   can resume mid-sentence on the next page.
 *
 *   import { paginate, text, image } from '@editions/layout-engine';
 *
 *   const pages = paginate({
 *     content: [text('…', { role: 'body' })],
 *     spec: { width: 960, height: 1280 },
 *     layouts: [coverLayout, openerLayout, bodyLayout],
 *   });
 */

/* ── Composition ──────────────────────────────────────────────── */

export type { LayoutPageArgs, PaginateArgs } from './layout-engine.layout.ts';
export { layoutPage, paginate } from './layout-engine.layout.ts';

/* ── Content ──────────────────────────────────────────────────── */

export type { TextOptions } from './layout-engine.content.ts';
export { text, image, placedImage, group, placedGroup, mergeText } from './layout-engine.content.ts';

/* ── Inline markup ────────────────────────────────────────────── */

export type { LineContentArgs } from './layout-engine.inline.ts';
export { buildLineContent, shiftSpans, createDefaultElement } from './layout-engine.inline.ts';

/* ── Geometry ─────────────────────────────────────────────────── */

export type { Span, SpanArgs } from './layout-engine.geometry.ts';
export { computeRegions, availableSpans, normalizeInset, rectsOverlap } from './layout-engine.geometry.ts';

/* ── Types ────────────────────────────────────────────────────── */

export type {
  Rect,
  Inset,
  InlineSpanKind,
  InlineSpan,
  InlineRenderer,
  TextContent,
  ImageContent,
  GroupContent,
  Content,
  FlowTextOptions,
  RegionOptions,
  FlowResult,
  FlowCursor,
  FlowItemResult,
  FlowOptions,
  FlowStreamResult,
  FitStrategy,
  FitAndPlaceArgs,
  TextMeasurement,
  Page,
  LayoutFn,
  LayoutResult,
  PageSpec,
} from './layout-engine.types.ts';
