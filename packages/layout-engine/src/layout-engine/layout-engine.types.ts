/**
 * Layout Engine — Types
 *
 * The content model is pure data with no styling. Callers describe *what* a
 * page contains; layout functions decide *where* it goes by placing content at
 * exact coordinates. Styling always comes from the DOM — the engine reads
 * computed font metrics off live elements so measurement matches rendering.
 */

/* ── Geometry ─────────────────────────────────────────────────── */

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Inset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

/* ── Inline markup ────────────────────────────────────────────── */

type InlineSpanKind = 'bold' | 'italic' | 'code' | 'link';

/**
 * A run of inline markup within a TextContent, addressed by UTF-16 offsets
 * into `text`. Offsets survive line breaking: the engine maps every laid-out
 * line back to its character range and re-applies whichever spans overlap it.
 */
type InlineSpan = {
  kind: InlineSpanKind;
  /** Inclusive start offset into the owning text. */
  start: number;
  /** Exclusive end offset into the owning text. */
  end: number;
  href?: string;
};

/** Builds the element for one inline run. The engine fills in the text. */
type InlineRenderer = (span: InlineSpan) => HTMLElement;

/* ── Content ──────────────────────────────────────────────────── */

type TextContent = {
  type: 'text';
  role: string;
  text: string;
  inline: true;
  /** Inline markup runs, as UTF-16 offsets into `text`. */
  spans?: InlineSpan[];
  /**
   * How far into `text` this item has already been consumed, as a UTF-16
   * offset. Set by the engine when text overflows onto the next page.
   */
  offset?: number;
  /**
   * Set by `mergeText` — the items this merged text stands in for. When the
   * merge overflows, the engine maps its offset back onto these.
   */
  sources?: TextContent[];
};

type ImageContent = {
  type: 'image';
  role: string;
  src: string;
  aspect: number;
  inline: boolean;
  caption?: string;
};

type GroupContent = {
  type: 'group';
  role: string;
  children: Content[];
  inline: boolean;
};

type Content = TextContent | ImageContent | GroupContent;

/* ── Flow options ─────────────────────────────────────────────── */

type FlowTextOptions = {
  columns?: number;
  gap?: number;
  inset?: number | Inset;
  startY?: number;
  endY?: number;
  columnStarts?: number[];
  /** Style the container before measurement — computed font is read back from the DOM. */
  setup: (container: HTMLDivElement) => void;
  /** Override how inline markup runs are turned into elements. */
  inlineRenderer?: InlineRenderer;
  /**
   * Spread lines to the full measure. Right for body copy, wrong for almost
   * everything else — a justified headline is mostly gaps.
   */
  justify?: boolean;
};

type RegionOptions = {
  columns?: number;
  gap?: number;
  inset?: number | Inset;
  startY?: number;
  endY?: number;
  /**
   * Where each column picks up, when they aren't level. A column flow fills
   * one column before the next, so by the time a later item is placed the
   * columns are at different heights — and text has to resume from each
   * column's own position, not from a single line across the page.
   */
  columnStarts?: number[];
  /** Horizontal room the container's own border and padding take. */
  indent?: { left: number; right: number };
};

type FlowResult = {
  container: HTMLDivElement;
  bbox: Rect;
  lineCount: number;
  lastY: number;
  /** Zones this flow claimed, one per column it touched. */
  zones: Rect[];
};

/* ── Mixed content flow ───────────────────────────────────────── */

/** Cursor position within the column flow — passed to the render callback. */
type FlowCursor = {
  y: number;
  column: number;
  columnWidth: number;
  columnX: number;
  pageWidth: number;
  /** Vertical space left in this column. Enough to decide if an item belongs here. */
  remaining: number;
  /** Next item in the stream, for lookahead (e.g. image + caption grouping). */
  nextItem: Content | null;
};

/**
 * What the render callback returns to tell the flow how to handle an item.
 *
 * `defer` leaves the item unplaced and ends the page — the way to keep a
 * heading with its paragraph, or refuse a figure the column can't do justice.
 */
type FlowItemResult =
  | {
      type: 'text';
      setup: (el: HTMLDivElement) => void;
      inlineRenderer?: InlineRenderer;
      /** Space to leave above this text. */
      spaceBefore?: number;
      /** Space to leave below it, before whatever follows. */
      spaceAfter?: number;
      justify?: boolean;
    }
  | {
      type: 'block';
      height: number;
      render: (el: HTMLDivElement, rect: Rect) => void;
      fullWidth?: boolean;
      padding?: number;
    }
  | { type: 'skip' }
  | { type: 'defer' };

type FlowOptions = {
  columns?: number;
  gap?: number;
  inset?: number | Inset;
  startY?: number;
  endY?: number;
  /** Called for each content item. Returns how to render it in the flow. */
  render: (item: Content, cursor: FlowCursor) => FlowItemResult;
};

type FlowStreamResult = {
  lastY: number;
  itemCount: number;
};

type FitStrategy = 'nearest' | 'push-down' | 'push-right' | 'push-left' | 'below' | 'constrain-x' | 'constrain-y';

type TextMeasurement = {
  height: number;
  lineCount: number;
};

/* ── Page ─────────────────────────────────────────────────────── */

type Page = {
  readonly el: HTMLDivElement;
  readonly width: number;
  readonly height: number;
  readonly zones: readonly Rect[];

  /**
   * Place content at exact coordinates and register an avoidance zone.
   * `padding` expands the zone beyond the visual rect.
   */
  place: (content: Content, rect: Rect, padding?: number | Inset) => HTMLElement;

  /** Mark content as consumed without placing it visually. */
  consume: (content: Content) => void;

  /** Consume the first `count` characters of a text item, advancing its offset. */
  consumeText: (content: TextContent, count: number) => string;

  /** Measure text at a given width, using the font the setup callback produces. */
  measureText: (text: string, maxWidth: number, setup: (el: HTMLDivElement) => void) => TextMeasurement;

  /** Register an avoidance zone without placing content. */
  avoid: (rect: Rect) => void;

  /** Flow text into the space the current zones leave free. */
  flowText: (content: TextContent, options: FlowTextOptions) => FlowResult;

  /**
   * Flow a mixed content stream into columns. Text items flow continuously;
   * block items are placed at the current column position.
   */
  flow: (content: Content[], options: FlowOptions) => FlowStreamResult;

  /** Compute the regions left free by the current zones. */
  regions: (options?: RegionOptions) => Rect[];

  /** Find a valid position for a rect near a target. null = doesn't fit. */
  fit: (width: number, height: number, target: { x: number; y: number }, strategy?: FitStrategy) => Rect | null;

  /** fit + place in one call. Returns null if it doesn't fit. */
  fitAndPlace: (args: FitAndPlaceArgs) => HTMLElement | null;
};

type FitAndPlaceArgs = {
  content: Content;
  width: number;
  height: number;
  target: { x: number; y: number };
  strategy?: FitStrategy;
  padding?: number | Inset;
};

/* ── Layout ───────────────────────────────────────────────────── */

type LayoutFn = (content: Content[], page: Page) => void;

type LayoutResult = {
  el: HTMLDivElement;
  remaining: Content[];
  zones: Rect[];
};

type PageSpec = {
  width: number;
  height: number;
};

/* ── Exports ──────────────────────────────────────────────────── */

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
};
