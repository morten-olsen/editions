/**
 * Edition — Magazine sheets
 *
 * Assembles an issue into an ordered run of pages: the cover, the contents,
 * then each focus announced by a divider and followed by its articles, and a
 * last page that says so.
 *
 * Designed pages are React; article pages are typeset by the layout engine
 * against the same page box. The reader turns both the same way, so where one
 * ends and the other begins is invisible.
 */

import * as React from 'react';
import type { LayoutResult } from '@editions/layout-engine';

import {
  MagazineCover,
  MagazineFinale,
  MagazineSection,
  MagazineToc,
  type TocSection,
} from '../../components/magazine/magazine.tsx';
import { articleContent, bodyLayout, openerLayout, useArticlePagination } from '../../components/reader/reader.ts';
import type { PaginatedArticle, Sheet, Size } from '../../components/reader/reader.ts';

import type { EditionArticle, EditionDetail, FocusSection } from './edition-types.ts';

/* ── Types ────────────────────────────────────────────────────── */

/** Where an article's pages sit in the issue, for progress and marking read. */
type ArticleSpan = {
  article: EditionArticle;
  firstPage: number;
  lastPage: number;
};

type MagazineSheetsArgs = {
  edition: EditionDetail;
  sections: FocusSection[];
  page: Size;
  enabled: boolean;
  onNavigate: (page: number) => void;
  onMarkDone: () => void;
};

type MagazineSheets = {
  sheets: Sheet[];
  /** Which article each page belongs to, keyed by page index. */
  spans: ArticleSpan[];
  /** The contents listing, for the contents page and the panel alike. */
  contents: TocSection[];
};

/* ── Constants ────────────────────────────────────────────────── */

const LAYOUTS = [openerLayout, bodyLayout];

/* ── Private helpers ──────────────────────────────────────────── */

const readingMinutes = (articles: EditionArticle[]): number =>
  Math.round(articles.reduce((total, article) => total + (article.consumptionTimeSeconds ?? 0), 0) / 60);

const allArticles = (sections: FocusSection[]): EditionArticle[] => sections.flatMap((section) => section.articles);

/* ── Public functions ─────────────────────────────────────────── */

/**
 * Typeset every article in the issue and interleave the designed pages.
 *
 * Runs whenever the page box changes — a resize re-typesets the whole issue,
 * which is also what keeps the reader's place meaningful across formats.
 */
const useMagazineSheets = ({
  edition,
  sections,
  page,
  enabled,
  onNavigate,
  onMarkDone,
}: MagazineSheetsArgs): MagazineSheets => {
  const articles = React.useMemo(() => allArticles(sections), [sections]);

  const toTypeset = React.useMemo<PaginatedArticle[]>(
    () => articles.map((article) => ({ id: article.id, content: articleContent(article) })),
    [articles],
  );

  const typeset = useArticlePagination({ articles: toTypeset, layouts: LAYOUTS, page, enabled });

  return React.useMemo(
    () => assemble({ edition, sections, typeset, onNavigate, onMarkDone }),
    [edition, sections, typeset, onNavigate, onMarkDone],
  );
};

type AssembleArgs = {
  edition: EditionDetail;
  sections: FocusSection[];
  typeset: Map<string, LayoutResult[]>;
  onNavigate: (page: number) => void;
  onMarkDone: () => void;
};

const assemble = ({ edition, sections, typeset, onNavigate, onMarkDone }: AssembleArgs): MagazineSheets => {
  const sheets: Sheet[] = [];
  const spans: ArticleSpan[] = [];

  // Contents needs page numbers, which aren't known until everything is laid
  // out — so the run is built first and the contents page filled in after.
  const contentsIndex = 1;
  const contents: TocSection[] = [];

  sheets.push({ key: 'cover', node: null });
  sheets.push({ key: 'contents', node: null });

  sections.forEach((section, sectionIndex) => {
    const sectionPage = sheets.length;
    sheets.push({
      key: `section-${sectionIndex}`,
      node: (
        <MagazineSection
          focusName={section.focusName}
          index={sectionIndex}
          articleCount={section.articles.length}
          totalReadingMinutes={readingMinutes(section.articles)}
        />
      ),
    });

    const entries: TocSection['articles'] = [];

    for (const article of section.articles) {
      const pages = typeset.get(article.id) ?? [];
      const firstPage = sheets.length;

      pages.forEach((result, position) => {
        sheets.push({ key: `article-${article.id}-${position}`, element: result.el });
      });

      // The contents needs where each article actually opens — an article runs
      // to as many pages as it needs, so it can't be counted off the section.
      entries.push({
        title: article.title,
        sourceName: article.sourceName,
        consumptionTimeSeconds: article.consumptionTimeSeconds,
        sourceType: article.sourceType,
        page: firstPage,
      });

      spans.push({ article, firstPage, lastPage: Math.max(firstPage, sheets.length - 1) });
    }

    contents.push({ focusName: section.focusName, startPage: sectionPage, articles: entries });
  });

  sheets.push({
    key: 'finale',
    node: (
      <MagazineFinale
        articleCount={edition.articleCount}
        totalReadingMinutes={edition.totalReadingMinutes ?? 0}
        editionTitle={edition.title}
        onMarkDone={onMarkDone}
      />
    ),
  });

  const lead = edition.articles[0] ?? { title: edition.title, sourceName: '' };
  const highlights = sections
    .slice(1, 3)
    .map((section) => section.articles[0])
    .filter((article): article is EditionArticle => article !== undefined);

  sheets[0] = {
    key: 'cover',
    node: (
      <MagazineCover
        editionTitle={edition.title}
        date={edition.publishedAt}
        totalReadingMinutes={edition.totalReadingMinutes ?? 0}
        articleCount={edition.articleCount}
        focusCount={sections.length}
        lead={lead}
        highlights={highlights}
      />
    ),
  };

  sheets[contentsIndex] = {
    key: 'contents',
    node: <MagazineToc editionTitle={edition.title} sections={contents} onNavigate={onNavigate} />,
  };

  return { sheets, spans, contents };
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { ArticleSpan, MagazineSheets, MagazineSheetsArgs };
export { useMagazineSheets };
