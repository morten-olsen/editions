import { createFileRoute } from '@tanstack/react-router';

import { useBookmarks } from '../hooks/bookmarks/bookmarks.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { ArticleCard } from '../components/article-card.tsx';
import { Button } from '../components/button.tsx';

const BookmarksIndexPage = (): React.ReactNode => {
  const {
    bookmarks,
    total,
    isLoading,
    pagination,
    saveUrl,
    setSaveUrl,
    saveError,
    isSaving,
    handleSaveUrl,
    removeBookmark,
  } = useBookmarks();

  return (
    <>
      <PageHeader title="Bookmarks" serif />

      <form
        onSubmit={handleSaveUrl}
        className="flex gap-2 mb-6"
        data-ai-id="bookmark-save-form"
        data-ai-role="form"
        data-ai-label="Save article by URL"
      >
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
        <Button
          variant="primary"
          size="sm"
          type="submit"
          disabled={isSaving}
          data-ai-id="bookmark-save-submit"
          data-ai-role="button"
          data-ai-label="Save bookmark"
          data-ai-state={isSaving ? 'loading' : 'idle'}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </form>

      {saveError && (
        <div
          className="rounded-md bg-critical-subtle border border-critical/20 p-3 text-sm text-critical mb-4"
          data-ai-id="bookmark-save-error"
          data-ai-role="error"
          data-ai-error={saveError}
        >
          {saveError}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks"
          description="Bookmark articles while browsing or reading to save them for later."
        />
      ) : (
        <>
          <div
            className="divide-y divide-border"
            data-ai-id="bookmark-list"
            data-ai-role="list"
            data-ai-label={`${total} bookmarks`}
          >
            {bookmarks.map((bookmark) => (
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
                onBookmarkToggle={() => removeBookmark(bookmark.articleId)}
              />
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {total} bookmark{total === 1 ? '' : 's'}
          </div>

          {pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-4 pt-4 border-t border-border"
              data-ai-id="bookmark-pagination"
              data-ai-role="info"
              data-ai-label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => pagination.goPrev()}
                data-ai-id="bookmark-prev-page"
                data-ai-role="button"
                data-ai-label="Previous page"
              >
                Previous
              </Button>
              <span className="text-xs text-ink-tertiary">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => pagination.goNext()}
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

const Route = createFileRoute('/bookmarks/')({
  component: BookmarksIndexPage,
});

export { Route };
