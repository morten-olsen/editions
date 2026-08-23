import { createFileRoute } from '@tanstack/react-router';

import { useFeed } from '../hooks/feed/feed.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { EmptyState } from '../components/empty-state.tsx';
import { ArticleCard } from '../components/article-card.tsx';
import { Pager } from '../components/pager.tsx';
import { TIME_WINDOW_LABELS } from '../hooks/utilities/time-window.ts';
import type { TimeWindow, ReadStatus } from '../hooks/feed/feed.hooks.ts';

const IndexPage = (): React.ReactNode => {
  const feed = useFeed();

  return (
    <>
      <PageHeader title="Feed" subtitle="Your latest articles, ranked by importance" serif />
      <FeedFilterBar feed={feed} />
      <FeedArticles feed={feed} />
    </>
  );
};

/* ---- Filter bar ---- */

type FeedHook = ReturnType<typeof useFeed>;

const FeedFilterBar = ({ feed }: { feed: FeedHook }): React.ReactNode => (
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
          onClick={() => feed.changeFilter({ sort: s })}
          className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${feed.sort === s ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
          data-ai-id={`feed-sort-${s}`}
          data-ai-role="button"
          data-ai-label={s === 'top' ? 'Sort by top' : 'Sort by recent'}
          data-ai-state={feed.sort === s ? 'selected' : 'idle'}
        >
          {s === 'top' ? 'Top' : 'Recent'}
        </button>
      ))}
    </div>
    <select
      value={feed.window}
      onChange={(e) => feed.changeFilter({ window: e.target.value as TimeWindow })}
      className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
      data-ai-id="feed-time-window"
      data-ai-role="select"
      data-ai-label="Time window"
      data-ai-value={feed.window}
    >
      {(['today', 'week', 'all'] as const).map((w) => (
        <option key={w} value={w}>
          {TIME_WINDOW_LABELS[w]}
        </option>
      ))}
    </select>
    <select
      value={feed.status}
      onChange={(e) => feed.changeFilter({ status: e.target.value as ReadStatus })}
      className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
      data-ai-id="feed-read-status"
      data-ai-role="select"
      data-ai-label="Read status"
      data-ai-value={feed.status}
    >
      <option value="all">All</option>
      <option value="unread">Unread</option>
      <option value="read">Read</option>
    </select>
  </div>
);

/* ---- Articles ---- */

const FeedArticles = ({ feed }: { feed: FeedHook }): React.ReactNode => {
  if (feed.isLoading) {
    return <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>;
  }

  if (feed.articles.length === 0) {
    return <FeedEmptyState sort={feed.sort} status={feed.status} window={feed.window} />;
  }

  const { articles, total, bookmarkedIds } = feed;

  return (
    <>
      <div
        className="divide-y divide-border"
        data-ai-id="feed-articles"
        data-ai-role="list"
        data-ai-label={`${total} articles`}
      >
        {articles.map((article) => (
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
            read={feed.status === 'all' ? !!article.readAt : false}
            vote={article.vote}
            onVote={(v) => feed.vote(article.id, v)}
            bookmarked={bookmarkedIds.has(article.id)}
            onBookmarkToggle={() => feed.toggleBookmark(article.id)}
          />
        ))}
      </div>
      <div className="text-xs text-ink-tertiary mt-4">
        {total} article{total === 1 ? '' : 's'}
      </div>
      <Pager pagination={feed.pagination} idPrefix="feed" />
    </>
  );
};

const FeedEmptyState = ({
  sort,
  status,
  window,
}: {
  sort: string;
  status: string;
  window: TimeWindow;
}): React.ReactNode => {
  // The feed opens on Today, so "nothing here" usually means "nothing *today*" —
  // point at the time window before anything else.
  if (window !== 'all') {
    return (
      <EmptyState
        title="Nothing new"
        description={`No articles in this window. Switch the time filter to "${TIME_WINDOW_LABELS.all}" to browse everything.`}
      />
    );
  }
  let description = 'No articles match the current filters.';
  if (sort === 'top' && status === 'unread') {
    description = 'You\'re all caught up! Switch to "All" to browse past articles.';
  } else if (sort === 'top' && status === 'all') {
    description = 'Articles will appear here once your sources have been fetched and processed.';
  }
  return <EmptyState title="No articles" description={description} />;
};

const Route = createFileRoute('/feed/')({
  component: IndexPage,
});

export { Route };
