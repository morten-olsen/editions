import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../../api/api.ts";
import { useAuthHeaders, queryKeys } from "../../api/api.hooks.ts";
import { usePagination } from "../utilities/use-pagination.ts";
import type { UsePaginationResult } from "../utilities/use-pagination.ts";

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

type BookmarksPage = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  offset: number;
  limit: number;
};

type UseBookmarksResult = {
  bookmarks: BookmarkWithArticle[];
  total: number;
  isLoading: boolean;
  pagination: UsePaginationResult;
  saveUrl: string;
  setSaveUrl: (url: string) => void;
  saveError: string | null;
  isSaving: boolean;
  handleSaveUrl: (e: React.FormEvent) => void;
  removeBookmark: (articleId: string) => void;
};

const PAGE_SIZE = 30;

const useBookmarks = (): UseBookmarksResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [saveUrl, setSaveUrl] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastTotal = useRef(0);

  const pagination = usePagination({
    pageSize: PAGE_SIZE,
    total: lastTotal.current,
  });

  const queryKey = [...queryKeys.bookmarks.all, pagination.offset] as const;

  const { data: page, isLoading } = useQuery<BookmarksPage>({
    queryKey,
    queryFn: async (): Promise<BookmarksPage> => {
      const { data } = await client.GET("/api/bookmarks", {
        params: { query: { offset: pagination.offset, limit: PAGE_SIZE } },
        headers,
      });
      return data as BookmarksPage;
    },
    enabled: !!headers,
  });

  // Keep ref in sync so usePagination gets the real total on next render.
  if (page) {
    lastTotal.current = page.total;
  }

  const total = page?.total ?? 0;

  const saveMutation = useMutation({
    mutationFn: async (url: string): Promise<void> => {
      const { error: err } = await client.POST("/api/bookmarks/save", {
        body: { url },
        headers,
      });
      if (err) {
        throw new Error(
          "error" in err ? (err as { error: string }).error : "Failed to save article",
        );
      }
    },
    onSuccess: (): void => {
      setSaveUrl("");
      setSaveError(null);
      pagination.reset();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all });
    },
    onError: (err: Error): void => {
      setSaveError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (articleId: string): Promise<void> => {
      await client.DELETE("/api/articles/{articleId}/bookmark", {
        params: { path: { articleId } },
        headers,
      });
    },
    onMutate: async (articleId: string): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<BookmarksPage>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          bookmarks: old.bookmarks.filter((b) => b.articleId !== articleId),
          total: old.total - 1,
        };
      });
    },
  });

  const handleSaveUrl = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = saveUrl.trim();
    if (!trimmed) return;
    setSaveError(null);
    saveMutation.mutate(trimmed);
  };

  return {
    bookmarks: page?.bookmarks ?? [],
    total,
    isLoading,
    pagination,
    saveUrl,
    setSaveUrl,
    saveError,
    isSaving: saveMutation.isPending,
    handleSaveUrl,
    removeBookmark: removeMutation.mutate,
  };
};

export type { BookmarkWithArticle, BookmarksPage, UseBookmarksResult };
export { useBookmarks, PAGE_SIZE };
