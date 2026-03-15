import * as React from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { VoteControls } from '../vote-controls.tsx';
import type { VoteValue } from '../vote-controls.tsx';

import { useMagazineNav } from './magazine.layout.tsx';

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
  /** Extracted article body — rendered as markdown in a prose column */
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
    >
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
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

/* ── Re-export MagazineArticle from layouts ───────────────────────── */

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
export { MagazineArticle } from './magazine.layouts.tsx';
