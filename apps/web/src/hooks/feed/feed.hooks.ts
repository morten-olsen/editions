import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { usePagination } from '../utilities/use-pagination.ts';

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

type FeedPage = {
  articles: FeedArticle[];
  total: number;
  offset: number;
  limit: number;
};

type FeedData = {
  feedPage: FeedPage;
  bookmarkedIds: Set<string>;
};

type SortMode = 'top' | 'recent';
type ReadStatus = 'all' | 'unread' | 'read';
type TimeWindow = 'today' | 'week' | 'all';
type VoteValue = 1 | -1 | null;

type UseFeedResult = {
  feedPage: FeedPage | null;
  bookmarkedIds: Set<string>;
  isLoading: boolean;
  sort: SortMode;
  status: ReadStatus;
  window: TimeWindow;
  pagination: {
    offset: number;
    currentPage: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    goNext: () => void;
    goPrev: () => void;
  };
  changeFilter: (params?: { sort?: SortMode; status?: ReadStatus; window?: TimeWindow }) => void;
  vote: (articleId: string, value: VoteValue) => void;
  toggleBookmark: (articleId: string) => void;
};

const PAGE_SIZE = 20;

const windowToRange = (w: TimeWindow): { from?: string } => {
  if (w === 'all') {
    return {};
  }
  const ms = w === 'today' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return { from: new Date(Date.now() - ms).toISOString() };
};

const fetchFeedWithBookmarks = async (
  headers: Record<string, string> | undefined,
  params: { offset: number; sort: SortMode; status: ReadStatus; window: TimeWindow },
): Promise<FeedData> => {
  const { data: feedData } = await client.GET('/api/feed', {
    params: {
      query: {
        offset: params.offset,
        limit: PAGE_SIZE,
        sort: params.sort,
        status: params.status,
        ...windowToRange(params.window),
      },
    },
    headers,
  });

  const page = feedData as FeedPage;
  let bookmarkedIds = new Set<string>();

  const articleIds = page.articles.map((a) => a.id);
  if (articleIds.length > 0) {
    const { data: bmData } = await client.POST('/api/bookmarks/check', {
      body: { articleIds },
      headers,
    });
    if (bmData) {
      bookmarkedIds = new Set((bmData as { bookmarkedIds: string[] }).bookmarkedIds);
    }
  }

  return { feedPage: page, bookmarkedIds };
};

const useFeed = (): UseFeedResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortMode>('top');
  const [status, setStatus] = useState<ReadStatus>('unread');
  const [window, setWindow] = useState<TimeWindow>('all');
  const [total, setTotal] = useState(0);

  const pagination = usePagination({ pageSize: PAGE_SIZE, total });
  const queryKey = queryKeys.feed({ sort, status, window, offset: pagination.offset });

  const feedQuery = useQuery<FeedData>({
    queryKey,
    queryFn: async (): Promise<FeedData> => {
      const result = await fetchFeedWithBookmarks(headers, { offset: pagination.offset, sort, status, window });
      setTotal(result.feedPage.total);
      return result;
    },
    enabled: !!headers,
  });

  const feedPage = feedQuery.data?.feedPage ?? null;
  const bookmarkedIds = feedQuery.data?.bookmarkedIds ?? new Set<string>();

  const voteMutation = useMutation({
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
      queryClient.setQueryData<FeedData>(queryKey, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          feedPage: {
            ...old.feedPage,
            articles: old.feedPage.articles.map((a) => (a.id === articleId ? { ...a, vote: value } : a)),
          },
        };
      });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ articleId, bookmarked }: { articleId: string; bookmarked: boolean }): Promise<void> => {
      if (bookmarked) {
        await client.DELETE('/api/articles/{articleId}/bookmark', { params: { path: { articleId } }, headers });
      } else {
        await client.PUT('/api/articles/{articleId}/bookmark', { params: { path: { articleId } }, headers });
      }
    },
    onMutate: async ({ articleId, bookmarked }): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<FeedData>(queryKey, (old) => {
        if (!old) {
          return old;
        }
        const next = new Set(old.bookmarkedIds);
        if (bookmarked) {
          next.delete(articleId);
        } else {
          next.add(articleId);
        }
        return { ...old, bookmarkedIds: next };
      });
    },
  });

  const changeFilter = (params?: { sort?: SortMode; status?: ReadStatus; window?: TimeWindow }): void => {
    if (params?.sort !== undefined) {
      setSort(params.sort);
    }
    if (params?.status !== undefined) {
      setStatus(params.status);
    }
    if (params?.window !== undefined) {
      setWindow(params.window);
    }
    pagination.reset();
  };

  return {
    feedPage,
    bookmarkedIds,
    isLoading: feedQuery.isLoading,
    sort,
    status,
    window,
    pagination: {
      offset: pagination.offset,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      hasPrev: pagination.hasPrev,
      hasNext: pagination.hasNext,
      goNext: pagination.goNext,
      goPrev: pagination.goPrev,
    },
    changeFilter,
    vote: (articleId: string, value: VoteValue): void => {
      voteMutation.mutate({ articleId, value });
    },
    toggleBookmark: (articleId: string): void => {
      bookmarkMutation.mutate({ articleId, bookmarked: bookmarkedIds.has(articleId) });
    },
  };
};

export type { FeedArticle, FeedPage, FeedData, SortMode, ReadStatus, TimeWindow, VoteValue, UseFeedResult };
export { useFeed, PAGE_SIZE };
