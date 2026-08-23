/**
 * Reader — Paged article
 *
 * An article as a finite set of pages. Every layout reserves a band at the
 * foot of the page; the folio lives there on every page, and whatever actions
 * the surrounding surface wants appear there on the last one — so a reader
 * meets them at the end of the piece rather than beside it.
 */

import * as React from 'react';

import { articleContent, type ArticleInput } from './reader.content.ts';
import { bodyLayout, openerLayout, FOOTER_SPACE } from './reader.layouts.ts';
import { PagedReader } from './reader.paged.tsx';
import type { PageFooterArgs } from './reader.surface.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type PagedArticleProps = {
  article: ArticleInput;
  /** Shown in the footer band of the final page. */
  footer?: React.ReactNode;
  /** Anything that belongs on every page — a media player, say. */
  onExit?: () => void;
  onTurn?: (index: number) => void;
  initialPage?: number;
  className?: string;
};

/* ── Constants ────────────────────────────────────────────────── */

const LAYOUTS = [openerLayout, bodyLayout];

/* ── Folio ────────────────────────────────────────────────────── */

type FolioProps = {
  index: number;
  total: number;
};

const Folio = ({ index, total }: FolioProps): React.ReactElement => (
  <div className="font-mono text-[10px] tracking-widest text-ink-faint tabular-nums">
    {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
  </div>
);

/* ── PagedArticle ─────────────────────────────────────────────── */

const PagedArticle = ({
  article,
  footer,
  onExit,
  onTurn,
  initialPage,
  className,
}: PagedArticleProps): React.ReactElement => {
  const content = React.useMemo(() => articleContent(article), [article]);

  const renderFooter = React.useCallback(
    ({ index, total, isLast }: PageFooterArgs): React.ReactNode => (
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-3 px-6 pb-4"
        style={{ height: FOOTER_SPACE }}
      >
        {isLast && footer}
        <Folio index={index} total={total} />
      </div>
    ),
    [footer],
  );

  return (
    <PagedReader
      content={content}
      layouts={LAYOUTS}
      footer={renderFooter}
      onExit={onExit}
      onTurn={onTurn}
      initialPage={initialPage}
      className={className}
    />
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { PagedArticleProps };
export { PagedArticle, Folio };
