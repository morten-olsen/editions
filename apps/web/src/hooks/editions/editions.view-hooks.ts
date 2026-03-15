import { useState, useCallback, useRef } from 'react';
import { useRouter, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../../api/api.ts';
import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';

import { groupByFocus } from './editions.utils.ts';
import type { VoteValue, EditionDetail, FocusSection, ViewMode } from './editions.types.ts';

/* ── useEditionDetailQuery (shared) ───────────────────────────────── */

const useEditionDetailQuery = (
  editionId: string,
): {
  edition: EditionDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  sections: FocusSection[];
} => {
  const headers = useAuthHeaders();

  const {
    data: edition,
    isLoading,
    error,
  } = useQuery<EditionDetail>({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async (): Promise<EditionDetail> => {
      const { data, error: err } = await client.GET('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers,
      });
      if (err) {
        throw new Error('Edition not found');
      }
      return data as EditionDetail;
    },
    enabled: !!headers,
  });

  const sections = edition ? groupByFocus(edition.articles) : [];

  return { edition, isLoading, error: error as Error | null, sections };
};

/* ── useEditionVoting (shared vote logic) ─────────────────────────── */

const useEditionVoting = (
  editionId: string,
): {
  votes: Record<string, VoteValue>;
  handleVote: (articleId: string, value: VoteValue) => Promise<void>;
} => {
  const headers = useAuthHeaders();
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});

  const handleVote = async (articleId: string, value: VoteValue): Promise<void> => {
    setVotes((prev) => ({ ...prev, [articleId]: value }));
    if (value === null) {
      await client.DELETE('/api/editions/{editionId}/articles/{articleId}/vote', {
        params: { path: { editionId, articleId } },
        headers,
      });
    } else {
      await client.PUT('/api/editions/{editionId}/articles/{articleId}/vote', {
        params: { path: { editionId, articleId } },
        body: { value },
        headers,
      });
    }
  };

  return { votes, handleVote };
};

/* ── useMarkArticleViewed (shared) ────────────────────────────────── */

const useMarkArticleViewed = (): ((sourceId: string, articleId: string) => Promise<void>) => {
  const headers = useAuthHeaders();

  return useCallback(
    async (sourceId: string, articleId: string): Promise<void> => {
      await client.PUT('/api/sources/{id}/articles/{articleId}/read', {
        params: { path: { id: sourceId, articleId } },
        body: { read: true },
        headers,
      });
    },
    [headers],
  );
};

/* ── useEditionView ───────────────────────────────────────────────── */

type UseEditionViewReturn = {
  edition: EditionDetail | undefined;
  sections: FocusSection[];
  isLoading: boolean;
  error: Error | null;
  isRead: boolean;
  votes: Record<string, VoteValue>;
  view: ViewMode;
  setView: React.Dispatch<React.SetStateAction<ViewMode>>;
  handleToggleRead: () => Promise<void>;
  handleMarkDoneAndBack: () => Promise<void>;
  handleDelete: () => void;
  handleEditionVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleMarkArticleViewed: (sourceId: string, articleId: string) => Promise<void>;
  handleExitMagazine: () => void;
  handleGoBack: () => void;
};

