import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api/api.ts";
import { useAuthHeaders, queryKeys } from "../api/api.hooks.ts";
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
  consumptionTimeSeconds: number | null;
  sourceId: string;
  sourceName: string;
  sourceType: string;
};

type BookmarksPage = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

const PAGE_SIZE = 30;

const BookmarksIndexPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [saveUrl, setSaveUrl] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const queryKey = [...queryKeys.bookmarks.all, offset] as const;

  const { data: page, isLoading } = useQuery<BookmarksPage>({
    queryKey,
    queryFn: async (): Promise<BookmarksPage> => {
      const { data } = await client.GET("/api/bookmarks", {
        params: { query: { offset, limit: PAGE_SIZE } },
        headers,
      });
      return data as BookmarksPage;
    },
    enabled: !!headers,
  });

  const saveMutation = useMutation({
    mutationFn: async (url: string): Promise<void> => {
      const { error: err } = await client.POST("/api/bookmarks/save", {
        body: { url },
        headers,
      });
      if (err) {
        throw new Error(
          "error" in err ? (err as { error: string }).error : "Failed to save article",
        );
      }
    },
    onSuccess: (): void => {
      setSaveUrl("");
      setSaveError(null);
      setOffset(0);
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
    },
    onError: (err: Error): void => {
      setSaveError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (articleId: string): Promise<void> => {
      await client.DELETE("/api/articles/{articleId}/bookmark", {
        params: { path: { articleId } },
        headers,
      });
    },
    onMutate: async (articleId: string): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<BookmarksPage>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          bookmarks: old.bookmarks.filter((b) => b.articleId !== articleId),
          total: old.total - 1,
        };
      });
    },
  });

  const handleSaveUrl = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = saveUrl.trim();
    if (!trimmed) return;
    setSaveError(null);
    saveMutation.mutate(trimmed);
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
  };

  const totalPages = page ? Math.ceil(page.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeader title="Bookmarks" serif />

      <form onSubmit={handleSaveUrl} className="flex gap-2 mb-6" data-ai-id="bookmark-save-form" data-ai-role="form" data-ai-label="Save article by URL">
        <input
          type="url"
          placeholder="Paste a URL to save an article..."
          value={saveUrl}
          onChange={(e) => setSaveUrl(e.target.value)}
          required
          className="flex-1 h-10 rounded-md border border-border bg-surface-raised px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-fast ease-gentle focus:border-accent focus:ring-2 focus:ring-accent/20"
          data-ai-id="bookmark-save-url"
          data-ai-role="input"
          data-ai-label="Article URL"
          data-ai-value={saveUrl}
        />
        <Button variant="primary" size="sm" type="submit" disabled={saveMutation.isPending} data-ai-id="bookmark-save-submit" data-ai-role="button" data-ai-label="Save bookmark" data-ai-state={saveMutation.isPending ? "loading" : "idle"}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </form>

      {saveError && (
        <div className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4" data-ai-id="bookmark-save-error" data-ai-role="error" data-ai-error={saveError}>
          {saveError}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !page || page.bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks"
          description="Bookmark articles while browsing or reading to save them for later."
        />
      ) : (
        <>
          <div className="divide-y divide-border" data-ai-id="bookmark-list" data-ai-role="list" data-ai-label={`${page.total} bookmarks`}>
            {page.bookmarks.map((bookmark) => (
              <ArticleCard
                key={bookmark.id}
                id={bookmark.articleId}
                title={bookmark.articleTitle}
                sourceName={bookmark.sourceName}
                author={bookmark.author}
                summary={bookmark.summary}
                publishedAt={bookmark.publishedAt}
                consumptionTimeSeconds={bookmark.consumptionTimeSeconds}
                sourceType={bookmark.sourceType}
                imageUrl={bookmark.imageUrl}
                href={`/sources/${bookmark.sourceId}/articles/${bookmark.articleId}`}
                bookmarked
                onBookmarkToggle={() => removeMutation.mutate(bookmark.articleId)}
              />
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {page.total} bookmark{page.total === 1 ? "" : "s"}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border" data-ai-id="bookmark-pagination" data-ai-role="info" data-ai-label={`Page ${currentPage} of ${totalPages}`}>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => handlePageChange(Math.max(0, offset - PAGE_SIZE))}
                data-ai-id="bookmark-prev-page"
                data-ai-role="button"
                data-ai-label="Previous page"
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
                data-ai-id="bookmark-next-page"
                data-ai-role="button"
                data-ai-label="Next page"
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
