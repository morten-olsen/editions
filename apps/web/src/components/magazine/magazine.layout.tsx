/**
 * Magazine — Page frame
 *
 * The designed pages of an issue — cover, contents, section dividers, the last
 * page — are React compositions rather than typeset prose. They fill a page
 * box handed to them by the reading surface, which is also what paginates the
 * articles between them.
 *
 * Turning is the surface's job; the nav context here exists so a composition
 * deep in the tree (the end-of-article prompt, a contents entry) can move the
 * reader without threading callbacks through every layer.
 */

import * as React from 'react';

/* ── Types ────────────────────────────────────────────────────── */

type TocEntry = {
  sectionName: string;
  sectionPage: number;
  articles: { title: string; page: number }[];
};

type MagazineNavContext = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

type MagazinePageProps = {
  children: React.ReactNode;
  className?: string;
  /** Start content at the top rather than centring it. */
  flow?: boolean;
};

/* ── Context ──────────────────────────────────────────────────── */

const MagazineNavCtx = React.createContext<MagazineNavContext | null>(null);

/** Turn pages from anywhere inside the reader. Null outside one. */
const useMagazineNav = (): MagazineNavContext | null => React.useContext(MagazineNavCtx);

const MagazineNavProvider = MagazineNavCtx.Provider;

/* ── MagazinePage ─────────────────────────────────────────────── */

/**
 * A single designed page. Fills the box the surface gives it — never the
 * viewport, since on a spread a page is only half of it.
 */
const MagazinePage = ({ children, className = '', flow = false }: MagazinePageProps): React.ReactElement => (
  <div
    className={`flex h-full flex-col overflow-hidden px-6 py-10 md:px-10 ${
      flow ? 'justify-start' : 'justify-center'
    } ${className}`}
  >
    {children}
  </div>
);

/* ── Exports ──────────────────────────────────────────────────── */

export type { MagazinePageProps, MagazineNavContext, TocEntry };
export { MagazinePage, MagazineNavProvider, useMagazineNav };
