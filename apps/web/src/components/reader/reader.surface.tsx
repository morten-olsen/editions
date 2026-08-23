/**
 * Reader — Surface
 *
 * The paged reading surface: a fixed box showing one or two pages, and the
 * turning that moves between them. It never scrolls.
 *
 * A page is either typeset by the layout engine — article prose, measured and
 * broken to fit — or a React composition, for the parts of a magazine that are
 * designed rather than flowed: the cover, the contents, a section divider, the
 * last page. Both are pages of the same size and turn the same way, so the
 * distinction is invisible to the reader.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { pagesShown, spreadStart, type ReaderFormat, type TurnModel } from './reader.format.ts';
import { usePageSlot } from './reader.hooks.ts';
import { useClickTurns, useKeyboardTurns, useTouchTurns } from './reader.nav.ts';

/* ── Types ────────────────────────────────────────────────────── */

/** One page of the publication. */
type Sheet = {
  key: string;
  /** A page built by the layout engine. */
  element?: HTMLElement;
  /** A page composed in React. */
  node?: React.ReactNode;
};

type PageFooterArgs = {
  index: number;
  total: number;
  isLast: boolean;
  sheet: Sheet;
};

type PagedSurfaceProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  format: ReaderFormat;
  sheets: Sheet[];
  index: number;
  onTurn: (index: number) => void;
  /** Open on a single page, the way a magazine's cover faces outward. */
  coverAlone?: boolean;
  footer?: (args: PageFooterArgs) => React.ReactNode;
  onExit?: () => void;
  className?: string;
};

/* ── Constants ────────────────────────────────────────────────── */

const EASE_OUT = [0, 0, 0.15, 1] as const;

/** Long enough to read as a turn, short enough not to be waited on. */
const TURN_DURATION = 0.34;

/* ── PageView ─────────────────────────────────────────────────── */

type PageViewProps = {
  sheet: Sheet;
  width: number;
  height: number;
  children?: React.ReactNode;
};

const PageView = ({ sheet, width, height, children }: PageViewProps): React.ReactElement => {
  const slot = usePageSlot(sheet.element ?? null);

  return (
    <div className="relative shrink-0 overflow-hidden bg-surface" style={{ width, height }}>
      {sheet.element ? <div ref={slot} className="absolute inset-0" /> : sheet.node}
      {children}
    </div>
  );
};

/* ── Setting state ────────────────────────────────────────────── */

const Setting = (): React.ReactElement => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">Setting the page</div>
  </div>
);

/* ── PagedSurface ─────────────────────────────────────────────── */

const PagedSurface = ({
  containerRef,
  format,
  sheets,
  index,
  onTurn,
  coverAlone = false,
  footer,
  onExit,
  className = '',
}: PagedSurfaceProps): React.ReactElement => {
  const total = sheets.length;

  const turn = React.useMemo<TurnModel>(() => ({ perTurn: format.perTurn, coverAlone }), [format.perTurn, coverAlone]);

  const turnTo = React.useCallback(
    (target: number): void => {
      onTurn(Math.max(0, Math.min(target, Math.max(total - 1, 0))));
    },
    [onTurn, total],
  );

  const handlers = React.useMemo(
    () => ({
      next: () => turnTo(nextFrom(index, turn, total)),
      previous: () => turnTo(previousFrom(index, turn)),
      first: () => turnTo(0),
      last: () => turnTo(total - 1),
      exit: onExit,
    }),
    [index, turn, total, turnTo, onExit],
  );

  useKeyboardTurns(handlers);
  useTouchTurns(containerRef, handlers);
  useClickTurns(containerRef, handlers);

  const start = spreadStart(index, turn);
  const visible = sheets.slice(start, start + pagesShown(start, turn));

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full select-none items-center justify-center overflow-hidden bg-surface-sunken ${className}`}
    >
      {total === 0 ? (
        <Setting />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={start}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: TURN_DURATION, ease: EASE_OUT }}
            className="flex"
            style={{ gap: format.gutter }}
          >
            {visible.map((sheet, offset) => {
              const pageIndex = start + offset;
              return (
                <PageView key={sheet.key} sheet={sheet} width={format.page.width} height={format.page.height}>
                  {footer?.({ index: pageIndex, total, isLast: pageIndex === total - 1, sheet })}
                </PageView>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

/* ── Turn arithmetic ──────────────────────────────────────────── */

const nextFrom = (index: number, turn: TurnModel, total: number): number => {
  const start = spreadStart(index, turn);
  return Math.min(start + pagesShown(start, turn), Math.max(total - 1, 0));
};

const previousFrom = (index: number, turn: TurnModel): number => {
  const start = spreadStart(index, turn);
  return start <= 0 ? 0 : spreadStart(start - 1, turn);
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { Sheet, PagedSurfaceProps, PageFooterArgs };
export { PagedSurface, PageView };
