import { createFileRoute } from '@tanstack/react-router';

import { useFeed } from '../hooks/feed/feed.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { ArticleCard } from '../components/article-card.tsx';
import type { TimeWindow, ReadStatus } from '../hooks/feed/feed.hooks.ts';

const IndexPage = (): React.ReactNode => {
  const { feedPage, bookmarkedIds, isLoading, sort, status, window, pagination, changeFilter, vote, toggleBookmark } =
    useFeed();

  return (
    <>
      <PageHeader title="Feed" subtitle="Your latest articles, ranked by importance" serif />

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6"
        data-ai-id="feed-filters"
        data-ai-role="section"
        data-ai-label="Feed filters"
      >
        <div className="flex gap-1 border-b border-border">
          {(['top', 'recent'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeFilter({ sort: s })}
              className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${sort === s ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
              data-ai-id={`feed-sort-${s}`}
              data-ai-role="button"
              data-ai-label={s === 'top' ? 'Sort by top' : 'Sort by recent'}
              data-ai-state={sort === s ? 'selected' : 'idle'}
            >
              {s === 'top' ? 'Top' : 'Recent'}
            </button>
          ))}
        </div>

        <select
          value={window}
          onChange={(e) => changeFilter({ window: e.target.value as TimeWindow })}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
          data-ai-id="feed-time-window"
          data-ai-role="select"
          data-ai-label="Time window"
          data-ai-value={window}
        >
          <option value="all">All time</option>
          <option value="week">This week</option>
          <option value="today">Today</option>
        </select>

        <select
          value={status}
          onChange={(e) => changeFilter({ status: e.target.value as ReadStatus })}
          className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          data-ai-id="feed-read-status"
          data-ai-role="select"
          data-ai-label="Read status"
          data-ai-value={status}
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !feedPage || feedPage.articles.length === 0 ? (
        <EmptyState
          title="No articles"
          description={
            sort === 'top' && status === 'unread'
              ? 'You\'re all caught up! Switch to "All" to browse past articles.'
              : sort === 'top' && status === 'all'
                ? 'Articles will appear here once your sources have been fetched and processed.'
                : 'No articles match the current filters.'
          }
        />
      ) : (
        <>
          <div
            className="divide-y divide-border"
            data-ai-id="feed-articles"
            data-ai-role="list"
            data-ai-label={`${feedPage.total} articles`}
          >
            {feedPage.articles.map((article) => (
              <ArticleCard
                key={article.id}
                id={article.id}
                title={article.title}
                sourceName={article.sourceName}
                author={article.author}
                summary={article.summary}
                publishedAt={article.publishedAt}
                consumptionTimeSeconds={article.consumptionTimeSeconds}
                sourceType={article.sourceType}
                imageUrl={article.imageUrl}
                href={`/sources/${article.sourceId}/articles/${article.id}`}
                read={status === 'all' ? !!article.readAt : false}
                vote={article.vote}
                onVote={(v) => vote(article.id, v)}
                bookmarked={bookmarkedIds.has(article.id)}
                onBookmarkToggle={() => toggleBookmark(article.id)}
              />
            ))}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {feedPage.total} article{feedPage.total === 1 ? '' : 's'}
          </div>

          {pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-4 pt-4 border-t border-border"
              data-ai-id="feed-pagination"
              data-ai-role="info"
              data-ai-label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => pagination.goPrev()}
                data-ai-id="feed-prev-page"
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
                data-ai-id="feed-next-page"
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

const Route = createFileRoute('/feed/')({
  component: IndexPage,
});

export { Route };
