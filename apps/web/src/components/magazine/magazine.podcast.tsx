import * as React from 'react';
import { motion } from 'motion/react';

import { MediaPlayer, waveformHeights } from '../media-player.tsx';

import { MagazinePage } from './magazine.layout.tsx';
import type { MagazineArticleProps } from './magazine.article.tsx';
import { ArticleBody, ArticleFooter, Byline, AnimatedSummary, easeOut } from './magazine.article.tsx';

/* ── Waveform decoration ─────────────────────────────────────────── */

const Waveform = ({ delay = 0.3 }: { delay?: number }): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5, ease: easeOut, delay }}
    className="flex justify-center"
  >
    <div className="flex items-center gap-[2px] h-9">
      {waveformHeights.map((h, i) => (
        <div key={i} className="w-[3px] rounded-full bg-accent/20" style={{ height: h }} />
      ))}
    </div>
  </motion.div>
);

/* ── Listen time display ─────────────────────────────────────────── */

const ListenTime = ({ minutes, delay }: { minutes: number; delay: number }): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className="text-center mb-6"
  >
    <span className="inline-flex items-center gap-2 text-sm font-mono tracking-wide text-ink-tertiary">
      <span className="text-lg leading-none text-ink">{minutes}</span>
      <span>min listen</span>
    </span>
  </motion.div>
);

/* ── Podcast media section ───────────────────────────────────────── */

type PodcastMediaProps = {
  mediaUrl?: string | null;
  mediaType?: string | null;
  articleId?: string | null;
  progress?: number | null;
  consumptionTimeSeconds?: number | null;
};

const PodcastMedia = ({
  mediaUrl,
  mediaType,
  articleId,
  progress,
  consumptionTimeSeconds,
}: PodcastMediaProps): React.ReactElement | null => {
  const listenMin = consumptionTimeSeconds ? Math.round(consumptionTimeSeconds / 60) : null;

  if (mediaUrl) {
    return (
      <div className="mb-8">
        <MediaPlayer
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          articleId={articleId}
          initialProgress={progress}
          delay={0.25}
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Waveform delay={0.2} />
      </div>
      {listenMin !== null && <ListenTime minutes={listenMin} delay={0.3} />}
    </>
  );
};

/* ── Podcast layout ──────────────────────────────────────────────── */

const PodcastLayout = (props: MagazineArticleProps): React.ReactElement => {
  const {
    articleId,
    title,
    sourceName,
    author,
    summary,
    publishedAt,
    consumptionTimeSeconds,
    imageUrl,
    mediaUrl,
    mediaType,
    progress,
    content,
    vote,
    onVote,
    voteLabel,
  } = props;
  const hasContent = !!content;
  const baseDelay = mediaUrl ? 0.35 : 0.4;

  return (
    <MagazinePage className={hasContent ? '' : 'items-center'} flow={hasContent}>
      <div className="max-w-prose mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="flex items-center justify-center gap-2 text-xs font-mono tracking-wide text-accent mb-8"
        >
          <span className="uppercase">Podcast</span>
          <span className="text-ink-faint">·</span>
          <span>{sourceName}</span>
        </motion.div>
        {imageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.1 }}
            className="mx-auto mb-8 w-48 h-48 md:w-64 md:h-64 rounded-lg overflow-hidden bg-surface-sunken shadow-lg"
          >
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </motion.div>
        )}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
          className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-ink text-center mb-6"
        >
          {title}
        </motion.h2>
        <PodcastMedia
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          articleId={articleId}
          progress={progress}
          consumptionTimeSeconds={consumptionTimeSeconds}
        />
        <AnimatedSummary summary={summary} hasContent={hasContent} delay={baseDelay} className="text-center" />
        <Byline author={author} publishedAt={publishedAt} centered={!hasContent} delay={baseDelay + 0.05} />
        {hasContent ? (
          <>
            <ArticleBody content={content} delay={baseDelay + 0.15} />
            <ArticleFooter
              content={null}
              vote={vote}
              onVote={onVote}
              voteLabel={voteLabel}
              voteDelay={baseDelay + 0.25}
            />
          </>
        ) : (
          <ArticleFooter
            content={null}
            vote={vote}
            onVote={onVote}
            voteLabel={voteLabel}
            voteDelay={baseDelay + 0.15}
          />
        )}
      </div>
    </MagazinePage>
  );
};

/* ── Exports ──────────────────────────────────────────────────────── */

export { PodcastLayout };
