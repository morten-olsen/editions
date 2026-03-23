import { useCallback, useRef, useEffect } from 'react';

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
import { useMagazineProgress } from './edition-magazine-progress.ts';

type MagazineViewProps = {
  edition: EditionDetail;
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  bookmarkedIds: Set<string>;
  onVote: (articleId: string, value: VoteValue) => void;
  onBookmarkToggle: (articleId: string) => void;
  onMarkArticleViewed: (sourceId: string, articleId: string) => void;
  onExit: () => void;
  onMarkDone: () => void;
};

/* ---- Helpers ---- */

const buildTocData = (
  sections: FocusSection[],
): { tocSections: { focusName: string; articles: EditionArticle[]; startPage: number }[]; toc: TocEntry[] } => {
  let pageIdx = 2;
  const tocSections = sections.map((s) => {
    const startPage = pageIdx;
    pageIdx += 1 + s.articles.length;
    return { focusName: s.focusName, articles: s.articles, startPage };
  });
  const toc: TocEntry[] = tocSections.map((s) => ({
    sectionName: s.focusName,
    sectionPage: s.startPage,
    articles: s.articles.map((a, aIdx) => ({ title: a.title, page: s.startPage + aIdx + 1 })),
  }));
  return { tocSections, toc };
};

const buildPageArticleMap = (sections: FocusSection[]): Map<number, { sourceId: string; articleId: string }> => {
  const map = new Map<number, { sourceId: string; articleId: string }>();
  let idx = 2;
  sections.forEach((section) => {
    idx += 1;
    section.articles.forEach((article) => {
      map.set(idx, { sourceId: article.sourceId, articleId: article.id });
      idx += 1;
    });
  });
  return map;
};

const buildSectionPages = (
  sections: FocusSection[],
  votes: Record<string, VoteValue>,
  bookmarkedIds: Set<string>,
  onVote: (articleId: string, value: VoteValue) => void,
  onBookmarkToggle: (articleId: string) => void,
): React.ReactElement[] => {
  const pages: React.ReactElement[] = [];
  sections.forEach((section, sIdx) => {
    const mins = Math.round(section.articles.reduce((sum, a) => sum + (a.consumptionTimeSeconds ?? 0), 0) / 60);
    pages.push(
      <MagazineSection
        key={`section-${sIdx}`}
        focusName={section.focusName}
        index={sIdx}
        articleCount={section.articles.length}
        totalReadingMinutes={mins}
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
          vote={votes[article.id] ?? null}
          onVote={(value) => onVote(article.id, value)}
          voteLabel="Edition"
          bookmarked={bookmarkedIds.has(article.id)}
          onBookmarkToggle={() => onBookmarkToggle(article.id)}
        />,
      );
    });
  });
  return pages;
};

/* ---- Component ---- */

const MagazineView = ({
  edition,
  sections,
  votes,
  bookmarkedIds,
  onVote,
  onBookmarkToggle,
  onMarkArticleViewed,
  onExit,
  onMarkDone,
}: MagazineViewProps): React.ReactElement => {
  const { page, setPage, savePage } = useMagazineProgress(edition.id);
  const pageRef = useRef(page);
  const pageArticleMap = useRef<Map<number, { sourceId: string; articleId: string }>>(new Map());

  const { tocSections, toc } = buildTocData(sections);
  pageArticleMap.current = buildPageArticleMap(sections);

  const handlePageChange = useCallback(
    (newPage: number): void => {
      const articleInfo = pageArticleMap.current.get(pageRef.current);
      if (articleInfo && newPage !== pageRef.current) {
        onMarkArticleViewed(articleInfo.sourceId, articleInfo.articleId);
      }
      pageRef.current = newPage;
      setPage(newPage);
      savePage(newPage);
    },
    [onMarkArticleViewed, setPage, savePage],
  );

  /* Escape exits magazine */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  const leadArticle = edition.articles[0] ?? { title: edition.title, sourceName: '' };
  const highlightArticles = sections
    .slice(1, 3)
    .map((s) => s.articles[0])
    .filter((a): a is EditionArticle => !!a);

  const pages: React.ReactElement[] = [
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
    <MagazineToc key="toc" editionTitle={edition.title} sections={tocSections} onNavigate={handlePageChange} />,
    ...buildSectionPages(sections, votes, bookmarkedIds, onVote, onBookmarkToggle),
    <MagazineFinale
      key="finale"
      articleCount={edition.articleCount}
      totalReadingMinutes={edition.totalReadingMinutes ?? 0}
      editionTitle={edition.title}
      onMarkDone={onMarkDone}
    />,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-surface">
      <button
        onClick={onExit}
        className="fixed top-4 left-4 z-[60] text-xs font-mono tracking-wide px-3 py-1.5 rounded-full bg-surface/80 text-ink-tertiary hover:text-ink backdrop-blur-sm border border-border transition-colors duration-fast cursor-pointer"
      >
        ← Exit magazine
      </button>
      <MagazineLayout page={page} onPageChange={handlePageChange} toc={toc}>
        {pages}
      </MagazineLayout>
    </div>
  );
};

export type { MagazineViewProps };
export { MagazineView };
