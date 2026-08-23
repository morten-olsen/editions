import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthHeaders } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';
import type { Page } from '../../api/api.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

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

type VotesPage = Page<VoteWithArticle>;

type ScopeFilter = 'all' | 'global' | 'focus';
type ValueFilter = 'all' | 'up' | 'down';

type UseVotesResult = {
  votes: VoteWithArticle[];
  total: number;
  loading: boolean;
  pagination: PagerControls;
  scopeFilter: ScopeFilter;
  valueFilter: ValueFilter;
  changeFilter: (scope?: ScopeFilter, value?: ValueFilter) => void;
  removeVote: (vote: VoteWithArticle) => void;
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

type VotesQuery = {
  offset: number;
  limit: number;
  scope?: Exclude<ScopeFilter, 'all'>;
  value?: 1 | -1;
};

const buildVotesQuery = (
  { offset, limit }: { offset: number; limit: number },
  scope: ScopeFilter,
  value: ValueFilter,
): VotesQuery => ({
  offset,
  limit,
  ...(scope === 'all' ? {} : { scope }),
  ...(value === 'all' ? {} : { value: value === 'up' ? (1 as const) : (-1 as const) }),
});

const useVotes = (): UseVotesResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [valueFilter, setValueFilter] = useState<ValueFilter>('all');

  const paged = usePagedQuery<VoteWithArticle>({
    queryKey: (offset) => ['votes', { scope: scopeFilter, value: valueFilter, offset }],
    fetchPage: async ({ offset, limit }): Promise<VotesPage> => {
      const { data } = await client.GET('/api/votes', {
        params: { query: buildVotesQuery({ offset, limit }, scopeFilter, valueFilter) },
        headers,
      });
      return data as VotesPage;
    },
    pageSize: PAGE_SIZE,
    enabled: !!headers,
  });

  const { pagination, queryKey } = paged;

  const changeFilter = useCallback(
    (scope?: ScopeFilter, value?: ValueFilter): void => {
      if (scope !== undefined) {
        setScopeFilter(scope);
      }
      if (value !== undefined) {
        setValueFilter(value);
      }
      pagination.reset();
    },
    [pagination],
  );

  const removeMutation = useMutation({
    mutationFn: async (vote: VoteWithArticle): Promise<void> => {
      await client.DELETE('/api/votes/{voteId}', { params: { path: { voteId: vote.id } }, headers });
    },
    onMutate: async (vote: VoteWithArticle): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<VotesPage>(queryKey, (old) =>
        old ? { ...old, items: old.items.filter((v) => v.id !== vote.id), total: old.total - 1 } : old,
      );
    },
  });

  return {
    votes: paged.items,
    total: paged.total,
    loading: paged.isLoading,
    pagination,
    scopeFilter,
    valueFilter,
    changeFilter,
    removeVote: removeMutation.mutate,
  };
};

export type { VoteWithArticle, VotesPage, ScopeFilter, ValueFilter, UseVotesResult };
export { PAGE_SIZE, formatDate, useVotes };
