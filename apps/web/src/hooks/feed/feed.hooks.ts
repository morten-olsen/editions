import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import type { Page } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { useBookmarkStatus } from '../bookmarks/bookmarks.hooks.ts';
import { DEFAULT_TIME_WINDOW, windowToRange } from '../utilities/time-window.ts';
import type { TimeWindow } from '../utilities/time-window.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

type FeedArticle = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  sourceType: string;
  readAt: string | null;
  score: number;
  vote: 1 | -1 | null;
  sourceName: string;
};

type FeedPage = Page<FeedArticle>;

type SortMode = 'top' | 'recent';
type ReadStatus = 'all' | 'unread' | 'read';
type VoteValue = 1 | -1 | null;

type FeedFilters = {
  sort?: SortMode;
  status?: ReadStatus;
  window?: TimeWindow;
};

type UseFeedResult = {
  articles: FeedArticle[];
  total: number;
  bookmarkedIds: Set<string>;
  isLoading: boolean;
  sort: SortMode;
  status: ReadStatus;
  window: TimeWindow;
  pagination: PagerControls;
  changeFilter: (params?: FeedFilters) => void;
  vote: (articleId: string, value: VoteValue) => void;
  toggleBookmark: (articleId: string) => void;
};

const PAGE_SIZE = 20;

// -- Feed vote mutation --

const useFeedVoteMutation = (
  headers: Record<string, string> | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
): ReturnType<typeof useMutation<void, Error, { articleId: string; value: VoteValue }>> =>
  useMutation({
    mutationFn: async ({ articleId, value }: { articleId: string; value: VoteValue }): Promise<void> => {
      if (value === null) {
        await client.DELETE('/api/articles/{articleId}/vote', { params: { path: { articleId } }, headers });
      } else {
        await client.PUT('/api/articles/{articleId}/vote', {
          params: { path: { articleId } },
          body: { value },
          headers,
        });
      }
    },
    onMutate: async ({ articleId, value }): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<FeedPage>(queryKey, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          items: old.items.map((a) => (a.id === articleId ? { ...a, vote: value } : a)),
        };
      });
    },
  });

// -- useFeed --

const useFeed = (): UseFeedResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortMode>('top');
  const [status, setStatus] = useState<ReadStatus>('unread');
  const [window, setWindow] = useState<TimeWindow>(DEFAULT_TIME_WINDOW);

  const paged = usePagedQuery<FeedArticle>({
    queryKey: (offset) => queryKeys.feed({ sort, status, window, offset }),
    fetchPage: async ({ offset, limit }): Promise<FeedPage> => {
      const { data } = await client.GET('/api/feed', {
        params: { query: { offset, limit, sort, status, ...windowToRange(window) } },
        headers,
      });
      return data as FeedPage;
    },
    pageSize: PAGE_SIZE,
    enabled: !!headers,
  });

  const { bookmarkedIds, toggleBookmark } = useBookmarkStatus(paged.items.map((a) => a.id));
  const voteMutation = useFeedVoteMutation(headers, queryClient, paged.queryKey);

  const changeFilter = (params?: FeedFilters): void => {
    if (params?.sort !== undefined) {
      setSort(params.sort);
    }
    if (params?.status !== undefined) {
      setStatus(params.status);
    }
    if (params?.window !== undefined) {
      setWindow(params.window);
    }
    paged.pagination.reset();
  };

  return {
    articles: paged.items,
    total: paged.total,
    bookmarkedIds,
    isLoading: paged.isLoading,
    sort,
    status,
    window,
    pagination: paged.pagination,
    changeFilter,
    vote: (articleId: string, value: VoteValue): void => {
      voteMutation.mutate({ articleId, value });
    },
    toggleBookmark,
  };
};

export type { FeedArticle, FeedPage, FeedFilters, SortMode, ReadStatus, TimeWindow, VoteValue, UseFeedResult };
export { useFeed, PAGE_SIZE };
