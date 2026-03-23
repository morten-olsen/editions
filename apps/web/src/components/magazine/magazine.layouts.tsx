import * as React from 'react';

import { MagazinePage } from './magazine.layout.tsx';
import { PodcastLayout } from './magazine.podcast.tsx';
import { Editorial, Hero, Compact } from '../article/article.presets.tsx';
import { EditionFooter } from '../article/article.footers.tsx';
import type { MagazineArticleProps } from './magazine.article.tsx';

/* ── Layout wrappers ─────────────────────────────────────────── */
/* Each wraps a preset in a MagazinePage and wires the footer    */

const HeroLayout = (props: MagazineArticleProps): React.ReactElement => {
  const hasContent = !!props.content;

  return (
    <MagazinePage flow={hasContent}>
      <Hero
        title={props.title}
        sourceName={props.sourceName}
        author={props.author}
        summary={props.summary}
        publishedAt={props.publishedAt}
        consumptionTimeSeconds={props.consumptionTimeSeconds}
        imageUrl={props.imageUrl}
        sourceType={props.sourceType}
        content={props.content}
        footer={
          <EditionFooter
            vote={props.vote ?? null}
            onVote={props.onVote}
            label={props.voteLabel}
            bookmarked={props.bookmarked}
            onBookmarkToggle={props.onBookmarkToggle}
          />
        }
      />
    </MagazinePage>
  );
};

const EditorialLayout = (props: MagazineArticleProps): React.ReactElement => {
  const hasContent = !!props.content;

  return (
    <MagazinePage className={hasContent ? '' : 'items-center'} flow={hasContent}>
      <Editorial
        title={props.title}
        sourceName={props.sourceName}
        author={props.author}
        summary={props.summary}
        publishedAt={props.publishedAt}
        consumptionTimeSeconds={props.consumptionTimeSeconds}
        imageUrl={props.imageUrl}
        sourceType={props.sourceType}
        content={props.content}
        footer={
          <EditionFooter
            vote={props.vote ?? null}
            onVote={props.onVote}
            label={props.voteLabel}
            bookmarked={props.bookmarked}
            onBookmarkToggle={props.onBookmarkToggle}
          />
        }
      />
    </MagazinePage>
  );
};

const CompactLayout = (props: MagazineArticleProps): React.ReactElement => {
  const hasContent = !!props.content;

  return (
    <MagazinePage flow={hasContent}>
      <Compact
        title={props.title}
        sourceName={props.sourceName}
        author={props.author}
        summary={props.summary}
        publishedAt={props.publishedAt}
        consumptionTimeSeconds={props.consumptionTimeSeconds}
        imageUrl={props.imageUrl}
        sourceType={props.sourceType}
        content={props.content}
        footer={
          <EditionFooter
            vote={props.vote ?? null}
            onVote={props.onVote}
            label={props.voteLabel}
            bookmarked={props.bookmarked}
            onBookmarkToggle={props.onBookmarkToggle}
          />
        }
      />
    </MagazinePage>
  );
};

/* ── MagazineArticle (selects layout variant) ─────────────────── */

const MagazineArticle = (props: MagazineArticleProps): React.ReactElement => {
  if (props.sourceType === 'podcast') {
    return <PodcastLayout {...props} />;
  }

  const pos = props.positionInSection ?? 0;
  const variant = pos % 3;

  if (variant === 0) {
    return <HeroLayout {...props} />;
  }
  if (variant === 1) {
    return <EditorialLayout {...props} />;
  }
  return <CompactLayout {...props} />;
};

export { MagazineArticle, HeroLayout, EditorialLayout, CompactLayout };
