/**
 * Reader — Paged document
 *
 * Typesets one stream of content into pages and hands them to the surface.
 * This is the single-document case: an article on its own. A magazine, which
 * mixes typeset articles with designed pages, composes sheets itself and uses
 * the surface directly.
 */

import * as React from 'react';
import type { Content, LayoutFn } from '@editions/layout-engine';

import { formatFor } from './reader.format.ts';
import { useElementSize, useFontsReady, usePagination } from './reader.hooks.ts';
import { PagedSurface, type PageFooterArgs, type Sheet } from './reader.surface.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type PagedReaderProps = {
  content: Content[];
  layouts: LayoutFn[];
  footer?: (args: PageFooterArgs) => React.ReactNode;
  onTurn?: (index: number) => void;
  /** Starting page, for restoring a reader's place. */
  initialPage?: number;
  onExit?: () => void;
  coverAlone?: boolean;
  className?: string;
};

/* ── PagedReader ──────────────────────────────────────────────── */

const PagedReader = ({
  content,
  layouts,
  footer,
  onTurn,
  initialPage = 0,
  onExit,
  coverAlone = false,
  className,
}: PagedReaderProps): React.ReactElement => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const fontsReady = useFontsReady();

  const format = React.useMemo(() => formatFor(size), [size]);
  const pages = usePagination({ content, layouts, page: format.page, enabled: fontsReady });

  const [index, setIndex] = React.useState(initialPage);

  // A reflow can leave the reader past the end.
  React.useEffect(() => {
    setIndex((current) => (pages.length === 0 ? 0 : Math.min(current, pages.length - 1)));
  }, [pages.length]);

  const sheets = React.useMemo<Sheet[]>(
    () => pages.map((page, position) => ({ key: `page-${position}`, element: page.el })),
    [pages],
  );

  const handleTurn = React.useCallback(
    (next: number): void => {
      setIndex(next);
      onTurn?.(next);
    },
    [onTurn],
  );

  return (
    <PagedSurface
      containerRef={containerRef}
      format={format}
      sheets={sheets}
      index={index}
      onTurn={handleTurn}
      coverAlone={coverAlone}
      footer={footer}
      onExit={onExit}
      className={className}
    />
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PagedReaderProps };
export { PagedReader };
