import { useCallback, useEffect } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';

import { client } from '../api/api.ts';
import { useAuthHeaders } from '../api/api.hooks.ts';
import { Button } from '../components/button.tsx';
import {
  useEditionDetailQuery,
  useEditionVoting,
  useGlobalVoting,
  useFocusVoting,
  useMarkArticleViewed,
} from '../hooks/editions/editions.view-hooks.ts';
import { useBookmarkStatus } from '../hooks/bookmarks/bookmarks.hooks.ts';
import { MagazineView } from '../views/editions/edition-magazine-view.tsx';

/* ── Page component ──────────────────────────────────────────────── */

const EditionPage = (): React.ReactNode => {
  const headers = useAuthHeaders();
  const router = useRouter();
  const navigate = useNavigate();
  const { editionId } = Route.useParams();

  const { edition, isLoading, error, sections } = useEditionDetailQuery(editionId);
  const { votes, handleVote: handleEditionVote } = useEditionVoting(editionId);
  const { globalVotes, handleGlobalVote } = useGlobalVoting();
  const { focusVotes, handleFocusVote } = useFocusVoting();
  const handleMarkArticleViewed = useMarkArticleViewed();
  const { bookmarkedIds, toggleBookmark } = useBookmarkStatus(
    edition?.articles.map((a) => a.id) ?? [],
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
    handleExit();
  }, [editionId, headers, handleExit]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleExit]);

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
          <Button variant="ghost" size="sm" onClick={handleExit}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <MagazineView
      edition={edition}
      sections={sections}
      votes={votes}
      globalVotes={globalVotes}
      focusVotes={focusVotes}
      bookmarkedIds={bookmarkedIds}
      onVote={handleEditionVote}
      onGlobalVote={handleGlobalVote}
      onFocusVote={handleFocusVote}
      onBookmarkToggle={toggleBookmark}
      onMarkArticleViewed={handleMarkArticleViewed}
      onExit={handleExit}
      onMarkDone={() => void handleMarkDone()}
    />
  );
};

const Route = createFileRoute('/editions/$configId/issues/$editionId')({
  component: EditionPage,
});

export { Route };
