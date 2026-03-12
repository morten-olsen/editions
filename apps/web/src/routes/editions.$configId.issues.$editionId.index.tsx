import { useState, useCallback } from 'react';
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

const EditionViewPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const { configId, editionId } = Route.useParams();
  const [isRead, setIsRead] = useState(false);
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [view, setView] = useState<ViewMode>('list');

  const queryKey = queryKeys.editions.detail(editionId);

  const {
    data: edition,
    isLoading,
    error,
  } = useQuery<EditionDetail>({
    queryKey,
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

  const [initialized, setInitialized] = useState(false);
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
    await navigate({ to: '/editions/$configId', params: { configId } });
  };

  const deleteMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await client.DELETE('/api/editions/{editionId}', {
        params: { path: { editionId } },
        headers,
      });
    },
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.editions.forConfig(configId) });
      void navigate({ to: '/editions/$configId', params: { configId } });
    },
  });

  const handleDelete = (): void => {
    if (!edition) {
      return;
    }
    if (!confirm(`Delete "${edition.title}"?`)) {
      return;
    }
    deleteMutation.mutate();
  };

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

  const handleMarkArticleViewed = async (sourceId: string, articleId: string): Promise<void> => {
    await client.PUT('/api/sources/{id}/articles/{articleId}/read', {
      params: { path: { id: sourceId, articleId } },
      body: { read: true },
      headers,
    });
  };

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
        votes={votes}
        onVote={(articleId, value) => void handleEditionVote(articleId, value)}
        onMarkArticleViewed={(sourceId, articleId) => void handleMarkArticleViewed(sourceId, articleId)}
        onExit={handleExitMagazine}
        onMarkDone={() => void handleMarkDoneAndBack()}
      />
    );
  }

  return (
    <EditionListView
      edition={edition}
      sections={sections}
      votes={votes}
      isRead={isRead}
      onToggleRead={() => void handleToggleRead()}
      onDelete={handleDelete}
      onVote={(articleId, value) => void handleEditionVote(articleId, value)}
      onMarkDone={() => void handleMarkDoneAndBack()}
      onOpenMagazine={() => setView('magazine')}
      onBack={() => router.history.back()}
    />
  );
};

const Route = createFileRoute('/editions/$configId/issues/$editionId/')({
  component: EditionViewPage,
});

export { Route };
