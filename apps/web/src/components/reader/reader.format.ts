/**
 * Reader — Format
 *
 * Decides what shape the reading surface takes. A desktop window has room for
 * a two-page spread, which is how a magazine is actually read; a tablet gets a
 * single full page; a phone gets a page sized for one hand.
 *
 * The engine doesn't know or care — it lays out pages of whatever box it is
 * given. How many of those are shown at once is a reading decision, made here.
 */

import type { Size } from './reader.hooks.ts';

/* ── Types ────────────────────────────────────────────────────── */

type FormatMode = 'spread' | 'page' | 'compact';

/** How pages group into turns. */
type TurnModel = {
  perTurn: number;
  coverAlone: boolean;
};

type ReaderFormat = {
  mode: FormatMode;
  /** The box a single page is typeset into. */
  page: Size;
  /** Pages shown, and turned, at once. */
  perTurn: number;
  /** Space between the two halves of a spread. */
  gutter: number;
};

/* ── Constants ────────────────────────────────────────────────── */

/** Below this, two pages side by side would each be too narrow to read. */
const SPREAD_MIN_WIDTH = 1180;

/** A spread only makes sense in landscape. */
const SPREAD_MIN_RATIO = 1.15;

/** Wider than this and a single page becomes a wall of text. */
const PAGE_MAX_WIDTH = 780;

/** A spread page, likewise. */
const SPREAD_PAGE_MAX_WIDTH = 700;

const COMPACT_MAX_WIDTH = 620;

const GUTTER = 2;

/* ── Public functions ─────────────────────────────────────────── */

/** The reading format for a container of a given size. */
const formatFor = (container: Size): ReaderFormat => {
  const { width, height } = container;

  if (width >= SPREAD_MIN_WIDTH && width / height >= SPREAD_MIN_RATIO) {
    const pageWidth = Math.min((width - GUTTER) / 2, SPREAD_PAGE_MAX_WIDTH);
    return {
      mode: 'spread',
      page: { width: Math.floor(pageWidth), height: Math.floor(height) },
      perTurn: 2,
      gutter: GUTTER,
    };
  }

  if (width <= COMPACT_MAX_WIDTH) {
    return {
      mode: 'compact',
      page: { width: Math.floor(width), height: Math.floor(height) },
      perTurn: 1,
      gutter: 0,
    };
  }

  return {
    mode: 'page',
    page: { width: Math.floor(Math.min(width, PAGE_MAX_WIDTH)), height: Math.floor(height) },
    perTurn: 1,
    gutter: 0,
  };
};

/**
 * The first page of the spread a given page belongs to.
 *
 * With `coverAlone` the first page stands by itself, the way a magazine's
 * cover faces outward — so afterwards an even page always sits on the left.
 * Without it, pages simply pair from the beginning.
 */
const spreadStart = (index: number, turn: TurnModel): number => {
  if (turn.perTurn === 1 || index <= 0) {
    return Math.max(index, 0);
  }
  if (!turn.coverAlone) {
    return index - (index % turn.perTurn);
  }
  return index % 2 === 0 ? index - 1 : index;
};

/** How many pages that spread shows. */
const pagesShown = (start: number, turn: TurnModel): number =>
  turn.coverAlone && start === 0 && turn.perTurn > 1 ? 1 : turn.perTurn;

/** First page of the next spread. */
const nextIndex = (index: number, turn: TurnModel, total: number): number => {
  const start = spreadStart(index, turn);
  return Math.min(start + pagesShown(start, turn), Math.max(total - 1, 0));
};

/** First page of the previous spread. */
const previousIndex = (index: number, turn: TurnModel): number => {
  const start = spreadStart(index, turn);
  return start <= 0 ? 0 : spreadStart(start - 1, turn);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FormatMode, ReaderFormat, TurnModel };
export { formatFor, spreadStart, pagesShown, nextIndex, previousIndex, SPREAD_MIN_WIDTH, PAGE_MAX_WIDTH };
