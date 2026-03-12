import * as React from 'react';
import { motion } from 'motion/react';

import { VoteControls } from '../vote-controls.tsx';
import type { VoteValue } from '../vote-controls.tsx';

import { MagazinePage, useMagazineNav } from './magazine.layout.tsx';
import { PodcastLayout } from './magazine.podcast.tsx';

/* ── Types ────────────────────────────────────────────────────────── */

type MagazineArticleProps = {
  /** Article ID — used for persisting playback progress to the server */
  articleId?: string | null;
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  sourceType?: string | null;
  /** Media URL — renders an audio player or video player when present */
  mediaUrl?: string | null;
  /** MIME type of the media (e.g. "audio/mpeg", "video/mp4") */
  mediaType?: string | null;
  /** Server-side playback progress (0.0–1.0) — used to restore position */
  progress?: number | null;
  /** Extracted article body — rendered as HTML in a prose column */
  content?: string | null;
  /** Position within the section (for layout variety) */
  positionInSection?: number;
  /** Current user's focus relevance vote for this article */
  focusVote?: VoteValue | null;
  /** Called when the user casts or removes a vote */
  onFocusVote?: ((value: VoteValue) => void) | null;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const easeOut = [0, 0, 0.15, 1] as const;

const formatArticleDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatReadingTime = (seconds: number, sourceType?: string | null): string => {
  const min = Math.round(seconds / 60);
  if (min < 1) {
    return '< 1 min';
  }
  const suffix = sourceType === 'podcast' ? 'listen' : 'read';
  return `${min} min ${suffix}`;
};

/* ── Article body ─────────────────────────────────────────────────── */

type ArticleBodyProps = {
  content: string;
  delay?: number;
};

const ArticleBody = ({ content, delay = 0.4 }: ArticleBodyProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: easeOut, delay }}
  >
    <div className="w-px h-8 bg-border-strong mx-auto mb-10" />
    <div
      className="prose prose-neutral max-w-none font-serif text-lg leading-relaxed text-ink
        prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-ink
        prose-p:text-ink-secondary prose-p:leading-relaxed
        prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        prose-strong:text-ink prose-strong:font-medium
        prose-blockquote:border-accent prose-blockquote:text-ink-secondary prose-blockquote:font-serif prose-blockquote:text-lg prose-blockquote:not-italic
        prose-figcaption:text-ink-tertiary prose-figcaption:text-xs
        prose-img:rounded-lg
        first-of-type:prose-p:text-lg first-of-type:prose-p:text-ink first-of-type:prose-p:leading-relaxed
        [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:text-5xl [&>p:first-of-type]:first-letter:font-serif [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:leading-none [&>p:first-of-type]:first-letter:mr-2 [&>p:first-of-type]:first-letter:mt-1 [&>p:first-of-type]:first-letter:text-ink"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  </motion.div>
);

/* ── Next article prompt ──────────────────────────────────────────── */

const NextPrompt = ({ delay = 0.6 }: { delay?: number }): React.ReactElement => {
  const nav = useMagazineNav();
  const canAdvance = nav !== null && nav.page < nav.total - 1;

  const handleClick = (): void => {
    if (nav) {
      nav.onPageChange(nav.page + 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
      className="mt-16 mb-20 text-center"
    >
      <div className="w-px h-8 bg-border mx-auto mb-6" />
      {canAdvance ? (
        <button
          onClick={handleClick}
          className="text-xs font-mono tracking-wide text-ink-tertiary hover:text-accent transition-colors duration-fast cursor-pointer"
        >
          Continue to next article →
        </button>
      ) : (
        <div className="text-xs font-mono tracking-wide text-ink-faint">End of edition</div>
      )}
    </motion.div>
  );
};

/* ── Vote row ─────────────────────────────────────────────────────── */

type VoteRowProps = {
  focusVote: VoteValue | null;
  onFocusVote: (value: VoteValue) => void;
  delay?: number;
};

const VoteRow = ({ focusVote, onFocusVote, delay = 0.5 }: VoteRowProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className="flex items-center justify-center pt-6 mt-6 border-t border-border"
  >
    <VoteControls value={focusVote} onVote={onFocusVote} label="Relevance" />
  </motion.div>
);

/* ── Byline row ───────────────────────────────────────────────────── */

type BylineProps = {
  author?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  sourceType?: string | null;
  centered?: boolean;
  delay?: number;
};

const Byline = ({
  author,
  publishedAt,
  consumptionTimeSeconds,
  sourceType,
  centered = false,
  delay = 0.3,
}: BylineProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, ease: easeOut, delay }}
    className={`flex items-center gap-3 text-xs text-ink-tertiary ${centered ? 'justify-center' : ''}`}
  >
    {author && <span>By {author}</span>}
    {publishedAt && (
      <>
        {author && <span className="text-ink-faint">·</span>}
        <span>{formatArticleDate(publishedAt)}</span>
      </>
    )}
    {consumptionTimeSeconds && (
      <>
        {(author || publishedAt) && <span className="text-ink-faint">·</span>}
        <span>{formatReadingTime(consumptionTimeSeconds, sourceType)}</span>
      </>
    )}
  </motion.div>
);

/* ── Article footer (body + vote + next) ─────────────────────────── */

type ArticleFooterProps = {
  content?: string | null;
  focusVote?: VoteValue | null;
  onFocusVote?: ((value: VoteValue) => void) | null;
  bodyDelay?: number;
  voteDelay?: number;
  nextDelay?: number;
  /** Wrapper class for the prose container when content is present */
  wrapperClass?: string;
  /** Wrapper class for the vote-only container when no content */
  voteWrapperClass?: string;
};

const ArticleFooter = ({
  content,
  focusVote,
  onFocusVote,
  bodyDelay = 0.4,
  voteDelay = 0.5,
  nextDelay = 0.6,
  wrapperClass = 'max-w-prose mx-auto w-full mt-12',
  voteWrapperClass = 'max-w-prose mx-auto w-full',
}: ArticleFooterProps): React.ReactElement | null => {
  const hasContent = !!content;

  if (hasContent) {
    return (
      <div className={wrapperClass}>
        <ArticleBody content={content} delay={bodyDelay} />
        {onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={voteDelay} />}
        <NextPrompt delay={nextDelay} />
      </div>
    );
  }

  if (onFocusVote) {
    return (
      <div className={voteWrapperClass}>
        <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={voteDelay} />
      </div>
    );
  }

  return null;
};

/* ── Animated summary ────────────────────────────────────────────── */

type AnimatedSummaryProps = {
  summary?: string | null;
  hasContent: boolean;
  delay?: number;
  className?: string;
};

const AnimatedSummary = ({
  summary,
  hasContent,
  delay = 0.2,
  className = '',
}: AnimatedSummaryProps): React.ReactElement | null => {
  if (!summary || hasContent) {
    return null;
  }
  return (
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut, delay }}
      className={`font-serif text-lg leading-relaxed text-ink-secondary mb-6 ${className}`}
    >
      {summary}
    </motion.p>
  );
};

