import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders } from "../api/api.hooks.ts";
import { BookmarkButton } from "../components/bookmark-button.tsx";
import { ReadingShell } from "../components/app-shell.tsx";
import { Button } from "../components/button.tsx";
import { MediaPlayer } from "../components/media-player.tsx";
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
  consumptionTimeSeconds: number | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  imageUrl: string | null;
  publishedAt: string | null;
  readAt: string | null;
  extractedAt: string | null;
  progress: number;
};

type ArticleData = {
  article: ArticleDetail;
  vote: VoteValue;
  bookmarked: boolean;
};

const formatConsumptionTime = (seconds: number, sourceType: string): string => {
  const minutes = Math.round(seconds / 60);
  const suffix = sourceType === "podcast" ? "listen" : "read";
  if (minutes < 1) return `< 1 min ${suffix}`;
  return `${minutes} min ${suffix}`;
};

const formatPublishedDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const ArticlePage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const { sourceId, articleId } = Route.useParams();
  const [vote, setVote] = useState<VoteValue>(null);
  const [isRead, setIsRead] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const { data, isLoading, error } = useQuery<ArticleData>({
    queryKey: ["sources", sourceId, "articles", articleId],
    queryFn: async (): Promise<ArticleData> => {
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
        throw new Error("Article not found");
      }

      const article = articleRes.data as ArticleDetail;
      const voteValue = voteRes.data
        ? (voteRes.data as { value: 1 | -1 }).value
        : null;
      const isBookmarked = bookmarkRes.data
        ? (bookmarkRes.data as { bookmarked: boolean }).bookmarked
        : false;

      return { article, vote: voteValue, bookmarked: isBookmarked };
    },
    enabled: !!headers,
  });

  // Sync server state into local state for optimistic updates
  const article = data?.article ?? null;

  // Initialize local state from query data when it first arrives
  const [initialized, setInitialized] = useState(false);
  if (data && !initialized) {
    setVote(data.vote);
    setIsRead(!!data.article.readAt);
    setBookmarked(data.bookmarked);
    setInitialized(true);
  }

  if (!headers || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {error instanceof Error ? error.message : "Article not found"}
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

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
          {article.consumptionTimeSeconds !== null && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{formatConsumptionTime(article.consumptionTimeSeconds, article.sourceType)}</span>
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

      {/* Media player for podcasts / video */}
      {article.mediaUrl && (
        <div className="mb-10">
          <MediaPlayer
            mediaUrl={article.mediaUrl}
            mediaType={article.mediaType}
            articleId={article.id}
            initialProgress={article.progress}
            delay={0}
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
