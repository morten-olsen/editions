import { useState, useCallback, useRef } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
import { ReadingShell } from "../components/app-shell.tsx";
import { Button } from "../components/button.tsx";
import { Separator } from "../components/separator.tsx";
import { ArticleCard } from "../components/article-card.tsx";
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

type ViewMode = "list" | "magazine";

/* ── Helpers ──────────────────────────────────────────────────────── */

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "< 1 min" : `${minutes} min read`;
};

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

/* ── Magazine view wrapper ────────────────────────────────────────── */

type MagazineViewProps = {
  edition: EditionDetail;
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  onVote: (articleId: string, value: VoteValue) => void;
  onMarkArticleViewed: (sourceId: string, articleId: string) => void;
  onExit: () => void;
  onMarkDone: () => void;
};

const MagazineView = ({ edition, sections, votes, onVote, onMarkArticleViewed, onExit, onMarkDone }: MagazineViewProps): React.ReactElement => {
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

  // Intercept all page changes — mark the current page's article as viewed before advancing
  const handlePageChange = useCallback((newPage: number): void => {
    const articleInfo = pageArticleMap.current.get(pageRef.current);
    if (articleInfo && newPage !== pageRef.current) {
      onMarkArticleViewed(articleInfo.sourceId, articleInfo.articleId);
    }
    pageRef.current = newPage;
    setPage(newPage);
  }, [onMarkArticleViewed]);

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
          onFocusVote={(value) => onVote(article.id, value)}
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
      onMarkDone={onMarkDone}
    />,
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface">
      {/* Exit button — fixed top-left, above the magazine */}
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

/* ── Main component ───────────────────────────────────────────────── */

const EditionViewPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const { configId, editionId } = Route.useParams();
  const [isRead, setIsRead] = useState(false);
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [view, setView] = useState<ViewMode>("list");

  const queryKey = queryKeys.editions.detail(editionId);

  const { data: edition, isLoading, error } = useQuery<EditionDetail>({
    queryKey,
    queryFn: async (): Promise<EditionDetail> => {
      const { data, error: err } = await client.GET("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });

      if (err) {
        throw new Error("Edition not found");
      }

      return data as EditionDetail;
    },
    enabled: !!headers,
  });

  // Initialize local state from query data
  const [initialized, setInitialized] = useState(false);
  if (edition && !initialized) {
    setIsRead(!!edition.readAt);
    setInitialized(true);
  }

  const handleToggleRead = async (): Promise<void> => {
    if (!edition) return;
    const newRead = !isRead;
    setIsRead(newRead);
    await client.PUT("/api/editions/{editionId}/read", {
      params: { path: { editionId } },
      body: { read: newRead },
      headers,
    });
  };

  const handleMarkDoneAndBack = async (): Promise<void> => {
    if (!edition) return;
    if (!isRead) {
      setIsRead(true);
      await client.PUT("/api/editions/{editionId}/read", {
        params: { path: { editionId } },
        body: { read: true },
        headers,
      });
    }
    await navigate({ to: "/editions/$configId", params: { configId } });
  };

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.DELETE("/api/editions/{editionId}", {
        params: { path: { editionId } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void navigate({ to: "/editions/$configId", params: { configId } });
    },
  });

  const handleDelete = (): void => {
    if (!edition) return;
    if (!confirm(`Delete "${edition.title}"?`)) return;
    deleteMutation.mutate();
  };

  const handleEditionVote = async (articleId: string, value: VoteValue): Promise<void> => {
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
  };

  const handleMarkArticleViewed = async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  };

  const handleExitMagazine = useCallback((): void => setView("list"), []);

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
          <Button variant="ghost" size="sm" onClick={() => router.history.back()}>Go back</Button>
        </div>
      </div>
    );
  }

  const sections = groupByFocus(edition.articles);

  /* ── Magazine view ──────────────────────────────────────────────── */

  if (view === "magazine") {
    return (
      <MagazineView
        edition={edition}
        sections={sections}
        votes={votes}
        onVote={(articleId, value) => void handleEditionVote(articleId, value)}
        onMarkArticleViewed={(sourceId, articleId) => void handleMarkArticleViewed(sourceId, articleId)}
        onExit={handleExitMagazine}
        onMarkDone={() => void handleMarkDoneAndBack()}
      />
    );
  }

  /* ── List view (default) ────────────────────────────────────────── */

  const editionHeader = (
    <header className="border-b border-border bg-surface">
      <div className="max-w-prose mx-auto px-4 py-4 md:px-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>← Back</Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-xs text-ink-tertiary">
            {edition.articleCount} articles
            {edition.totalReadingMinutes && ` · ${edition.totalReadingMinutes} min`}
          </div>
          <button
            type="button"
            onClick={() => void handleToggleRead()}
            className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
          >
            {isRead ? "Mark unread" : "Mark read"}
          </button>
          <button
            type="button"
            onClick={() => handleDelete()}
            className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </header>
  );

  // Find the first article with an image for the magazine promo
  const promoImage = edition.articles.find((a) => a.imageUrl)?.imageUrl;

  return (
    <ReadingShell header={editionHeader}>
      {/* Magazine promo — prominent entry point */}
      {edition.articles.length > 0 && (
        <button
          onClick={() => setView("magazine")}
          className="group relative w-full rounded-lg overflow-hidden mb-12 text-left cursor-pointer transition-shadow duration-normal hover:shadow-lg"
        >
          {/* Background image */}
          {promoImage && (
            <div className="absolute inset-0">
              <img src={promoImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/70 to-black/50" />
            </div>
          )}

          {/* Fallback solid background when no image */}
          {!promoImage && (
            <div className="absolute inset-0 bg-linear-to-r from-accent/15 to-accent/5" />
          )}

          <div className={`relative flex items-center justify-between gap-6 px-6 py-5 ${promoImage ? "text-white" : ""}`}>
            <div className="min-w-0">
              <div className={`text-xs font-mono tracking-wide mb-1.5 ${promoImage ? "text-white/60" : "text-accent"}`}>
                Magazine experience
              </div>
              <div className={`font-serif text-lg leading-snug ${promoImage ? "text-white" : "text-ink"}`}>
                Read this edition as an immersive magazine
              </div>
              <div className={`text-xs mt-1 ${promoImage ? "text-white/50" : "text-ink-tertiary"}`}>
                {edition.articleCount} articles · {edition.totalReadingMinutes ?? "?"} min · page-by-page
              </div>
            </div>
            <div className={`shrink-0 text-sm font-medium tracking-wide px-4 py-2 rounded-full transition-all duration-normal
              ${promoImage
                ? "bg-white/15 text-white group-hover:bg-white/25 border border-white/20"
                : "bg-accent text-accent-ink group-hover:bg-accent-hover"
              }`}
            >
              Open →
            </div>
          </div>
        </button>
      )}

      {/* Edition title */}
      <div className="mb-12">
        <div className="text-xs text-ink-tertiary tracking-wide uppercase mb-3">
          {new Date(edition.publishedAt).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink leading-tight mb-3">
          {edition.title}
        </h1>
        <div className="text-sm text-ink-secondary">
          {edition.articleCount} articles across {sections.length} {sections.length === 1 ? "focus" : "focuses"}
          {edition.totalReadingMinutes && ` · approximately ${edition.totalReadingMinutes} minutes`}
        </div>
      </div>

      {/* Sections */}
      {edition.articles.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-tertiary">
          No articles matched the criteria for this edition.
        </div>
      ) : (
        sections.map((section, i) => {
          const totalSeconds = section.articles.reduce(
            (sum, a) => sum + (a.consumptionTimeSeconds ?? 0),
            0,
          );

          return (
            <div key={section.focusId}>
              {i > 0 && <Separator soft />}
              <section className="py-8">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs font-mono text-accent tracking-wide">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="font-serif text-xl font-medium tracking-tight text-ink">
                      {section.focusName}
                    </h2>
                  </div>
                  <div className="text-xs text-ink-tertiary">
                    {section.articles.length} {section.articles.length === 1 ? "article" : "articles"}
                    {totalSeconds > 0 && ` · ${formatTime(totalSeconds)}`}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {section.articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      id={article.id}
                      title={article.title}
                      sourceName={article.sourceName}
                      author={article.author}
                      summary={article.summary}
                      imageUrl={article.imageUrl}
                      publishedAt={article.publishedAt}
                      consumptionTimeSeconds={article.consumptionTimeSeconds}
                      sourceType={article.sourceType}
                      read={!!article.readAt}
                      href={`/sources/${article.sourceId}/articles/${article.id}`}
                      focusVote={votes[article.id] ?? null}
                      onFocusVote={(value) => void handleEditionVote(article.id, value)}
                    />
                  ))}
                </div>
              </section>
            </div>
          );
        })
      )}

      {/* Completion */}
      <Separator soft className="mt-12" />
      <div className="py-10 text-center">
        <div className="font-serif text-xl text-ink mb-3">
          End of edition
        </div>
        <div className="text-sm text-ink-tertiary mb-6">
          {edition.articleCount} articles
          {edition.totalReadingMinutes && ` · ${edition.totalReadingMinutes} minutes`}
        </div>
        <Button variant="primary" size="sm" onClick={() => void handleMarkDoneAndBack()}>
          Done
        </Button>
      </div>
    </ReadingShell>
  );
};

const Route = createFileRoute("/editions/$configId/issues/$editionId")({
  component: EditionViewPage,
});

export { Route };
