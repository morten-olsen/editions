/**
 * Layout Engine — Page
 *
 * A page is a fixed box plus the zones already spoken for. Layout functions
 * place content against it; every placement adds a zone, so later flows route
 * around earlier decisions without anyone tracking the geometry by hand.
 *
 * Measurement is DOM-driven on purpose: the caller styles an element however
 * it likes (a class, a design token, inline CSS) and the engine reads back the
 * computed font. What gets measured is exactly what gets rendered.
 */

import { layout as pretextLayout, prepareWithSegments } from '@chenglou/pretext';

import type {
  Content,
  FitAndPlaceArgs,
  FitStrategy,
  FlowOptions,
  FlowResult,
  FlowStreamResult,
  FlowTextOptions,
  Inset,
  Page,
  Rect,
  RegionOptions,
  TextContent,
  TextMeasurement,
} from './layout-engine.types.ts';
import { computeRegions, normalizeInset } from './layout-engine.geometry.ts';
import { flowTextLayout } from './layout-engine.text.ts';
import { renderLines } from './layout-engine.lines.ts';
import { solvePlacement } from './layout-engine.solver.ts';
import { flowStream } from './layout-engine.flow.ts';

/* ── Types ────────────────────────────────────────────────────── */

type FontMetrics = {
  font: string;
  lineHeight: number;
};

/** Horizontal insets a container's own box takes from the text inside it. */
type BoxInsets = {
  /** Padding alone — absolutely positioned children sit inside the border. */
  paddingLeft: number;
  /** Border + padding on the left. */
  left: number;
  /** Border + padding on the right. */
  right: number;
};

/* ── Private helpers ──────────────────────────────────────────── */

/**
 * Read a canvas font shorthand and line height off a live element.
 * The element must be in the document for computed styles to resolve.
 */
const readFontFromDOM = (el: HTMLElement): FontMetrics => {
  const computed = window.getComputedStyle(el);
  const font = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;

  let lineHeight = parseFloat(computed.lineHeight);
  if (isNaN(lineHeight)) {
    // 'normal' — the usual approximation.
    lineHeight = parseFloat(computed.fontSize) * 1.2;
  }

  return { font, lineHeight };
};

/**
 * Horizontal room the container's own border and padding claim.
 *
 * A quote's rule or a code block's padding has to come out of the measure,
 * otherwise the text is set to the full column width and then drawn on top of
 * its own decoration. Vertical padding is not honoured — use the flow's
 * `spaceBefore` / `spaceAfter`, which the column geometry actually knows about.
 */
const readBoxFromDOM = (el: HTMLElement): BoxInsets => {
  const computed = window.getComputedStyle(el);
  const paddingLeft = parseFloat(computed.paddingLeft) || 0;
  const paddingRight = parseFloat(computed.paddingRight) || 0;
  const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
  const borderRight = parseFloat(computed.borderRightWidth) || 0;

  return {
    paddingLeft,
    left: paddingLeft + borderLeft,
    right: paddingRight + borderRight,
  };
};

const positionAbsolute = (el: HTMLElement, rect: Rect): void => {
  el.style.position = 'absolute';
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
};

const createElementFor = (content: Content): HTMLElement => {
  switch (content.type) {
    case 'image': {
      const img = document.createElement('img');
      img.src = content.src;
      img.draggable = false;
      return img;
    }
    case 'text': {
      const el = document.createElement('div');
      el.textContent = content.text;
      return el;
    }
    case 'group':
      return document.createElement('div');
  }
};

const zoneFor = (rect: Rect, padding?: number | Inset): Rect => {
  if (padding === undefined) {
    return rect;
  }
  const pad = normalizeInset(padding);
  return {
    x: rect.x - pad.left,
    y: rect.y - pad.top,
    width: rect.width + pad.left + pad.right,
    height: rect.height + pad.top + pad.bottom,
  };
};

/* ── PageImpl ─────────────────────────────────────────────────── */

class PageImpl implements Page {
  readonly el: HTMLDivElement;
  readonly width: number;
  readonly height: number;

