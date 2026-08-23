/**
 * Layout Engine — Content stream flow
 *
 * Pours a mixed stream — paragraphs, images, pull quotes — into columns. The
 * caller's render callback decides what each item becomes; the flow decides
 * where it lands and when the page is full.
 *
 * Source order is preserved. When a block doesn't fit, the flow stops rather
 * than reaching past it for something smaller: an article that reshuffles its
 * own figures around the reader is worse than one that turns the page early.
 * The exception is a block too big for any page, which is clamped and placed
 * so the pagination can always make progress.
 */

import type {
  Content,
  FlowItemResult,
  FlowOptions,
  FlowResult,
  FlowStreamResult,
  FlowTextOptions,
  Rect,
  TextContent,
} from './layout-engine.types.ts';
import { normalizeInset } from './layout-engine.geometry.ts';

/* ── Types ────────────────────────────────────────────────────── */

/** What the flow needs from a page. Satisfied by PageImpl. */
type FlowHost = {
  readonly el: HTMLDivElement;
  readonly width: number;
  isConsumed: (content: Content) => boolean;
  isFinished: (content: TextContent) => boolean;
  markConsumed: (content: Content) => void;
  addZone: (rect: Rect) => void;
  flowText: (content: TextContent, options: FlowTextOptions) => FlowResult;
};

type FlowStreamArgs = {
  host: FlowHost;
  items: Content[];
  options: FlowOptions;
};

type Geometry = {
  columns: number;
  gap: number;
  columnWidth: number;
  availableWidth: number;
  left: number;
  startY: number;
  endY: number;
};

type BlockPlacement = {
  height: number;
  render: (el: HTMLDivElement, rect: Rect) => void;
  fullWidth?: boolean;
  padding?: number;
};

/* ── Private helpers ──────────────────────────────────────────── */

const geometryFor = (host: FlowHost, options: FlowOptions): Geometry => {
  const inset = normalizeInset(options.inset ?? 0);
  const columns = options.columns ?? 1;
  const gap = options.gap ?? 0;
  const availableWidth = host.width - inset.left - inset.right;

  return {
    columns,
    gap,
    availableWidth,
    columnWidth: (availableWidth - (columns - 1) * gap) / columns,
    left: inset.left,
    startY: options.startY ?? inset.top,
    endY: options.endY ?? Infinity,
  };
};

const columnX = (geometry: Geometry, column: number): number =>
  geometry.left + column * (geometry.columnWidth + geometry.gap);

/**
 * The column the flow is currently in.
 *
 * Columns fill in order, like a page of newsprint — never whichever happens to
 * be shortest. Reading order depends on it, and so does every decision made
 * against "how much room is left", since text resumes from each column's own
 * position rather than a single line ruled across the page.
 */
const currentColumn = (columnY: number[], endY: number): number => {
  for (let i = 0; i < columnY.length; i++) {
    if ((columnY[i] ?? 0) < endY) {
      return i;
    }
  }
  return columnY.length - 1;
};

const renderBlockElement = (host: FlowHost, rect: Rect, render: (el: HTMLDivElement, rect: Rect) => void): void => {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  render(el, rect);
  host.el.appendChild(el);
  host.addZone(rect);
};

type PlaceBlockArgs = {
  host: FlowHost;
  item: Content;
  block: BlockPlacement;
  geometry: Geometry;
  columnY: number[];
  column: number;
  /** Nothing has been placed on this page yet — the block must fit somehow. */
  isFirst: boolean;
};

/** Returns false when the block doesn't fit and the page should end. */
const placeBlock = ({ host, item, block, geometry, columnY, column, isFirst }: PlaceBlockArgs): boolean => {
  const pad = block.padding ?? 0;
  const fullWidth = block.fullWidth === true;

  const y = (fullWidth ? Math.max(...columnY) : (columnY[column] ?? 0)) + pad;
  const available = geometry.endY - y;

  if (block.height > available) {
    if (!isFirst || available <= 0) {
      return false;
    }
  }

  const rect: Rect = {
    x: fullWidth ? geometry.left : columnX(geometry, column),
    y,
    width: fullWidth ? geometry.availableWidth : geometry.columnWidth,
    height: Math.min(block.height, available),
  };

  renderBlockElement(host, rect, block.render);
  host.markConsumed(item);

  const bottom = rect.y + rect.height + pad;
  if (fullWidth) {
    for (let i = 0; i < columnY.length; i++) {
      columnY[i] = Math.max(columnY[i] ?? 0, bottom);
    }
  } else {
    columnY[column] = bottom;
  }

  return true;
};

