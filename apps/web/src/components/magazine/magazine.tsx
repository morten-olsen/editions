/**
 * Magazine
 *
 * The designed pages of an issue. Articles between them are typeset by the
 * reader; these are the compositions that give an edition its shape — the
 * cover it opens on, the contents, the divider announcing each focus, and the
 * page that tells the reader they have finished.
 */

export type { MagazinePageProps, MagazineNavContext, TocEntry } from './magazine.layout.tsx';
export { MagazinePage, MagazineNavProvider, useMagazineNav } from './magazine.layout.tsx';

export type { MagazineCoverProps, CoverArticle } from './magazine.cover.tsx';
export { MagazineCover } from './magazine.cover.tsx';

export type { MagazineTocProps, TocSection, TocArticle } from './magazine.toc.tsx';
export { MagazineToc } from './magazine.toc.tsx';

export type { ContentsButtonProps, ContentsPanelProps } from './magazine.contents.tsx';
export { ContentsButton, ContentsPanel } from './magazine.contents.tsx';

export type { MagazineSectionProps } from './magazine.section.tsx';
export { MagazineSection } from './magazine.section.tsx';

export type { MagazineFinaleProps } from './magazine.finale.tsx';
export { MagazineFinale } from './magazine.finale.tsx';
