import { useState, useCallback, useRef } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { Button } from "../components/button.tsx";
import type { VoteValue } from "../components/vote-controls.tsx";
import {
  MagazineLayout,
  MagazineCover,
  MagazineToc,
  MagazineSection,
  MagazineArticle,
  MagazineFinale,
  type TocEntry,
} from "../components/magazine/magazine.tsx";

/* ── Types ────────────────────────────────────────────────────────── */

type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt?: string | null;
  progress: number;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type EditionDetail = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  articles: EditionArticle[];
};

type FocusSection = {
  focusId: string;
  focusName: string;
  articles: EditionArticle[];
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const groupByFocus = (articles: EditionArticle[]): FocusSection[] => {
  const sections: FocusSection[] = [];
  const map = new Map<string, FocusSection>();
  for (const article of articles) {
    let section = map.get(article.focusId);
    if (!section) {
      section = { focusId: article.focusId, focusName: article.focusName, articles: [] };
      map.set(article.focusId, section);
      sections.push(section);
    }
    section.articles.push(article);
  }
  return sections;
};

/* ── Magazine page component ──────────────────────────────────────── */

const MagazinePage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const navigate = useNavigate();
  const { editionId } = Route.useParams();
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});

  const { data: edition, isLoading, error } = useQuery<EditionDetail>({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async (): Promise<EditionDetail> => {
      const { data, error: err } = await client.GET("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
      if (err) throw new Error("Edition not found");
      return data as EditionDetail;
    },
    enabled: !!headers,
  });

  const handleExit = useCallback((): void => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/" });
    }
  }, [router.history, navigate]);

  const handleMarkDone = useCallback(async (): Promise<void> => {
    await client.PUT("/api/editions/{editionId}/read", {
      params: { path: { editionId } },
      body: { read: true },
      headers,
    });
    if (window.history.length > 1) {
      router.history.back();
    } else {
      await navigate({ to: "/" });
    }
  }, [editionId, headers, router.history, navigate]);

  const handleVote = useCallback(async (articleId: string, value: VoteValue): Promise<void> => {
    setVotes((prev) => ({ ...prev, [articleId]: value }));
    if (value === null) {
      await client.DELETE("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        headers,
      });
    } else {
      await client.PUT("/api/editions/{editionId}/articles/{articleId}/vote", {
        params: { path: { editionId, articleId } },
        body: { value },
        headers,
      });
    }
  }, [editionId, headers]);

  const handleMarkArticleViewed = useCallback(async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  }, [headers]);

  if (!headers || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (error || !edition) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {error instanceof Error ? error.message : "Edition not found"}
          </div>
          <Button variant="ghost" size="sm" onClick={handleExit}>Go back</Button>
        </div>
      </div>
    );
  }

  const sections = groupByFocus(edition.articles);

  // Build pages
  const pages: React.ReactElement[] = [];

  let pageIdx = 2;
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

  // Build page→article map for marking viewed on navigation
  const pageArticleMap = new Map<number, { sourceId: string; articleId: string }>();
  let articlePageIdx = 2;
  sections.forEach((section) => {
    articlePageIdx += 1;
    section.articles.forEach((article) => {
      pageArticleMap.set(articlePageIdx, { sourceId: article.sourceId, articleId: article.id });
      articlePageIdx += 1;
    });
  });

  const handlePageChange = (newPage: number): void => {
    const articleInfo = pageArticleMap.get(pageRef.current);
    if (articleInfo && newPage !== pageRef.current) {
      void handleMarkArticleViewed(articleInfo.sourceId, articleInfo.articleId);
    }
    pageRef.current = newPage;
    setPage(newPage);
  };

  // Cover
  const leadArticle = edition.articles[0] ?? { title: edition.title, sourceName: "" };
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

  // TOC
  pages.push(
    <MagazineToc
      key="toc"
      editionTitle={edition.title}
      sections={tocSections}
      onNavigate={handlePageChange}
    />,
  );

  // Sections + articles
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
          onFocusVote={(value) => void handleVote(article.id, value)}
        />,
      );
    });
  });

  // Finale
  pages.push(
    <MagazineFinale
      key="finale"
      articleCount={edition.articleCount}
      totalReadingMinutes={edition.totalReadingMinutes ?? 0}
      editionTitle={edition.title}
      onMarkDone={() => void handleMarkDone()}
    />,
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface">
      <button
        onClick={handleExit}
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

const Route = createFileRoute("/editions/$configId/issues/$editionId/magazine")({
  component: MagazinePage,
});

export { Route };
