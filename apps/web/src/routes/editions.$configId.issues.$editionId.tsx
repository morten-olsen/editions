import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { ReadingShell } from "../components/app-shell.tsx";
import { Button } from "../components/button.tsx";
import { Separator } from "../components/separator.tsx";
import { ArticleCard } from "../components/article-card.tsx";

type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  readingTimeSeconds: number | null;
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

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "< 1 min" : `${minutes} min read`;
};

const EditionViewPage = (): React.ReactNode => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { configId, editionId } = Route.useParams();
  const [edition, setEdition] = useState<EditionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRead, setIsRead] = useState(false);

  const loadEdition = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;

    const hdrs = { Authorization: `Bearer ${auth.token}` };
    const { data, error: err } = await client.GET("/api/editions/{editionId}", {
      params: { path: { editionId } },
      headers: hdrs,
    });

    if (err) {
      setError("Edition not found");
    } else {
      const ed = data as EditionDetail;
      setEdition(ed);
      setIsRead(!!ed.readAt);

      // Mark as read on open
      if (!ed.readAt) {
        setIsRead(true);
        void client.PUT("/api/editions/{editionId}/read", {
          params: { path: { editionId } },
          body: { read: true },
          headers: hdrs,
        });
      }
    }
    setLoading(false);
  }, [auth, editionId]);

  useEffect(() => {
    void loadEdition();
  }, [loadEdition]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

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

  const handleDelete = async (): Promise<void> => {
    if (!edition) return;
    if (!confirm(`Delete "${edition.title}"?`)) return;

    await client.DELETE("/api/editions/{editionId}", {
      params: { path: { editionId } },
      headers,
    });
    await navigate({ to: "/editions/$configId", params: { configId } });
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (!edition) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {error ?? "Edition not found"}
          </div>
          <Link to="/editions/$configId" params={{ configId }}>
            <Button variant="ghost" size="sm">Go back</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Group articles by focus section, maintaining order
  const sections: FocusSection[] = [];
  const sectionMap = new Map<string, FocusSection>();

  for (const article of edition.articles) {
    let section = sectionMap.get(article.focusId);
    if (!section) {
      section = { focusId: article.focusId, focusName: article.focusName, articles: [] };
      sectionMap.set(article.focusId, section);
      sections.push(section);
    }
    section.articles.push(article);
  }

  const editionHeader = (
    <header className="border-b border-border bg-surface">
      <div className="max-w-prose mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/editions/$configId" params={{ configId }}>
          <Button variant="ghost" size="sm">← Back</Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-xs text-ink-tertiary">
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
            onClick={() => void handleDelete()}
            className="text-xs text-ink-tertiary hover:text-critical transition-colors duration-fast cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </header>
  );

  return (
    <ReadingShell header={editionHeader}>
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
            (sum, a) => sum + (a.readingTimeSeconds ?? 0),
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
                      readingTimeSeconds={article.readingTimeSeconds}
                      href={`/sources/${article.sourceId}/articles/${article.id}`}
                    />
                  ))}
                </div>
              </section>
            </div>
          );
        })
      )}

      {/* Completion */}
      {edition.articles.length > 0 && (
        <>
          <Separator />
          <div className="py-16 text-center">
            <div className="font-serif text-2xl text-ink mb-2">
              You're all caught up
            </div>
            <div className="text-sm text-ink-tertiary">
              {edition.articleCount} articles
              {edition.totalReadingMinutes && ` · ${edition.totalReadingMinutes} minutes well spent`}
            </div>
          </div>
        </>
      )}
    </ReadingShell>
  );
};

const Route = createFileRoute("/editions/$configId/issues/$editionId")({
  component: EditionViewPage,
});

export { Route };
