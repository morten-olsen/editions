import { createFileRoute, Link } from '@tanstack/react-router';

import { useFocusDetail, PAGE_SIZE } from '../hooks/focuses/focuses.hooks.ts';
import type { TimeWindow, ReadStatus } from '../hooks/focuses/focuses.hooks.ts';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { ArticleCard } from '../components/article-card.tsx';

const CogIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path
      fillRule="evenodd"
      d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      clipRule="evenodd"
    />
  </svg>
);

const FocusDetailPage = (): React.ReactNode => {
  const { focusId } = Route.useParams();

  const {
    focus,
    loadingFocus,
    focusError,
    articlesPage,
    loadingArticles,
    analysisRunning,
    sort,
    window,
    status,
    pagination,
    getVoteOverride,
    getGlobalVoteOverride,
    isBookmarked,
    handleFocusVote,
    handleGlobalVote,
    handleBookmarkToggle,
    handleFilterChange,
    handlePageChange,
    headers,
  } = useFocusDetail(focusId);

  if (!headers) {
    return null;
  }

  const loading = loadingFocus || loadingArticles;

  if (loading && !focus) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!focus) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">{focusError ? 'Focus not found' : 'Focus not found'}</div>
      </div>
    );
  }

  return (
    <>
      {/* Header: name + cog */}
      <div
        className="flex items-center justify-between gap-4 mb-8"
        data-ai-id="focus-header"
        data-ai-role="heading"
        data-ai-label={focus.name}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-medium tracking-tight text-ink">{focus.name}</h1>
          {focus.description && (
            <div className="text-sm text-ink-secondary mt-1 leading-relaxed">{focus.description}</div>
          )}
        </div>
        <Link
          to="/focuses/$focusId/edit"
          params={{ focusId }}
          className="shrink-0 p-2 rounded-md text-ink-tertiary hover:text-ink hover:bg-surface-sunken transition-colors duration-fast"
          aria-label="Edit focus settings"
          data-ai-id="focus-edit-btn"
          data-ai-role="button"
          data-ai-label="Edit focus settings"
        >
          <CogIcon />
        </Link>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-4 mb-6"
        data-ai-id="focus-filters"
        data-ai-role="section"
        data-ai-label="Focus filters"
      >
        <div className="flex gap-1 border-b border-border">
          {(['top', 'recent'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleFilterChange(s)}
              className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${sort === s ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
              data-ai-id={`focus-sort-${s}`}
              data-ai-role="button"
              data-ai-label={s === 'top' ? 'Sort by top' : 'Sort by recent'}
              data-ai-state={sort === s ? 'selected' : 'idle'}
            >
              {s === 'top' ? 'Top' : 'Recent'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={window}
            onChange={(e) => handleFilterChange(undefined, e.target.value as TimeWindow)}
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            data-ai-id="focus-time-window"
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
            onChange={(e) => handleFilterChange(undefined, undefined, e.target.value as ReadStatus)}
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            data-ai-id="focus-read-status"
            data-ai-role="select"
            data-ai-label="Read status"
            data-ai-value={status}
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Articles */}
      {!articlesPage || articlesPage.articles.length === 0 ? (
        analysisRunning ? (
          <EmptyState
            title="Analysing articles"
            description="Articles are being classified for this focus. This page will update automatically when ready."
          />
        ) : (
          <EmptyState
            title="No articles"
            description={
              sort === 'top' && window === 'all' && status === 'unread'
                ? 'You\'re all caught up! Switch to "All" to browse past articles.'
                : sort === 'top' && window === 'all' && status === 'all'
                  ? 'No articles have been classified into this focus yet.'
                  : 'No articles match the current filters.'
            }
          />
        )
      ) : (
        <>
          <div
            className="divide-y divide-border"
            data-ai-id="focus-articles"
            data-ai-role="list"
            data-ai-label={`${articlesPage.total} articles`}
          >
            {articlesPage.articles.map((article) => {
              const focusVote = getVoteOverride(article.id, article.vote);
              const globalVote = getGlobalVoteOverride(article.id, article.globalVote);
              const bookmarked = isBookmarked(article.id);

              return (
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
                  focusVote={focusVote}
                  onFocusVote={(v) => void handleFocusVote(article.id, v)}
                  vote={globalVote}
                  onVote={(v) => void handleGlobalVote(article.id, v)}
                  bookmarked={bookmarked}
                  onBookmarkToggle={() => void handleBookmarkToggle(article.id)}
                />
              );
            })}
          </div>

          <div className="text-xs text-ink-tertiary mt-4">
            {articlesPage.total} article{articlesPage.total === 1 ? '' : 's'}
          </div>

          {pagination.totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-4 pt-4 border-t border-border"
              data-ai-id="focus-pagination"
              data-ai-role="info"
              data-ai-label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => handlePageChange(Math.max(0, pagination.offset - PAGE_SIZE))}
                data-ai-id="focus-prev-page"
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
                onClick={() => handlePageChange(pagination.offset + PAGE_SIZE)}
                data-ai-id="focus-next-page"
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

const Route = createFileRoute('/focuses/$focusId/')({
  component: FocusDetailPage,
});

export { Route };
