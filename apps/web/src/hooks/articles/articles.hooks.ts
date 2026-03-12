import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders } from '../../api/api.hooks.ts';

type VoteValue = 1 | -1 | null;

type ArticleDetail = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  consumptionTimeSeconds: number | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  imageUrl: string | null;
  publishedAt: string | null;
  readAt: string | null;
  extractedAt: string | null;
  progress: number;
};

type ArticleData = {
  article: ArticleDetail;
  vote: VoteValue;
  bookmarked: boolean;
};

type UseArticleDetailParams = {
  sourceId: string;
  articleId: string;
};

type UseArticleDetailResult = {
  article: ArticleDetail | null;
  vote: VoteValue;
  isRead: boolean;
  bookmarked: boolean;
  isLoading: boolean;
  error: Error | null;
  handleVote: (value: VoteValue) => Promise<void>;
  handleToggleBookmark: () => Promise<void>;
  handleToggleRead: () => Promise<void>;
  handleMarkDoneAndBack: (goBack: () => void) => Promise<void>;
};

const formatConsumptionTime = (seconds: number, sourceType: string): string => {
  const minutes = Math.round(seconds / 60);
  const suffix = sourceType === 'podcast' ? 'listen' : 'read';
  if (minutes < 1) {
    return `< 1 min ${suffix}`;
  }
  return `${minutes} min ${suffix}`;
};

const formatPublishedDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const useArticleDetail = ({ sourceId, articleId }: UseArticleDetailParams): UseArticleDetailResult => {
  const headers = useAuthHeaders();
  const [vote, setVote] = useState<VoteValue>(null);
  const [isRead, setIsRead] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading, error } = useQuery<ArticleData>({
    queryKey: ['sources', sourceId, 'articles', articleId],
    queryFn: async (): Promise<ArticleData> => {
      const [articleRes, voteRes, bookmarkRes] = await Promise.all([
        client.GET('/api/sources/{id}/articles/{articleId}', {
          params: { path: { id: sourceId, articleId } },
          headers,
        }),
        client.GET('/api/articles/{articleId}/vote', {
          params: { path: { articleId } },
          headers,
        }),
        client.GET('/api/articles/{articleId}/bookmark', {
          params: { path: { articleId } },
          headers,
        }),
      ]);

      if (articleRes.error) {
        throw new Error('Article not found');
      }

      const article = articleRes.data as ArticleDetail;
      const voteValue = voteRes.data ? (voteRes.data as { value: 1 | -1 }).value : null;
      const isBookmarked = bookmarkRes.data ? (bookmarkRes.data as { bookmarked: boolean }).bookmarked : false;

      return { article, vote: voteValue, bookmarked: isBookmarked };
    },
    enabled: !!headers,
  });

  // Initialize local state from query data when it first arrives
  if (data && !initialized) {
    setVote(data.vote);
    setIsRead(!!data.article.readAt);
    setBookmarked(data.bookmarked);
    setInitialized(true);
  }

  const article = data?.article ?? null;

  const handleVote = async (value: VoteValue): Promise<void> => {
    setVote(value);

    if (value === null) {
      await client.DELETE('/api/articles/{articleId}/vote', {
        params: { path: { articleId } },
        headers,
      });
    } else {
      await client.PUT('/api/articles/{articleId}/vote', {
        params: { path: { articleId } },
        body: { value },
        headers,
      });
    }
  };

  const handleToggleBookmark = async (): Promise<void> => {
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);

    if (newBookmarked) {
      await client.PUT('/api/articles/{articleId}/bookmark', {
        params: { path: { articleId } },
        headers,
      });
    } else {
      await client.DELETE('/api/articles/{articleId}/bookmark', {
        params: { path: { articleId } },
        headers,
      });
    }
  };

  const handleToggleRead = async (): Promise<void> => {
    const newRead = !isRead;
    setIsRead(newRead);
    await client.PUT('/api/sources/{id}/articles/{articleId}/read', {
      params: { path: { id: sourceId, articleId } },
      body: { read: newRead },
      headers,
    });
  };

  const handleMarkDoneAndBack = async (goBack: () => void): Promise<void> => {
    if (!isRead) {
      setIsRead(true);
      await client.PUT('/api/sources/{id}/articles/{articleId}/read', {
        params: { path: { id: sourceId, articleId } },
        body: { read: true },
        headers,
      });
    }
    goBack();
  };

  return {
    article,
    vote,
    isRead,
    bookmarked,
    isLoading: !headers || isLoading,
    error: error as Error | null,
    handleVote,
    handleToggleBookmark,
    handleToggleRead,
    handleMarkDoneAndBack,
  };
};

export type { ArticleDetail, ArticleData, VoteValue, UseArticleDetailParams, UseArticleDetailResult };
export { useArticleDetail, formatConsumptionTime, formatPublishedDate };
