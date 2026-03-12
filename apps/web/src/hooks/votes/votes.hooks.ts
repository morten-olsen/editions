import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../auth/auth.tsx';
import { client } from '../../api/api.ts';
import { usePagination } from '../utilities/use-pagination.ts';
import type { UsePaginationResult } from '../utilities/use-pagination.ts';

type VoteWithArticle = {
  id: string;
  articleId: string;
  focusId: string | null;
  value: 1 | -1;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  sourceId: string;
  sourceName: string;
  focusName: string | null;
};

type VotesPage = {
  votes: VoteWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

type ScopeFilter = 'all' | 'global' | 'focus';
type ValueFilter = 'all' | 'up' | 'down';

type UseVotesResult = {
  votesPage: VotesPage | null;
  loading: boolean;
  pagination: UsePaginationResult;
  scopeFilter: ScopeFilter;
  valueFilter: ValueFilter;
  changeFilter: (scope?: ScopeFilter, value?: ValueFilter) => void;
  removeVote: (vote: VoteWithArticle) => Promise<void>;
};

const PAGE_SIZE = 30;

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    return 'Just now';
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const buildVotesQuery = (offset: number, scope: ScopeFilter, value: ValueFilter): Record<string, unknown> => {
  const query: Record<string, unknown> = { offset, limit: PAGE_SIZE };
  if (scope !== 'all') {
    query.scope = scope;
  }
  if (value === 'up') {
    query.value = 1;
  }
  if (value === 'down') {
    query.value = -1;
  }
  return query;
};

const useVotes = (): UseVotesResult => {
  const auth = useAuth();
  const [votesPage, setVotesPage] = useState<VotesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all');

  const pagination = usePagination({ pageSize: PAGE_SIZE, total: votesPage?.total ?? 0 });

  const loadVotes = useCallback(
    async (newOffset: number, scope: ScopeFilter, value: ValueFilter): Promise<void> => {
      if (auth.status !== 'authenticated') {
        return;
      }
      const query = buildVotesQuery(newOffset, scope, value);
      const { data } = await client.GET('/api/votes', {
        params: { query: query as never },
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (data) {
        setVotesPage(data as VotesPage);
      }
      setLoading(false);
    },
    [auth],
  );

  useEffect(() => {
    pagination.reset();
    void loadVotes(0, scopeFilter, valueFilter);
  }, [loadVotes, scopeFilter, valueFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeFilter = useCallback(
    (scope?: ScopeFilter, value?: ValueFilter): void => {
      if (scope !== undefined) {
        setScopeFilter(scope);
      }
      if (value !== undefined) {
        setValueFilter(value);
      }
      pagination.reset();
      setLoading(true);
      void loadVotes(0, scope ?? scopeFilter, value ?? valueFilter);
    },
    [loadVotes, pagination, scopeFilter, valueFilter],
  );

  const removeVote = useCallback(
    async (vote: VoteWithArticle): Promise<void> => {
      if (auth.status !== 'authenticated') {
        return;
      }
      await client.DELETE('/api/votes/{voteId}', {
        params: { path: { voteId: vote.id } },
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setVotesPage((prev) => {
        if (!prev) {
          return prev;
        }
        return { ...prev, votes: prev.votes.filter((v) => v.id !== vote.id), total: prev.total - 1 };
      });
    },
    [auth],
  );

  return { votesPage, loading, pagination, scopeFilter, valueFilter, changeFilter, removeVote };
};

export type { VoteWithArticle, VotesPage, ScopeFilter, ValueFilter, UseVotesResult };
export { PAGE_SIZE, formatDate, useVotes };
