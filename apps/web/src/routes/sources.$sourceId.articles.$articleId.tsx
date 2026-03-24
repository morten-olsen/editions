import { createFileRoute, useRouter } from '@tanstack/react-router';

import { useArticleDetail } from '../hooks/articles/articles.hooks.ts';
import { useReadingProgress } from '../hooks/articles/articles.reading-progress.ts';
import { BookmarkButton } from '../components/bookmark-button.tsx';
import { Button } from '../components/button.tsx';
import { MediaPlayer } from '../components/media-player.tsx';
import { ArticleView } from '../components/article/article.presets.tsx';
import { FeedFooter } from '../components/article/article.footers.tsx';

/* ── Article page ────────────────────────────────────────────── */

const ArticlePage = (): React.ReactNode => {
  const router = useRouter();
  const { sourceId, articleId } = Route.useParams();

  const detail = useArticleDetail({ sourceId, articleId });

  const isPodcast = detail.article?.sourceType === 'podcast';
  useReadingProgress(articleId, isPodcast ? 0 : (detail.article?.progress ?? 0));

  if (detail.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (detail.error || !detail.article) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="text-center">
          <div className="font-serif text-xl text-ink mb-2">
            {detail.error instanceof Error ? detail.error.message : 'Article not found'}
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const { article } = detail;
  const displayContent = isPodcast ? null : article.content;
  const displaySummary = isPodcast ? (article.summary ?? article.content) : article.summary;

  return (
    <div className="min-h-dvh bg-surface" data-ai-id="article-reader" data-ai-role="page" data-ai-label={article.title}>
      <ReaderHeader detail={detail} onBack={() => router.history.back()} />

      <div className="px-4 md:px-6 pt-16 pb-8">
        <ArticleView
          style="editorial"
          title={article.title}
          sourceName={article.sourceName}
          author={article.author}
          summary={displaySummary}
          publishedAt={article.publishedAt}
          consumptionTimeSeconds={article.consumptionTimeSeconds}
          imageUrl={article.imageUrl}
          sourceType={article.sourceType}
          content={displayContent}
          footer={
            <FeedFooter
              vote={detail.vote}
              onVote={(v) => void detail.handleVote(v)}
              onDone={() => void detail.handleMarkDoneAndBack(() => router.history.back())}
              articleUrl={article.url}
              delay={0.5}
            />
          }
        >
          {article.mediaUrl && (
            <div className="mt-8">
              <MediaPlayer
                mediaUrl={article.mediaUrl}
                mediaType={article.mediaType}
                articleId={article.id}
                initialProgress={article.progress}
                delay={0}
              />
            </div>
          )}
        </ArticleView>
      </div>
    </div>
  );
};

/* ── Reader header ───────────────────────────────────────────── */

type ArticleDetailResult = ReturnType<typeof useArticleDetail>;

const ReaderHeader = ({ detail, onBack }: { detail: ArticleDetailResult; onBack: () => void }): React.ReactElement => (
  <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-sm">
    <div className="max-w-prose mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-mono tracking-wide text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
        data-ai-id="reader-back"
        data-ai-role="button"
        data-ai-label="Go back"
      >
        ← Back
      </button>
      <div className="flex items-center gap-3">
        <BookmarkButton bookmarked={detail.bookmarked} onToggle={() => void detail.handleToggleBookmark()} />
        <button
          type="button"
          onClick={() => void detail.handleToggleRead()}
          className="text-xs text-ink-tertiary hover:text-ink transition-colors duration-fast cursor-pointer"
        >
          {detail.isRead ? 'Mark unread' : 'Mark read'}
        </button>
        {detail.article?.url && (
          <a
            href={detail.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-tertiary hover:text-accent transition-colors duration-fast"
          >
            Original
          </a>
        )}
      </div>
    </div>
  </header>
);

/* ── Route ───────────────────────────────────────────────────── */

const Route = createFileRoute('/sources/$sourceId/articles/$articleId')({
  component: ArticlePage,
});

export { Route };