const useEditionView = ({ configId, editionId }: { configId: string; editionId: string }): UseEditionViewReturn => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [isRead, setIsRead] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [initialized, setInitialized] = useState(false);

  const { edition, isLoading, error, sections } = useEditionDetailQuery(editionId);
  const { votes, handleVote } = useEditionVoting(editionId);
  const markArticleViewed = useMarkArticleViewed();

  if (edition && !initialized) {
    setIsRead(!!edition.readAt);
    setInitialized(true);
  }

  const handleToggleRead = async (): Promise<void> => {
    if (!edition) {
      return;
    }
    const newRead = !isRead;
    setIsRead(newRead);
    await client.PUT('/api/editions/{editionId}/read', {
      params: { path: { editionId } },
      body: { read: newRead },
      headers,
    });
  };

  const handleMarkDoneAndBack = async (): Promise<void> => {
    if (!edition) {
      return;
    }
    if (!isRead) {
      setIsRead(true);
      await client.PUT('/api/editions/{editionId}/read', {
        params: { path: { editionId } },
        body: { read: true },
        headers,
      });
    }
    await navigate({ to: '/' });
  };

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.DELETE('/api/editions/{editionId}', { params: { path: { editionId } }, headers });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void navigate({ to: '/' });
    },
  });

  const handleDelete = (): void => {
    if (!edition || !confirm(`Delete "${edition.title}"?`)) {
      return;
    }
    deleteMutation.mutate();
  };

  return {
    edition,
    sections,
    isLoading,
    error,
    isRead,
    votes,
    view,
    setView,
    handleToggleRead,
    handleMarkDoneAndBack,
    handleDelete,
    handleEditionVote: handleVote,
    handleMarkArticleViewed: markArticleViewed,
    handleExitMagazine: useCallback((): void => setView('list'), []),
    handleGoBack: useCallback((): void => {
      router.history.back();
    }, [router.history]),
  };
};

/* ── useMagazineView ──────────────────────────────────────────────── */

type UseMagazineViewReturn = {
  edition: EditionDetail | undefined;
  sections: FocusSection[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageRef: React.MutableRefObject<number>;
  votes: Record<string, VoteValue>;
  handlePageChange: (newPage: number) => void;
  handleExit: () => void;
  handleMarkDone: () => Promise<void>;
  handleVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleMarkArticleViewed: (sourceId: string, articleId: string) => Promise<void>;
};

const buildPageArticleMap = (sections: FocusSection[]): Map<number, { sourceId: string; articleId: string }> => {
  const map = new Map<number, { sourceId: string; articleId: string }>();
  let pageIdx = 2;
  sections.forEach((section) => {
    pageIdx += 1;
    section.articles.forEach((article) => {
      map.set(pageIdx, { sourceId: article.sourceId, articleId: article.id });
      pageIdx += 1;
    });
  });
  return map;
};

const useMagazineView = (editionId: string): UseMagazineViewReturn => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);

  const { edition, isLoading, error, sections } = useEditionDetailQuery(editionId);
  const { votes, handleVote: editionVote } = useEditionVoting(editionId);
  const markArticleViewed = useMarkArticleViewed();

  const pageArticleMap = useRef<Map<number, { sourceId: string; articleId: string }>>(new Map());
  pageArticleMap.current = buildPageArticleMap(sections);

  const handlePageChange = useCallback(
    (newPage: number): void => {
      const articleInfo = pageArticleMap.current.get(pageRef.current);
      if (articleInfo && newPage !== pageRef.current) {
        void markArticleViewed(articleInfo.sourceId, articleInfo.articleId);
      }
      pageRef.current = newPage;
      setPage(newPage);
    },
    [markArticleViewed],
  );

  const handleExit = useCallback((): void => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: '/' });
    }
  }, [router.history, navigate]);

  const handleMarkDone = useCallback(async (): Promise<void> => {
    await client.PUT('/api/editions/{editionId}/read', {
      params: { path: { editionId } },
      body: { read: true },
      headers,
    });
    if (window.history.length > 1) {
      router.history.back();
    } else {
      await navigate({ to: '/' });
    }
  }, [editionId, headers, router.history, navigate]);

  const handleVote = useCallback(
    async (articleId: string, value: VoteValue): Promise<void> => {
      await editionVote(articleId, value);
    },
    [editionVote],
  );

  return {
    edition,
    sections,
    isLoading,
    error,
    page,
    pageRef,
    votes,
    handlePageChange,
    handleExit,
    handleMarkDone,
    handleVote,
    handleMarkArticleViewed: markArticleViewed,
  };
};

export type { UseEditionViewReturn, UseMagazineViewReturn };
export { useEditionView, useMagazineView };
