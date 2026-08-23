import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import type { Page } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { usePagedQuery } from '../utilities/use-paged-query.ts';
import type { PagerControls } from '../utilities/use-paged-query.ts';

type BookmarkWithArticle = {
  id: string;
  articleId: string;
  createdAt: string;
  articleTitle: string;
  articleUrl: string | null;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  sourceId: string;
  sourceName: string;
  sourceType: string;
};

type BookmarksPage = Page<BookmarkWithArticle>;

type UseBookmarksResult = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  isLoading: boolean;
  pagination: PagerControls;
  saveUrl: string;
  setSaveUrl: (url: string) => void;
  saveError: string | null;
  isSaving: boolean;
  handleSaveUrl: (e: React.FormEvent) => void;
  removeBookmark: (articleId: string) => void;
};

const PAGE_SIZE = 30;

const useSaveBookmark = (
  headers: Record<string, string> | undefined,
  pagination: PagerControls,
  setSaveUrl: (url: string) => void,
  setSaveError: (error: string | null) => void,
): { saveMutation: ReturnType<typeof useMutation<void, Error, string, unknown>> } => {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (url: string): Promise<void> => {
      const { error: err } = await client.POST('/api/bookmarks/save', { body: { url }, headers });
      if (err) {
        throw new Error('error' in err ? (err as { error: string }).error : 'Failed to save article');
      }
    },
    onSuccess: (): void => {
      setSaveUrl('');
      setSaveError(null);
      pagination.reset();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
    },
    onError: (err: Error): void => setSaveError(err.message),
  });

  return { saveMutation };
};

const useBookmarks = (): UseBookmarksResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [saveUrl, setSaveUrl] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const paged = usePagedQuery<BookmarkWithArticle>({
    queryKey: (offset) => [...queryKeys.bookmarks.all, offset],
    fetchPage: async ({ offset, limit }): Promise<BookmarksPage> => {
      const { data } = await client.GET('/api/bookmarks', {
        params: { query: { offset, limit } },
        headers,
      });
      return data as BookmarksPage;
    },
    pageSize: PAGE_SIZE,
    enabled: !!headers,
  });

  const { pagination, queryKey } = paged;

  const { saveMutation } = useSaveBookmark(headers, pagination, setSaveUrl, setSaveError);

  const removeMutation = useMutation({
    mutationFn: async (articleId: string): Promise<void> => {
      await client.DELETE('/api/articles/{articleId}/bookmark', { params: { path: { articleId } }, headers });
    },
    onMutate: async (articleId: string): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<BookmarksPage>(queryKey, (old) => {
        if (!old) {
          return old;
        }
        return { ...old, items: old.items.filter((b) => b.articleId !== articleId), total: old.total - 1 };
      });
    },
  });

  const handleSaveUrl = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = saveUrl.trim();
    if (!trimmed) {
      return;
    }
    setSaveError(null);
    saveMutation.mutate(trimmed);
  };

  return {
    bookmarks: paged.items,
    total: paged.total,
    isLoading: paged.isLoading,
    pagination,
    saveUrl,
    setSaveUrl,
    saveError,
    isSaving: saveMutation.isPending,
    handleSaveUrl,
    removeBookmark: removeMutation.mutate,
  };
};

/* ── Bookmark status for a list of articles ──────────────────── */

type UseBookmarkStatusResult = {
  bookmarkedIds: Set<string>;
  isBookmarked: (articleId: string) => boolean;
  toggleBookmark: (articleId: string) => void;
};

const emptySet = new Set<string>();

const useBookmarkStatus = (articleIds: string[]): UseBookmarkStatusResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const sortedKey = [...articleIds].sort();
  const queryKey = ['bookmarks', 'check', sortedKey] as const;

  const { data: bookmarkedIds = emptySet } = useQuery<Set<string>>({
    queryKey,
    queryFn: async (): Promise<Set<string>> => {
      const { data: bmData } = await client.POST('/api/bookmarks/check', {
        body: { articleIds },
        headers,
      });
      if (bmData) {
        return new Set((bmData as { bookmarkedIds: string[] }).bookmarkedIds);
      }
      return new Set();
    },
    enabled: !!headers && articleIds.length > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ articleId, wasBookmarked }: { articleId: string; wasBookmarked: boolean }): Promise<void> => {
      if (wasBookmarked) {
        await client.DELETE('/api/articles/{articleId}/bookmark', { params: { path: { articleId } }, headers });
      } else {
        await client.PUT('/api/articles/{articleId}/bookmark', { params: { path: { articleId } }, headers });
      }
    },
    onMutate: async ({ articleId, wasBookmarked }): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<Set<string>>(queryKey, (old) => {
        const next = new Set(old);
        if (wasBookmarked) {
          next.delete(articleId);
        } else {
          next.add(articleId);
        }
        return next;
      });
    },
    onError: (): void => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const isBookmarked = useCallback((articleId: string): boolean => bookmarkedIds.has(articleId), [bookmarkedIds]);

  const toggleBookmark = useCallback(
    (articleId: string): void => {
      toggleMutation.mutate({ articleId, wasBookmarked: bookmarkedIds.has(articleId) });
    },
    [bookmarkedIds, toggleMutation],
  );

  return { bookmarkedIds, isBookmarked, toggleBookmark };
};

export type { BookmarkWithArticle, BookmarksPage, UseBookmarksResult, UseBookmarkStatusResult };
export { useBookmarks, useBookmarkStatus, PAGE_SIZE };