  #zones: Rect[] = [];
  #consumed = new Set<Content>();
  /** How far into each text item this page has got, as a UTF-16 offset. */
  #textOffsets = new Map<TextContent, number>();
  /** Text items with nothing left to place. */
  #textFinished = new Set<TextContent>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.el = document.createElement('div');
    this.el.style.position = 'relative';
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.style.overflow = 'hidden';
  }

  get zones(): readonly Rect[] {
    return this.#zones;
  }

  get consumed(): ReadonlySet<Content> {
    return this.#consumed;
  }

  /** Resume offsets for text that overflowed this page. */
  get textOffsets(): ReadonlyMap<TextContent, number> {
    return this.#textOffsets;
  }

  isConsumed(content: Content): boolean {
    return this.#consumed.has(content);
  }

  isFinished(content: TextContent): boolean {
    return this.#textFinished.has(content);
  }

  markConsumed(content: Content): void {
    this.#consumed.add(content);
  }

  addZone(rect: Rect): void {
    this.#zones.push(rect);
  }

  place(content: Content, rect: Rect, padding?: number | Inset): HTMLElement {
    const el = createElementFor(content);
    positionAbsolute(el, rect);
    this.el.appendChild(el);

    this.#zones.push(zoneFor(rect, padding));
    this.#consumed.add(content);

    return el;
  }

  consume(content: Content): void {
    this.#consumed.add(content);
  }

  consumeText(content: TextContent, count: number): string {
    const start = this.#offsetFor(content);
    const end = Math.min(start + count, content.text.length);
    this.#textOffsets.set(content, end);
    if (end >= content.text.length) {
      this.#textFinished.add(content);
    }
    return content.text.slice(start, end);
  }

  measureText(text: string, maxWidth: number, setup: (el: HTMLDivElement) => void): TextMeasurement {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    this.el.appendChild(el);
    setup(el);
    const { font, lineHeight } = readFontFromDOM(el);
    this.el.removeChild(el);

    // Same whitespace contract as flowTextLayout, or a measured height would
    // not predict the flowed one.
    const prepared = prepareWithSegments(text, font, { whiteSpace: 'pre-wrap' });
    const result = pretextLayout(prepared, maxWidth, lineHeight);
    return { height: result.height, lineCount: result.lineCount };
  }

  avoid(rect: Rect): void {
    this.#zones.push(rect);
  }

  flowText(content: TextContent, options: FlowTextOptions): FlowResult {
    if (this.#textFinished.has(content)) {
      return {
        container: document.createElement('div'),
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        lineCount: 0,
        lastY: options.startY ?? 0,
        zones: [],
      };
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.visibility = 'hidden';
    this.el.appendChild(container);

    options.setup(container);
    const { font, lineHeight } = readFontFromDOM(container);
    const box = readBoxFromDOM(container);

    const result = flowTextLayout({
      text: content.text,
      offset: this.#offsetFor(content),
      font,
      lineHeight,
      regions: computeRegions(this.width, this.height, {
        columns: options.columns,
        gap: options.gap,
        inset: options.inset,
        startY: options.startY,
        endY: options.endY,
        columnStarts: options.columnStarts,
        indent: { left: box.left, right: box.right },
      }),
      zones: this.#zones,
    });

    // The container is grown back around the text so its border and padding
    // land outside the measure, the way the box model would put them.
    container.style.visibility = '';
    container.style.boxSizing = 'border-box';
    container.style.left = `${result.bbox.x - box.left}px`;
    container.style.top = `${result.bbox.y}px`;
    container.style.width = `${result.bbox.width + box.left + box.right}px`;
    container.style.height = `${result.bbox.height}px`;

    renderLines({
      container,
      lines: result.lines,
      // Absolutely positioned children sit against the padding box, which
      // starts one border-width inside the container.
      origin: { x: result.bbox.x - box.paddingLeft, y: result.bbox.y },
      spans: content.spans,
      inlineRenderer: options.inlineRenderer,
      justify: options.justify ?? true,
    });

    for (const zone of result.textZones) {
      this.#zones.push(zone);
    }

    this.#consumed.add(content);
    for (const source of content.sources ?? []) {
      this.#consumed.add(source);
    }

    if (result.remainingOffset === null) {
      this.#textOffsets.delete(content);
      this.#textFinished.add(content);
    } else {
      this.#textOffsets.set(content, result.remainingOffset);
    }

    const lastLine = result.lines[result.lines.length - 1];
    const lastY = lastLine ? lastLine.y + lineHeight : (options.startY ?? 0);

    return {
      container,
      bbox: result.bbox,
      lineCount: result.lines.length,
      lastY,
      zones: result.textZones,
    };
  }

  flow(content: Content[], options: FlowOptions): FlowStreamResult {
    return flowStream({ host: this, items: content, options });
  }

  regions(options?: RegionOptions): Rect[] {
    return computeRegions(this.width, this.height, options);
  }

  fit(width: number, height: number, target: { x: number; y: number }, strategy: FitStrategy = 'nearest'): Rect | null {
    return solvePlacement({
      width,
      height,
      target,
      strategy,
      zones: this.#zones,
      bounds: { x: 0, y: 0, width: this.width, height: this.height },
    });
  }

  fitAndPlace({ content, width, height, target, strategy = 'nearest', padding }: FitAndPlaceArgs): HTMLElement | null {
    const rect = this.fit(width, height, target, strategy);
    return rect === null ? null : this.place(content, rect, padding);
  }

  #offsetFor(content: TextContent): number {
    return this.#textOffsets.get(content) ?? content.offset ?? 0;
  }
}

/* ── Exports ──────────────────────────────────────────────────── */

export type { FontMetrics, BoxInsets };
export { PageImpl, readFontFromDOM, readBoxFromDOM };
