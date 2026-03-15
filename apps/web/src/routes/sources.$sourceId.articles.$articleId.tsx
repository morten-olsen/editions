import { createFileRoute, useRouter } from '@tanstack/react-router';
import { motion } from 'motion/react';

import { useArticleDetail } from '../hooks/articles/articles.hooks.ts';
import { useArticleFocuses } from '../hooks/articles/articles.focuses.ts';
import { useReadingProgress } from '../hooks/articles/articles.reading-progress.ts';
import { BookmarkButton } from '../components/bookmark-button.tsx';
import { FocusInsight, type FocusClassification } from '../components/focus-insight.tsx';
import { Button } from '../components/button.tsx';
import { MediaPlayer } from '../components/media-player.tsx';
import { VoteControls } from '../components/vote-controls.tsx';
import {
  ArticleBody,
  AnimatedSummary,
  Byline,
  easeOut,
} from '../components/magazine/magazine.article.tsx';

/* ── Article page ────────────────────────────────────────────────── */

const ArticlePage = (): React.ReactNode => {
  const router = useRouter();
  const { sourceId, articleId } = Route.useParams();

  const detail = useArticleDetail({ sourceId, articleId });
  const { classifications } = useArticleFocuses(articleId);

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
  const hasContent = displayContent !== null && displayContent.length > 0;

  return (
    <div className="min-h-dvh bg-surface" data-ai-id="article-reader" data-ai-role="page" data-ai-label={article.title}>
      <ReaderHeader detail={detail} onBack={() => router.history.back()} />

      {/* Hero — editorial style, reusing magazine primitives */}
      <div className="max-w-prose mx-auto w-full px-4 md:px-6 pt-16 pb-8" data-ai-id="article-hero" data-ai-role="section" data-ai-label="Article header">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="text-xs font-mono tracking-wide text-accent mb-6 text-center"
        >
          {article.sourceName}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-tight text-ink text-center mb-8"
        >
          {article.title}
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.2 }}
          className="w-12 h-px bg-border-strong mx-auto mb-8"
        />

        {article.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.25 }}
            className="aspect-[16/9] rounded-lg overflow-hidden bg-surface-sunken mb-8"
          >
            <img src={article.imageUrl} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}

        <AnimatedSummary summary={displaySummary} hasContent={hasContent} delay={0.3} className="text-center" />

        <Byline
          author={article.author}
          publishedAt={article.publishedAt}
          consumptionTimeSeconds={article.consumptionTimeSeconds}
          sourceType={article.sourceType}
          centered
          delay={0.35}
        />
      </div>

      {/* Media player for podcasts */}
      {article.mediaUrl && (
        <div className="max-w-prose mx-auto px-4 md:px-6 mb-10">
          <MediaPlayer
            mediaUrl={article.mediaUrl}
            mediaType={article.mediaType}
            articleId={article.id}
            initialProgress={article.progress}
            delay={0}
          />
        </div>
      )}

      {/* Article body — shared with magazine */}
      {hasContent && (
        <div className="max-w-prose mx-auto px-4 md:px-6">
          <ArticleBody content={displayContent!} delay={0.4} />
        </div>
      )}

      {/* Footer */}
      <div className="max-w-prose mx-auto px-4 md:px-6 pb-16">
        <ReaderFooter detail={detail} classifications={classifications} onBack={() => router.history.back()} />
      </div>
    </div>
  );
};

/* ── Reader header ───────────────────────────────────────────────── */

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

/* ── Reader footer ───────────────────────────────────────────────── */

const ReaderFooter = ({
  detail,
  classifications,
  onBack,
}: {
  detail: ArticleDetailResult;
  classifications: FocusClassification[];
  onBack: () => void;
}): React.ReactNode => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay: 0.5 }}
  >
    <div className="w-px h-8 bg-border mx-auto mt-16 mb-8" />

    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-2 mb-6">
        <VoteControls value={detail.vote} onVote={(v) => void detail.handleVote(v)} label="Quality" />
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="primary" size="sm" onClick={() => void detail.handleMarkDoneAndBack(onBack)}>
          Done
        </Button>
        {detail.article?.url && (
          <a href={detail.article.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              View original
            </Button>
          </a>
        )}
      </div>
    </div>

    {classifications.length > 0 && (
      <div className="pt-6 border-t border-border">
        <FocusInsight classifications={classifications} />
      </div>
    )}
  </motion.div>
);

/* ── Route ───────────────────────────────────────────────────────── */

const Route = createFileRoute('/sources/$sourceId/articles/$articleId')({
  component: ArticlePage,
});

export { Route };