type FlowTextArgs = {
  host: FlowHost;
  item: TextContent;
  setup: (el: HTMLDivElement) => void;
  inlineRenderer: FlowTextOptions['inlineRenderer'];
  justify: boolean;
  spaceBefore: number;
  spaceAfter: number;
  column: number;
  options: FlowOptions;
  geometry: Geometry;
  columnY: number[];
};

const flowTextItem = ({
  host,
  item,
  setup,
  inlineRenderer,
  justify,
  spaceBefore,
  spaceAfter,
  column,
  options,
  geometry,
  columnY,
}: FlowTextArgs): void => {
  // Each column resumes where it actually got to, so the flow continues from
  // the current column instead of restarting level across the page.
  const columnStarts = columnY.map((y, index) => (index === column ? y + spaceBefore : y));

  const result = host.flowText(item, {
    columns: geometry.columns,
    gap: geometry.gap,
    inset: options.inset,
    startY: columnStarts[column] ?? geometry.startY,
    endY: geometry.endY,
    columnStarts,
    setup,
    inlineRenderer,
    justify,
  });

  // Advance each column past whatever the text just claimed there.
  for (let index = 0; index < geometry.columns; index++) {
    const x = columnX(geometry, index);
    for (const zone of result.zones) {
      if (zone.x >= x && zone.x < x + geometry.columnWidth + 1) {
        columnY[index] = Math.max(columnY[index] ?? 0, zone.y + zone.height + spaceAfter);
      }
    }
  }
};

type ApplyItemArgs = {
  host: FlowHost;
  item: Content;
  result: FlowItemResult;
  options: FlowOptions;
  geometry: Geometry;
  columnY: number[];
  column: number;
  itemCount: number;
};

/**
 * Carry out what the render callback asked for.
 * 'deferred' means the item stays unplaced — try the next column, or end here.
 */
const applyItem = ({
  host,
  item,
  result,
  options,
  geometry,
  columnY,
  column,
  itemCount,
}: ApplyItemArgs): 'placed' | 'deferred' => {
  if (result.type === 'defer') {
    return 'deferred';
  }

  if (result.type === 'skip') {
    host.markConsumed(item);
    return 'placed';
  }

  if (result.type === 'block') {
    const placed = placeBlock({
      host,
      item,
      block: result,
      geometry,
      columnY,
      column,
      // Clamping is a last resort: only when nothing has been placed and there
      // is no further column to try.
      isFirst: itemCount === 0 && column === geometry.columns - 1,
    });
    return placed ? 'placed' : 'deferred';
  }

  if (item.type !== 'text') {
    return 'placed';
  }

  flowTextItem({
    host,
    item,
    setup: result.setup,
    inlineRenderer: result.inlineRenderer,
    justify: result.justify ?? true,
    spaceBefore: itemCount === 0 ? 0 : (result.spaceBefore ?? 0),
    spaceAfter: result.spaceAfter ?? 0,
    column,
    options,
    geometry,
    columnY,
  });

  return 'placed';
};

/* ── Public functions ─────────────────────────────────────────── */

const flowStream = ({ host, items, options }: FlowStreamArgs): FlowStreamResult => {
  const geometry = geometryFor(host, options);
  const columnY: number[] = new Array<number>(geometry.columns).fill(geometry.startY);

  const flowable = items.filter((item) => !host.isConsumed(item) && !(item.type === 'text' && host.isFinished(item)));

  let itemCount = 0;

  for (let index = 0; index < flowable.length; index++) {
    const item = flowable[index];
    if (!item) {
      continue;
    }

    const column = currentColumn(columnY, geometry.endY);
    if ((columnY[column] ?? 0) >= geometry.endY) {
      break;
    }

    const result = options.render(item, {
      y: columnY[column] ?? 0,
      column,
      columnWidth: geometry.columnWidth,
      columnX: columnX(geometry, column),
      pageWidth: host.width,
      remaining: geometry.endY - (columnY[column] ?? 0),
      nextItem: flowable[index + 1] ?? null,
    });

    const outcome = applyItem({ host, item, result, options, geometry, columnY, column, itemCount });

    if (outcome === 'placed') {
      itemCount++;
      continue;
    }

    // The item won't sit here. A later column is a fresh start; if there isn't
    // one, the page is done and the item carries over to the next.
    if (column < geometry.columns - 1) {
      columnY[column] = geometry.endY;
      index--;
      continue;
    }
    break;
  }

  return { lastY: Math.max(...columnY), itemCount };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FlowHost, FlowStreamArgs };
export { flowStream };
