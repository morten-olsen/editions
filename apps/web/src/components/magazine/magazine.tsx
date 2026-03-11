/**
 * Magazine View
 *
 * A paginated, Wired-inspired reading experience for editions.
 * Each page takes the full viewport — cover, TOC, section dividers,
 * and article spreads with alternating layout variants.
 */

export type { MagazineLayoutProps, MagazinePageProps, MagazineNavContext, TocEntry } from "./magazine.layout.tsx";
export { MagazineLayout, MagazinePage, useMagazineNav } from "./magazine.layout.tsx";

export type { MagazineCoverProps, CoverArticle } from "./magazine.cover.tsx";
export { MagazineCover } from "./magazine.cover.tsx";

export type { MagazineTocProps, TocSection, TocArticle } from "./magazine.toc.tsx";
export { MagazineToc } from "./magazine.toc.tsx";

export type { MagazineSectionProps } from "./magazine.section.tsx";
export { MagazineSection } from "./magazine.section.tsx";

export type { MagazineArticleProps } from "./magazine.article.tsx";
export { MagazineArticle } from "./magazine.article.tsx";

export type { MagazineFinaleProps } from "./magazine.finale.tsx";
export { MagazineFinale } from "./magazine.finale.tsx";
