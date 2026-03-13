import { createFileRoute, useRouter } from '@tanstack/react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useArticleDetail, formatConsumptionTime, formatPublishedDate } from '../hooks/articles/articles.hooks.ts';
import { BookmarkButton } from '../components/bookmark-button.tsx';
import { ReadingShell } from '../components/app-shell.tsx';
import { Button } from '../components/button.tsx';
import { MediaPlayer } from '../components/media-player.tsx';
import { Separator } from '../components/separator.tsx';
import { VoteControls } from '../components/vote-controls.tsx';

const ArticlePage = (): React.ReactNode => {
  const router = useRouter();
  const { sourceId, articleId } = Route.useParams();

  const detail = useArticleDetail({ sourceId, articleId });

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
  const isPodcast = article.sourceType === 'podcast';
  const displayContent = isPodcast ? null : article.content;
  const displaySummary = isPodcast ? (article.summary ?? article.content) : article.summary;
  const hasContent = displayContent !== null && displayContent.length > 0;

  return (
    <ReadingShell header={<ArticleHeader detail={detail} onBack={() => router.history.back()} />}>
      <ArticleMeta article={article} />
      {article.imageUrl && <ArticleImage url={article.imageUrl} />}
      {article.mediaUrl && <ArticleMedia article={article} />}
      <ArticleBody hasContent={hasContent} displayContent={displayContent} displaySummary={displaySummary} />
      <ArticleFooter detail={detail} onBack={() => router.history.back()} />
    </ReadingShell>
  );
};

/* ---- Header bar ---- */

type ArticleDetailResult = ReturnType<typeof useArticleDetail>;

const ArticleHeader = ({ detail, onBack }: { detail: ArticleDetailResult; onBack: () => void }): React.ReactElement => (
  <header className="border-b border-border bg-surface">
    <div className="max-w-prose mx-auto px-6 py-4 flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Back
      </Button>
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
            View original
          </a>
        )}
      </div>
    </div>
  </header>
);

/* ---- Article meta ---- */

type ArticleData = NonNullable<ArticleDetailResult['article']>;

const ArticleMeta = ({ article }: { article: ArticleData }): React.ReactNode => (
  <div className="mb-10">
    <div className="flex items-center gap-1.5 text-xs text-ink-tertiary mb-4">
      {article.publishedAt && <time>{formatPublishedDate(article.publishedAt)}</time>}
      {article.consumptionTimeSeconds !== null && (
        <>
          <span className="text-ink-faint">·</span>
          <span>{formatConsumptionTime(article.consumptionTimeSeconds, article.sourceType)}</span>
        </>
      )}
    </div>
    <h1 className="font-serif text-4xl font-medium tracking-tight text-ink leading-tight mb-4">{article.title}</h1>
    {article.author && <div className="text-sm text-ink-secondary">By {article.author}</div>}
  </div>
);

const ArticleImage = ({ url }: { url: string }): React.ReactNode => (
  <div className="mb-10 -mx-6">
    <img src={url} alt="" className="w-full rounded-lg" />
  </div>
);

const ArticleMedia = ({ article }: { article: ArticleData }): React.ReactNode =>
  article.mediaUrl ? (
    <div className="mb-10">
      <MediaPlayer
        mediaUrl={article.mediaUrl}
        mediaType={article.mediaType}
        articleId={article.id}
        initialProgress={article.progress}
        delay={0}
      />
    </div>
  ) : null;

/* ---- Content body ---- */

const ArticleBody = ({
  hasContent,
  displayContent,
  displaySummary,
}: {
  hasContent: boolean;
  displayContent: string | null;
  displaySummary: string | null;
}): React.ReactNode => {
  if (hasContent) {
    return (
      <div className="font-serif text-lg leading-relaxed text-ink prose prose-neutral max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-ink prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-blockquote:border-accent prose-blockquote:text-ink-secondary prose-blockquote:font-serif prose-blockquote:italic prose-img:rounded-lg">
        <Markdown remarkPlugins={[remarkGfm]}>{displayContent}</Markdown>
      </div>
    );
  }
  if (displaySummary) {
    return <div className="font-serif text-lg leading-relaxed text-ink">{displaySummary}</div>;
  }
  return <div className="py-12 text-center text-sm text-ink-tertiary">No content available for this article.</div>;
};

/* ---- Footer ---- */

const ArticleFooter = ({ detail, onBack }: { detail: ArticleDetailResult; onBack: () => void }): React.ReactNode => (
  <>
    <Separator soft className="mt-12" />
    <div className="py-10 text-center">
      <div className="font-serif text-xl text-ink mb-3">End of article</div>
      <div className="flex items-center justify-center gap-2 mb-6">
        <VoteControls value={detail.vote} onVote={(v) => void detail.handleVote(v)} />
        <span className="text-xs text-ink-tertiary">
          {detail.vote === 1 ? 'More like this' : detail.vote === -1 ? 'Less like this' : 'Did you enjoy this?'}
        </span>
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
  </>
);

const Route = createFileRoute('/sources/$sourceId/articles/$articleId')({
  component: ArticlePage,
});

export { Route };
