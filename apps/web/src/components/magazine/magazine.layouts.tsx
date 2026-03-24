import * as React from 'react';

import { MagazinePage } from './magazine.layout.tsx';
import { ArticleView } from '../article/article.presets.tsx';
import type { ArticleStyle } from '../article/article.presets.tsx';
import { EditionFooter } from '../article/article.footers.tsx';
import { MediaPlayer } from '../media-player.tsx';
import type { MagazineArticleProps } from './magazine.article.tsx';

/* ── Style rotation ─────────────────────────────────────────── */

const styleForPosition = (pos: number): ArticleStyle => {
  const variant = pos % 3;
  if (variant === 0) {
    return 'hero';
  }
  if (variant === 1) {
    return 'editorial';
  }
  return 'compact';
};

/* ── MagazineArticle ────────────────────────────────────────── */

const MagazineArticle = (props: MagazineArticleProps): React.ReactElement => {
  const isPodcast = props.sourceType === 'podcast';
  const style = isPodcast ? 'editorial' : styleForPosition(props.positionInSection ?? 0);
  const hasContent = !!props.content;
  const centerPage = style === 'editorial' && !hasContent;

  return (
    <MagazinePage className={centerPage ? 'items-center' : ''} flow={hasContent}>
      <ArticleView
        style={style}
        title={props.title}
        sourceName={props.sourceName}
        author={props.author}
        summary={isPodcast ? (props.summary ?? props.content) : props.summary}
        publishedAt={props.publishedAt}
        consumptionTimeSeconds={props.consumptionTimeSeconds}
        imageUrl={props.imageUrl}
        sourceType={props.sourceType}
        content={isPodcast ? null : props.content}
        footer={
          <EditionFooter
            vote={props.vote ?? null}
            onVote={props.onVote}
            label={props.voteLabel}
            focusVote={props.focusVote}
            onFocusVote={props.onFocusVote}
            globalVote={props.globalVote}
            onGlobalVote={props.onGlobalVote}
            bookmarked={props.bookmarked}
            onBookmarkToggle={props.onBookmarkToggle}
          />
        }
      >
        {isPodcast && props.mediaUrl && (
          <div className="mt-8">
            <MediaPlayer
              mediaUrl={props.mediaUrl}
              mediaType={props.mediaType}
              articleId={props.articleId}
              initialProgress={props.progress}
              delay={0.25}
            />
          </div>
        )}
      </ArticleView>
    </MagazinePage>
  );
};

export { MagazineArticle };
