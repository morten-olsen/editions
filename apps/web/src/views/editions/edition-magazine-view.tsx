import { useState, useCallback, useRef } from 'react';

import type { VoteValue } from '../../components/vote-controls.tsx';
import {
  MagazineLayout,
  MagazineCover,
  MagazineToc,
  MagazineSection,
  MagazineArticle,
  MagazineFinale,
  type TocEntry,
} from '../../components/magazine/magazine.tsx';

import type { EditionArticle, EditionDetail, FocusSection } from './edition-types.ts';

type MagazineViewProps = {
  edition: EditionDetail;
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  onVote: (articleId: string, value: VoteValue) => void;
  onMarkArticleViewed: (sourceId: string, articleId: string) => void;
  onExit: () => void;
  onMarkDone: () => void;
};

const MagazineView = ({
  edition,
  sections,
  votes,
  onVote,
  onMarkArticleViewed,
  onExit,
  onMarkDone,
}: MagazineViewProps): React.ReactElement => {
  const [page, setPage] = useState(0);
  const pageRef = useRef(page);

  const pages: React.ReactElement[] = [];

  // Track page numbers for TOC
  let pageIdx = 2; // cover=0, toc=1
  const tocSections = sections.map((s) => {
    const startPage = pageIdx;
    pageIdx += 1 + s.articles.length;
    return { focusName: s.focusName, articles: s.articles, startPage };
  });

  const toc: TocEntry[] = tocSections.map((s) => ({
    sectionName: s.focusName,
    sectionPage: s.startPage,
    articles: s.articles.map((a, aIdx) => ({
      title: a.title,
      page: s.startPage + aIdx + 1,
    })),
  }));

  // Build a lookup from page index to article (for marking as viewed on navigation)
  const pageArticleMap = useRef<Map<number, { sourceId: string; articleId: string }>>(new Map());
  pageArticleMap.current.clear();
  let articlePageIdx = 2;
  sections.forEach((section) => {
    articlePageIdx += 1; // section divider
    section.articles.forEach((article) => {
      pageArticleMap.current.set(articlePageIdx, { sourceId: article.sourceId, articleId: article.id });
      articlePageIdx += 1;
    });
  });

  const handlePageChange = useCallback(
    (newPage: number): void => {
      const articleInfo = pageArticleMap.current.get(pageRef.current);
      if (articleInfo && newPage !== pageRef.current) {
        onMarkArticleViewed(articleInfo.sourceId, articleInfo.articleId);
      }
      pageRef.current = newPage;
      setPage(newPage);
    },
    [onMarkArticleViewed],
  );

  // Cover
  const leadArticle = edition.articles[0] ?? { title: edition.title, sourceName: '' };
  const highlightArticles = sections
    .slice(1, 3)
    .map((s) => s.articles[0])
    .filter((a): a is EditionArticle => !!a);

  pages.push(
    <MagazineCover
      key="cover"
      editionTitle={edition.title}
      date={edition.publishedAt}
      totalReadingMinutes={edition.totalReadingMinutes ?? 0}
      articleCount={edition.articleCount}
      focusCount={sections.length}
      lead={leadArticle}
      highlights={highlightArticles}
    />,
  );

  pages.push(
    <MagazineToc key="toc" editionTitle={edition.title} sections={tocSections} onNavigate={handlePageChange} />,
  );

  // Sections + articles
  buildSectionPages(sections, pages, votes, onVote);

  pages.push(
    <MagazineFinale
      key="finale"
      articleCount={edition.articleCount}
      totalReadingMinutes={edition.totalReadingMinutes ?? 0}
      editionTitle={edition.title}
      onMarkDone={onMarkDone}
    />,
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface">
      <button
        onClick={onExit}
        className="fixed top-4 left-4 z-[60] text-xs font-mono tracking-wide px-3 py-1.5 rounded-full
          bg-surface/80 text-ink-tertiary hover:text-ink backdrop-blur-sm border border-border
          transition-colors duration-fast cursor-pointer"
      >
        ← Exit magazine
      </button>
      <MagazineLayout page={page} onPageChange={handlePageChange} toc={toc}>
        {pages}
      </MagazineLayout>
    </div>
  );
};

const buildSectionPages = (
  sections: FocusSection[],
  pages: React.ReactElement[],
  votes: Record<string, VoteValue>,
  onVote: (articleId: string, value: VoteValue) => void,
): void => {
  sections.forEach((section, sIdx) => {
    const sectionMinutes = Math.round(
      section.articles.reduce((sum, a) => sum + (a.consumptionTimeSeconds ?? 0), 0) / 60,
    );

    pages.push(
      <MagazineSection
        key={`section-${sIdx}`}
        focusName={section.focusName}
        index={sIdx}
        articleCount={section.articles.length}
        totalReadingMinutes={sectionMinutes}
      />,
    );

    section.articles.forEach((article, aIdx) => {
      pages.push(
        <MagazineArticle
          key={`article-${sIdx}-${aIdx}`}
          title={article.title}
          sourceName={article.sourceName}
          author={article.author}
          summary={article.summary}
          publishedAt={article.publishedAt}
          consumptionTimeSeconds={article.consumptionTimeSeconds}
          imageUrl={article.imageUrl}
          content={article.content}
          positionInSection={aIdx}
          sourceType={article.sourceType}
          mediaUrl={article.mediaUrl}
          mediaType={article.mediaType}
          progress={article.progress}
          articleId={article.id}
          focusVote={votes[article.id] ?? null}
          onFocusVote={(value) => onVote(article.id, value)}
        />,
      );
    });
  });
};

export type { MagazineViewProps };
export { MagazineView };
