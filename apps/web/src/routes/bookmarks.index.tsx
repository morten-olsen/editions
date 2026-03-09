import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { client } from "../api/api.ts";
import { PageHeader } from "../components/page-header.tsx";
import { EmptyState } from "../components/empty-state.tsx";
import { ArticleCard } from "../components/article-card.tsx";
import { Button } from "../components/button.tsx";

type BookmarkWithArticle = {
  id: string;
  articleId: string;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  readingTimeSeconds: number | null;
  sourceId: string;
  sourceName: string;
};

type BookmarksPage = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

const PAGE_SIZE = 30;

const BookmarksIndexPage = (): React.ReactNode => {
  const auth = useAuth();
  const [page, setPage] = useState<BookmarksPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [saveUrl, setSaveUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadBookmarks = useCallback(async (newOffset: number): Promise<void> => {
    if (auth.status !== "authenticated") return;

    const { data } = await client.GET("/api/bookmarks", {
      params: { query: { offset: newOffset, limit: PAGE_SIZE } },
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (data) {
      setPage(data as BookmarksPage);
    }
    setLoading(false);
  }, [auth]);

  useEffect(() => {
    void loadBookmarks(0);
  }, [loadBookmarks]);

  if (auth.status !== "authenticated") return null;

  const headers = { Authorization: `Bearer ${auth.token}` };

  const handleSaveUrl = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = saveUrl.trim();
    if (!trimmed) return;

    setSaving(true);
    setSaveError(null);

    const { error: err } = await client.POST("/api/bookmarks/save", {
      body: { url: trimmed },
      headers,
    });

    if (err) {
      setSaveError("error" in err ? (err as { error: string }).error : "Failed to save article");
      setSaving(false);
      return;
    }

    setSaveUrl("");
    setSaving(false);
    void loadBookmarks(0);
    setOffset(0);
  };

  const handleRemoveBookmark = async (articleId: string): Promise<void> => {
    await client.DELETE("/api/articles/{articleId}/bookmark", {
      params: { path: { articleId } },
      headers,
    });

    setPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookmarks: prev.bookmarks.filter((b) => b.articleId !== articleId),
        total: prev.total - 1,
      };
    });
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    void loadBookmarks(newOffset);
  };

  const totalPages = page ? Math.ceil(page.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeader title="Bookmarks" serif />

      <form onSubmit={handleSaveUrl} className="flex gap-2 mb-6">
        <input
          type="url"
          placeholder="Paste a URL to save an article..."
          value={saveUrl}
          onChange={(e) => setSaveUrl(e.target.value)}
          required
          className="flex-1 h-10 rounded-md border border-border bg-surface-raised px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <Button variant="primary" size="sm" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </form>

      {saveError && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4">
          {saveError}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !page || page.bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks"
          description="Bookmark articles while browsing or reading to save them for later."
        />
      ) : (
        <>
          <div className="divide-y divide-border">
            {page.bookmarks.map((bookmark) => (
              <ArticleCard
                key={bookmark.id}
                id={bookmark.articleId}
                title={bookmark.articleTitle}
                sourceName={bookmark.sourceName}
                author={bookmark.author}
                summary={bookmark.summary}
                publishedAt={bookmark.publishedAt}
                readingTimeSeconds={bookmark.readingTimeSeconds}
                imageUrl={bookmark.imageUrl}
                href={`/sources/${bookmark.sourceId}/articles/${bookmark.articleId}`}
                bookmarked
                onBookmarkToggle={() => void handleRemoveBookmark(bookmark.articleId)}
              />
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {page.total} bookmark{page.total === 1 ? "" : "s"}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => handlePageChange(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <span className="text-xs text-ink-tertiary">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset + PAGE_SIZE >= page.total}
                onClick={() => handlePageChange(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};

const Route = createFileRoute("/bookmarks/")({
  component: BookmarksIndexPage,
});

export { Route };