/* ── Layout variants ──────────────────────────────────────────────── */

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
    focusVote,
    onFocusVote,
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
      <ArticleFooter content={content} focusVote={focusVote} onFocusVote={onFocusVote} />
    </MagazinePage>
  );
};

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
    focusVote,
    onFocusVote,
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
            {onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={0.65} />}
            <NextPrompt delay={0.7} />
          </>
        ) : (
          onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={0.5} />
        )}
      </div>
    </MagazinePage>
  );
};

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
    focusVote,
    onFocusVote,
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
        focusVote={focusVote}
        onFocusVote={onFocusVote}
        voteWrapperClass="max-w-wide mx-auto w-full mt-8"
      />
    </MagazinePage>
  );
};

/* ── Compact left column ─────────────────────────────────────────── */

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

/* ── Exports ──────────────────────────────────────────────────────── */

export type {
  MagazineArticleProps,
  VoteValue,
  BylineProps,
  ArticleFooterProps,
  ArticleBodyProps,
  VoteRowProps,
  AnimatedSummaryProps,
};
export {
  MagazineArticle,
  ArticleBody,
  ArticleFooter,
  Byline,
  VoteRow,
  NextPrompt,
  AnimatedSummary,
  easeOut,
  formatArticleDate,
  formatReadingTime,
};
