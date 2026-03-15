import { useState, useCallback, useEffect } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { client } from '../api/api.ts';
import { useAuthHeaders, queryKeys } from '../api/api.hooks.ts';
import { Button } from '../components/button.tsx';
import type { VoteValue } from '../components/vote-controls.tsx';
import { groupByFocus } from '../views/editions/edition-types.ts';
import type { EditionDetail } from '../views/editions/edition-types.ts';
import { MagazineView } from '../views/editions/edition-magazine-view.tsx';
import { EditionListView } from '../views/editions/edition-list-view.tsx';

type ViewMode = 'list' | 'magazine';

const useEditionViewData = (
  editionId: string,
  headers: Record<string, string> | undefined,
): { edition: EditionDetail | undefined; isLoading: boolean; error: Error | null } => {
  const { data, isLoading, error } = useQuery<EditionDetail>({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async (): Promise<EditionDetail> => {
      const { data: d, error: err } = await client.GET('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers,
      });
      if (err) {
        throw new Error('Edition not found');
      }
      return d as EditionDetail;
    },
    enabled: !!headers,
  });
  return { edition: data, isLoading, error };
};

type EditionActionsResult = {
  isRead: boolean;
  votes: Record<string, VoteValue>;
  handleToggleRead: () => Promise<void>;
  handleMarkDoneAndBack: () => Promise<void>;
  handleDelete: () => void;
  handleEditionVote: (articleId: string, value: VoteValue) => Promise<void>;
  handleMarkArticleViewed: (sourceId: string, articleId: string) => Promise<void>;
};

const useEditionReadState = (
  edition: EditionDetail | undefined,
): { isRead: boolean; setIsRead: (v: boolean) => void } => {
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    if (edition) {
      setIsRead(!!edition.readAt);
    }
  }, [edition?.id]);

  return { isRead, setIsRead };
};

const useEditionVotes = (
  editionId: string,
  headers: Record<string, string> | undefined,
): { votes: Record<string, VoteValue>; handleEditionVote: (articleId: string, value: VoteValue) => Promise<void> } => {
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});

  const handleEditionVote = async (articleId: string, value: VoteValue): Promise<void> => {
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

  return { votes, handleEditionVote };
};

const useEditionActions = (
  configId: string,
  editionId: string,
  headers: Record<string, string> | undefined,
  edition: EditionDetail | undefined,
): EditionActionsResult => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isRead, setIsRead } = useEditionReadState(edition);
  const { votes, handleEditionVote } = useEditionVotes(editionId, headers);

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.DELETE('/api/editions/{editionId}', { params: { path: { editionId } }, headers });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void navigate({ to: '/' });
    },
  });

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

  const handleDelete = (): void => {
    if (!edition || !confirm(`Delete "${edition.title}"?`)) {
      return;
    }
    deleteMutation.mutate();
  };

  const handleMarkArticleViewed = async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT('/api/sources/{id}/articles/{articleId}/read', {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  };

  return {
    isRead,
    votes,
    handleToggleRead,
    handleMarkDoneAndBack,
    handleDelete,
    handleEditionVote,
    handleMarkArticleViewed,
  };
};

const EditionViewPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const { configId, editionId } = Route.useParams();
  const [view, setView] = useState<ViewMode>('list');

  const { edition, isLoading, error } = useEditionViewData(editionId, headers);
  const actions = useEditionActions(configId, editionId, headers, edition);
  const handleExitMagazine = useCallback((): void => setView('list'), []);

  if (!headers || isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (error || !edition) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {error instanceof Error ? error.message : 'Edition not found'}
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const sections = groupByFocus(edition.articles);

  if (view === 'magazine') {
    return (
      <MagazineView
        edition={edition}
        sections={sections}
        votes={actions.votes}
        onVote={(articleId, value) => void actions.handleEditionVote(articleId, value)}
        onMarkArticleViewed={(sourceId, articleId) => void actions.handleMarkArticleViewed(sourceId, articleId)}
        onExit={handleExitMagazine}
        onMarkDone={() => void actions.handleMarkDoneAndBack()}
      />
    );
  }

  return (
    <EditionListView
      edition={edition}
      sections={sections}
      votes={actions.votes}
      isRead={actions.isRead}
      onToggleRead={() => void actions.handleToggleRead()}
      onDelete={actions.handleDelete}
      onVote={(articleId, value) => void actions.handleEditionVote(articleId, value)}
      onMarkDone={() => void actions.handleMarkDoneAndBack()}
      onOpenMagazine={() => setView('magazine')}
      onBack={() => router.history.back()}
    />
  );
};

const Route = createFileRoute('/editions/$configId/issues/$editionId/')({
  component: EditionViewPage,
});

export { Route };
