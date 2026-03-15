import * as React from 'react';
import { motion } from 'motion/react';

import { MagazinePage } from './magazine.layout.tsx';
import { PodcastLayout } from './magazine.podcast.tsx';
import {
  easeOut,
  formatArticleDate,
  AnimatedSummary,
  Byline,
  ArticleBody,
  ArticleFooter,
  VoteRow,
  NextPrompt,
} from './magazine.article.tsx';
import type { MagazineArticleProps } from './magazine.article.tsx';

/* ── Hero layout ──────────────────────────────────────────────────── */

const HeroLayout = (props: MagazineArticleProps): React.ReactElement => {
  const {
    title,
    sourceName,
    author,
    summary,
    publishedAt,
    consumptionTimeSeconds,
    imageUrl,
    sourceType,
    content,
    vote,
    onVote,
    voteLabel,
  } = props;
  const hasContent = !!content;

  return (
    <MagazinePage flow={hasContent}>
      <div className="max-w-wide mx-auto w-full grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
        <div className="order-2 lg:order-1">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="flex items-center gap-2 text-xs font-mono tracking-wide text-accent mb-4"
          >
            <span>{sourceName}</span>
            {publishedAt && (
              <>
                <span className="text-ink-faint">·</span>
                <span className="text-ink-tertiary">{formatArticleDate(publishedAt)}</span>
              </>
            )}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
            className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-ink mb-6"
          >
            {title}
          </motion.h2>
          <AnimatedSummary summary={summary} hasContent={hasContent} />
          <Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
        </div>
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
            className="order-1 lg:order-2 aspect-[4/3] rounded-lg overflow-hidden bg-surface-sunken"
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
      </div>
      <ArticleFooter content={content} vote={vote} onVote={onVote} voteLabel={voteLabel} />
    </MagazinePage>
  );
};

/* ── Editorial layout ─────────────────────────────────────────────── */

const EditorialLayout = (props: MagazineArticleProps): React.ReactElement => {
  const {
    title,
    sourceName,
    author,
    summary,
    publishedAt,
    consumptionTimeSeconds,
    imageUrl,
    sourceType,
    content,
    vote,
    onVote,
    voteLabel,
  } = props;
  const hasContent = !!content;

  return (
    <MagazinePage className={hasContent ? '' : 'items-center'} flow={hasContent}>
      <div className="max-w-prose mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="text-xs font-mono tracking-wide text-accent mb-6 text-center"
        >
          {sourceName}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-tight text-ink text-center mb-8"
        >
          {title}
        </motion.h2>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.2 }}
          className="w-12 h-px bg-border-strong mx-auto mb-8"
        />
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.25 }}
            className="aspect-[16/9] rounded-lg overflow-hidden bg-surface-sunken mb-8"
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
        <AnimatedSummary summary={summary} hasContent={hasContent} delay={0.3} className="text-center" />
        <Byline
          author={author}
          publishedAt={publishedAt}
          consumptionTimeSeconds={consumptionTimeSeconds}
          sourceType={sourceType}
          centered={!hasContent}
          delay={0.4}
        />
        {hasContent ? (
          <>
            <ArticleBody content={content} delay={0.5} />
            {onVote && <VoteRow vote={vote ?? null} onVote={onVote} label={voteLabel} delay={0.65} />}
            <NextPrompt delay={0.7} />
          </>
        ) : (
          onVote && <VoteRow vote={vote ?? null} onVote={onVote} label={voteLabel} delay={0.5} />
        )}
      </div>
    </MagazinePage>
  );
};

/* ── Compact left column ──────────────────────────────────────────── */

type CompactLeftColumnProps = {
  imageUrl?: string | null;
  sourceName: string;
  publishedAt?: string | null;
};

const CompactLeftColumn = ({ imageUrl, sourceName, publishedAt }: CompactLeftColumnProps): React.ReactElement => (
  <div>
    {imageUrl ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="aspect-square rounded-lg overflow-hidden bg-surface-sunken"
      >
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </motion.div>
    ) : (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="py-4 border-t-2 border-accent"
      >
        <div className="text-xs font-mono tracking-wide text-accent uppercase">{sourceName}</div>
        {publishedAt && <div className="text-xs text-ink-tertiary mt-1">{formatArticleDate(publishedAt)}</div>}
      </motion.div>
    )}
  </div>
);

/* ── Compact layout ───────────────────────────────────────────────── */

const CompactLayout = (props: MagazineArticleProps): React.ReactElement => {
  const {
    title,
    sourceName,
    author,
    summary,
    publishedAt,
    consumptionTimeSeconds,
    imageUrl,
    sourceType,
    content,
    vote,
    onVote,
    voteLabel,
  } = props;
  const hasContent = !!content;

  return (
    <MagazinePage flow={hasContent}>
      <div className="max-w-wide mx-auto w-full">
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-12 items-start">
          <CompactLeftColumn imageUrl={imageUrl} sourceName={sourceName} publishedAt={publishedAt} />
          <div>
            {imageUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: easeOut }}
                className="text-xs font-mono tracking-wide text-accent mb-3"
              >
                {sourceName}
              </motion.div>
            )}
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
              className="font-serif text-2xl md:text-3xl tracking-tight leading-tight text-ink mb-4"
            >
              {title}
            </motion.h2>
            <AnimatedSummary summary={summary} hasContent={hasContent} className="text-base" />
            <Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
          </div>
        </div>
      </div>
      <ArticleFooter
        content={content}
        vote={vote}
        onVote={onVote}
        voteLabel={voteLabel}
        voteWrapperClass="max-w-wide mx-auto w-full mt-8"
      />
    </MagazinePage>
  );
};

/* ── MagazineArticle (selects layout variant) ─────────────────────── */

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

export { MagazineArticle, HeroLayout, EditorialLayout, CompactLayout, CompactLeftColumn };
