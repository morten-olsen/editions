import { Link } from '@tanstack/react-router';

import { useVotes, formatDate } from '../../hooks/votes/votes.hooks.ts';
import type { VoteWithArticle, ScopeFilter, ValueFilter } from '../../hooks/votes/votes.hooks.ts';
import { Button } from '../../components/button.tsx';
import { EmptyState } from '../../components/empty-state.tsx';
import { Separator } from '../../components/separator.tsx';

const VotesSection = (): React.ReactNode => {
  const { votesPage, loading, pagination, scopeFilter, valueFilter, changeFilter, removeVote } = useVotes();

  return (
    <>
      <p className="text-sm text-ink-secondary mb-6">Your feedback shapes how articles are ranked</p>

      <VotesFilterBar scopeFilter={scopeFilter} valueFilter={valueFilter} onFilterChange={changeFilter} />

      {loading ? (
        <div className="text-sm text-ink-tertiary py-12 text-center">Loading...</div>
      ) : !votesPage || votesPage.votes.length === 0 ? (
        <VotesEmptyState scopeFilter={scopeFilter} valueFilter={valueFilter} />
      ) : (
        <VotesList votesPage={votesPage} pagination={pagination} onRemove={removeVote} />
      )}
    </>
  );
};

/* ---- Filter bar ---- */

const VotesFilterBar = ({
  scopeFilter,
  valueFilter,
  onFilterChange,
}: {
  scopeFilter: ScopeFilter;
  valueFilter: ValueFilter;
  onFilterChange: (scope?: ScopeFilter, value?: ValueFilter) => void;
}): React.ReactNode => (
  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
    <div className="flex gap-1 border-b border-border">
      {(['all', 'global', 'focus'] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onFilterChange(s)}
          className={`relative flex h-10 items-center justify-center px-4 text-sm font-medium outline-none select-none transition-colors duration-fast cursor-pointer ${scopeFilter === s ? 'text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent' : 'text-ink-tertiary hover:text-ink-secondary'}`}
        >
          {s === 'all' ? 'All' : s === 'global' ? 'Quality' : 'Relevance'}
        </button>
      ))}
    </div>

    <select
      value={valueFilter}
      onChange={(e) => onFilterChange(undefined, e.target.value as ValueFilter)}
      className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer ml-auto"
    >
      <option value="all">All votes</option>
      <option value="up">Upvotes</option>
      <option value="down">Downvotes</option>
    </select>
  </div>
);

/* ---- Empty state ---- */

const VotesEmptyState = ({
  scopeFilter,
  valueFilter,
}: {
  scopeFilter: ScopeFilter;
  valueFilter: ValueFilter;
}): React.ReactNode => (
  <EmptyState
    title="No votes yet"
    description={
      scopeFilter === 'all' && valueFilter === 'all'
        ? 'Vote on articles in your focus feeds or while reading to train the ranking system.'
        : 'No votes match the current filters.'
    }
  />
);

/* ---- Votes list ---- */

type VotesListPagination = {
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
};

type VotesPageData = {
  votes: VoteWithArticle[];
  total: number;
};

const VotesList = ({
  votesPage,
  pagination,
  onRemove,
}: {
  votesPage: VotesPageData;
  pagination: VotesListPagination;
  onRemove: (vote: VoteWithArticle) => Promise<void>;
}): React.ReactNode => (
  <>
    <div className="flex flex-col">
      {votesPage.votes.map((vote, idx) => (
        <div key={vote.id}>
          {idx > 0 && <Separator soft />}
          <VoteRow vote={vote} onRemove={() => void onRemove(vote)} />
        </div>
      ))}
    </div>

    <div className="text-xs text-ink-tertiary mt-4">
      {votesPage.total} vote{votesPage.total === 1 ? '' : 's'}
    </div>

    {pagination.totalPages > 1 && (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <Button variant="ghost" size="sm" disabled={!pagination.hasPrev} onClick={pagination.goPrev}>
          Previous
        </Button>
        <span className="text-xs text-ink-tertiary">
          Page {pagination.currentPage} of {pagination.totalPages}
        </span>
        <Button variant="ghost" size="sm" disabled={!pagination.hasNext} onClick={pagination.goNext}>
          Next
        </Button>
      </div>
    )}
  </>
);

/* ---- Single vote row ---- */

const VoteRow = ({ vote, onRemove }: { vote: VoteWithArticle; onRemove: () => void }): React.ReactNode => (
  <div className="flex items-start gap-4 py-4">
    <div className={`mt-0.5 shrink-0 w-5 text-center text-sm ${vote.value === 1 ? 'text-accent' : 'text-critical'}`}>
      {vote.value === 1 ? '\u2191' : '\u2193'}
    </div>

    <div className="flex-1 min-w-0">
      <Link
        to="/sources/$sourceId/articles/$articleId"
        params={{ sourceId: vote.sourceId, articleId: vote.articleId }}
        className="font-serif text-sm font-medium tracking-tight text-ink hover:text-accent transition-colors duration-fast leading-snug line-clamp-1"
      >
        {vote.articleTitle}
      </Link>
      <div className="flex items-center gap-1.5 mt-1 text-xs text-ink-tertiary">
        <span>{vote.sourceName}</span>
        <span className="text-ink-faint">·</span>
        <span>{formatDate(vote.createdAt)}</span>
        <span className="text-ink-faint">·</span>
        {vote.focusId ? (
          <Link
            to="/focuses/$focusId"
            params={{ focusId: vote.focusId }}
            className="hover:text-accent transition-colors duration-fast"
          >
            {vote.focusName}
          </Link>
        ) : (
          <span>Quality</span>
        )}
      </div>
    </div>

    <button
      type="button"
      onClick={onRemove}
      className="shrink-0 text-xs text-ink-faint hover:text-critical transition-colors duration-fast cursor-pointer mt-0.5"
      aria-label="Remove vote"
    >
      ×
    </button>
  </div>
);

export { VotesSection };
