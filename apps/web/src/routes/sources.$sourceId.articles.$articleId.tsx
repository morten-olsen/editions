import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { BookmarkButton } from "../components/bookmark-button.tsx";
import { ReadingShell } from "../components/app-shell.tsx";
import { Button } from "../components/button.tsx";
import { Separator } from "../components/separator.tsx";
import { VoteControls } from "../components/vote-controls.tsx";
import type { VoteValue } from "../components/vote-controls.tsx";

type ArticleDetail = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  wordCount: number | null;
  readingTimeSeconds: number | null;
  imageUrl: string | null;
  publishedAt: string | null;
  readAt: string | null;
  extractedAt: string | null;
};

const formatReadingTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "< 1 min read";
  return `${minutes} min read`;
};

const formatPublishedDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const ArticlePage = (): React.ReactNode => {
  const auth = useAuth();
  const router = useRouter();
  const { sourceId, articleId } = Route.useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vote, setVote] = useState<VoteValue>(null);
  const [isRead, setIsRead] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const loadArticle = useCallback(async (): Promise<void> => {
    if (auth.status !== "authenticated") return;
    const headers = { Authorization: `Bearer ${auth.token}` };

    const [articleRes, voteRes, bookmarkRes] = await Promise.all([
      client.GET("/api/sources/{id}/articles/{articleId}", {
        params: { path: { id: sourceId, articleId } },
        headers,
      }),
      client.GET("/api/articles/{articleId}/vote", {
        params: { path: { articleId } },
        headers,
      }),
      client.GET("/api/articles/{articleId}/bookmark", {
        params: { path: { articleId } },
        headers,
      }),
    ]);

    if (articleRes.error) {
      setError("Article not found");
    } else {
      const art = articleRes.data as ArticleDetail;
      setArticle(art);
      setIsRead(!!art.readAt);
    }

    if (voteRes.data) {
      const voteData = voteRes.data as { value: 1 | -1 };
      setVote(voteData.value);
    }

    if (bookmarkRes.data) {
      setBookmarked((bookmarkRes.data as { bookmarked: boolean }).bookmarked);
    }

    setLoading(false);
  }, [auth, sourceId, articleId]);

  useEffect(() => {
    void loadArticle();
  }, [loadArticle]);

  if (auth.status === "loading" || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (auth.status !== "authenticated" || !article) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {error ?? "Article not found"}
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const headers = { Authorization: `Bearer ${auth.token}` };

  const handleVote = async (value: VoteValue): Promise<void> => {
    setVote(value);

    if (value === null) {
      await client.DELETE("/api/articles/{articleId}/vote", {
        params: { path: { articleId } },
        headers,
      });
    } else {
      await client.PUT("/api/articles/{articleId}/vote", {
        params: { path: { articleId } },
        body: { value },
        headers,
      });
    }
  };

  const handleToggleBookmark = async (): Promise<void> => {
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);

    if (newBookmarked) {
      await client.PUT("/api/articles/{articleId}/bookmark", {
        params: { path: { articleId } },
        headers,
      });
    } else {
      await client.DELETE("/api/articles/{articleId}/bookmark", {
        params: { path: { articleId } },
        headers,
      });
    }
  };

  const handleToggleRead = async (): Promise<void> => {
    const newRead = !isRead;
    setIsRead(newRead);
    await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
      params: { path: { id: sourceId, articleId } },
      body: { read: newRead },
      headers,
    });
  };

  const handleMarkDoneAndBack = async (): Promise<void> => {
    if (!isRead) {
      setIsRead(true);
      await client.PUT("/api/sources/{id}/articles/{articleId}/read", {
        params: { path: { id: sourceId, articleId } },
        body: { read: true },
        headers,
      });
    }
    router.history.back();
  };

  const hasContent = article.content !== null && article.content.length > 0;

  const headerEl = (
    <header className="border-b border-border bg-surface">
      <div className="max-w-prose mx-auto px-6 py-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          ← Back
        </Button>
        <div className="flex items-center gap-3">
          <BookmarkButton
            bookmarked={bookmarked}
            onToggle={() => void handleToggleBookmark()}
          />
          <button
            type="button"
            onClick={() => void handleToggleRead()}
            className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
          >
            {isRead ? "Mark unread" : "Mark read"}
          </button>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-tertiary hover:text-accent transition-colors duration-fast"
            >
              View original
            </a>
          )}
        </div>
      </div>
    </header>
  );

  return (
    <ReadingShell header={headerEl}>
      {/* Article header */}
      <div className="mb-10">
        <div className="flex items-center gap-1.5 text-xs text-ink-tertiary mb-4">
          {article.publishedAt && (
            <time>{formatPublishedDate(article.publishedAt)}</time>
          )}
          {article.readingTimeSeconds !== null && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{formatReadingTime(article.readingTimeSeconds)}</span>
            </>
          )}
        </div>

        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink leading-tight mb-4">
          {article.title}
        </h1>

        {article.author && (
          <div className="text-sm text-ink-secondary">
            By {article.author}
          </div>
        )}
      </div>

      {/* Lead image */}
      {article.imageUrl && (
        <div className="mb-10 -mx-6">
          <img
            src={article.imageUrl}
            alt=""
            className="w-full rounded-lg"
          />
        </div>
      )}

      {/* Content */}
      {hasContent ? (
        <div
          className="font-serif text-lg leading-relaxed text-ink prose prose-neutral max-w-none
            prose-headings:font-serif prose-headings:tracking-tight
            prose-p:leading-relaxed prose-p:text-ink
            prose-a:text-accent prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-accent prose-blockquote:text-ink-secondary prose-blockquote:font-serif prose-blockquote:italic
            prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: article.content! }}
        />
      ) : article.summary ? (
        <div className="font-serif text-lg leading-relaxed text-ink">
          {article.summary}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-ink-tertiary">
          No content available for this article.
        </div>
      )}

      {/* Footer */}
      <Separator soft className="mt-12" />
      <div className="py-10 text-center">
        <div className="font-serif text-xl text-ink mb-3">
          End of article
        </div>

        {/* Vote — the natural moment of reflection */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <VoteControls
            value={vote}
            onVote={(v) => void handleVote(v)}
          />
          <span className="text-xs text-ink-tertiary">
            {vote === 1
              ? "More like this"
              : vote === -1
                ? "Less like this"
                : "Did you enjoy this?"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" size="sm" onClick={() => void handleMarkDoneAndBack()}>
            Done
          </Button>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm">
                View original
              </Button>
            </a>
          )}
        </div>
      </div>
    </ReadingShell>
  );
};

const Route = createFileRoute("/sources/$sourceId/articles/$articleId")({
  component: ArticlePage,
});

export { Route };
