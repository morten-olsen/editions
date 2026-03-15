import { createFileRoute } from '@tanstack/react-router';

import { useFocusDetail, PAGE_SIZE } from '../hooks/focuses/focuses.hooks.ts';
import type { TimeWindow, ReadStatus } from '../hooks/focuses/focuses.hooks.ts';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { ArticleCard } from '../components/article-card.tsx';


const FocusDetailPage = (): React.ReactNode => {
  const { focusId } = Route.useParams();
  const detail = useFocusDetail(focusId);

  if (!detail.headers) {
    return null;
  }

  const loading = detail.loadingFocus || detail.loadingArticles;

  if (loading && !detail.focus) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (!detail.focus) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-critical">Focus not found</div>
      </div>
    );
  }

  return (
    <>
      <FocusHeader focus={detail.focus} />
      <FocusFilterBar detail={detail} />
      <FocusArticleList detail={detail} />
    </>
  );
};

/* ---- Header ---- */

const FocusHeader = ({
  focus,
}: {
  focus: { name: string; description: string | null };
}): React.ReactNode => (
  <div
    className="mb-8"
    data-ai-id="focus-header"
    data-ai-role="heading"
    data-ai-label={focus.name}
  >
    <h1 className="text-2xl font-serif font-medium tracking-tight text-ink">{focus.name}</h1>
    {focus.description && <div className="text-sm text-ink-secondary mt-1 leading-relaxed">{focus.description}</div>}
  </div>
);

/* ---- Filter bar ---- */

type FocusDetail = ReturnType<typeof useFocusDetail>;

const FocusFilterBar = ({ detail }: { detail: FocusDetail }): React.ReactNode => (
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
          onClick={() => detail.handleFilterChange(s)}
          className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${detail.sort === s ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
          data-ai-id={`focus-sort-${s}`}
          data-ai-role="button"
          data-ai-label={s === 'top' ? 'Sort by top' : 'Sort by recent'}
          data-ai-state={detail.sort === s ? 'selected' : 'idle'}
        >
          {s === 'top' ? 'Top' : 'Recent'}
        </button>
      ))}
    </div>

    <div className="flex items-center gap-2 ml-auto">
      <select
        value={detail.window}
        onChange={(e) => detail.handleFilterChange(undefined, e.target.value as TimeWindow)}
        className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        data-ai-id="focus-time-window"
        data-ai-role="select"
        data-ai-label="Time window"
        data-ai-value={detail.window}
      >
        <option value="all">All time</option>
        <option value="week">This week</option>
        <option value="today">Today</option>
      </select>

      <select
        value={detail.status}
        onChange={(e) => detail.handleFilterChange(undefined, undefined, e.target.value as ReadStatus)}
        className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        data-ai-id="focus-read-status"
        data-ai-role="select"
        data-ai-label="Read status"
        data-ai-value={detail.status}
      >
        <option value="all">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </select>
    </div>
  </div>
);

/* ---- Articles list ---- */

const FocusArticleList = ({ detail }: { detail: FocusDetail }): React.ReactNode => {
  const { articlesPage, analysisRunning, sort, window, status, pagination } = detail;

  if (!articlesPage || articlesPage.articles.length === 0) {
    return <FocusEmptyState analysisRunning={analysisRunning ?? false} sort={sort} window={window} status={status} />;
  }

  return (
    <>
      <div
        className="divide-y divide-border"
        data-ai-id="focus-articles"
        data-ai-role="list"
        data-ai-label={`${articlesPage.total} articles`}
      >
        {articlesPage.articles.map((article) => (
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
            focusVote={detail.getVoteOverride(article.id, article.vote)}
            onFocusVote={(v) => void detail.handleFocusVote(article.id, v)}
            vote={detail.getGlobalVoteOverride(article.id, article.globalVote)}
            onVote={(v) => void detail.handleGlobalVote(article.id, v)}
            bookmarked={detail.isBookmarked(article.id)}
            onBookmarkToggle={() => void detail.handleBookmarkToggle(article.id)}
          />
        ))}
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
            onClick={() => detail.handlePageChange(Math.max(0, pagination.offset - PAGE_SIZE))}
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
            onClick={() => detail.handlePageChange(pagination.offset + PAGE_SIZE)}
            data-ai-id="focus-next-page"
            data-ai-role="button"
            data-ai-label="Next page"
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
};

/* ---- Empty state ---- */

const FocusEmptyState = ({
  analysisRunning,
  sort,
  window,
  status,
}: {
  analysisRunning: boolean;
  sort: string;
  window: string;
  status: string;
}): React.ReactNode => {
  if (analysisRunning) {
    return (
      <EmptyState
        title="Analysing articles"
        description="Articles are being classified for this focus. This page will update automatically when ready."
      />
    );
  }

  let description = 'No articles match the current filters.';
  if (sort === 'top' && window === 'all' && status === 'unread') {
    description = 'You\'re all caught up! Switch to "All" to browse past articles.';
  } else if (sort === 'top' && window === 'all' && status === 'all') {
    description = 'No articles have been classified into this focus yet.';
  }

  return <EmptyState title="No articles" description={description} />;
};

const Route = createFileRoute('/focuses/$focusId/')({
  component: FocusDetailPage,
});

export { Route };
