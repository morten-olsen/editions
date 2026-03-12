import * as React from 'react';
import { motion } from 'motion/react';

import { MediaPlayer, waveformHeights } from '../media-player.tsx';
import { VoteControls } from '../vote-controls.tsx';
import type { VoteValue } from '../vote-controls.tsx';

import { MagazinePage, useMagazineNav } from './magazine.layout.tsx';

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

type NextPromptProps = {
  delay?: number;
};

const NextPrompt = ({ delay = 0.6 }: NextPromptProps): React.ReactElement => {
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

/* ── Waveform decoration ─────────────────────────────────────────── */

/**
 * Decorative soundwave — used as a static ornament when no mediaUrl
 * is available. Signals "this is audio" like a pull-quote ornament.
 * Uses the shared waveform shape from the media player.
 */
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

/* ── Layout variants ──────────────────────────────────────────────── */

/**
 * Articles alternate between layout variants based on their position
 * to create visual rhythm — like a magazine editor varying the spread.
 *
 * When `content` is provided, every layout flows into a shared prose
 * body column below the header, then a "next article" prompt.
 *
 * Podcast articles get a dedicated layout regardless of position —
 * square album art, a decorative waveform, and prominent listen time.
 */

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
      {/* Header: two-column hero */}
      <div className="max-w-wide mx-auto w-full grid gap-8 lg:grid-cols-2 lg:gap-16 items-center">
        {/* Text column */}
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

          {summary && !hasContent && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
              className="font-serif text-lg leading-relaxed text-ink-secondary mb-6"
            >
              {summary}
            </motion.p>
          )}

          <Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
        </div>

        {/* Image column */}
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

      {/* Article body */}
      {hasContent && (
        <div className="max-w-prose mx-auto w-full mt-12">
          <ArticleBody content={content} />
          {onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} />}
          <NextPrompt />
        </div>
      )}
      {!hasContent && onFocusVote && (
        <div className="max-w-prose mx-auto w-full">
          <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} />
        </div>
      )}
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
        {/* Source badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="text-xs font-mono tracking-wide text-accent mb-6 text-center"
        >
          {sourceName}
        </motion.div>

        {/* Title — centered, large */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
          className="font-serif text-3xl md:text-4xl lg:text-5xl tracking-tight leading-tight text-ink text-center mb-8"
        >
          {title}
        </motion.h2>

        {/* Decorative rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.2 }}
          className="w-12 h-px bg-border-strong mx-auto mb-8"
        />

        {/* Image (full-width within prose) */}
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

        {/* Summary as opening paragraph — only when no full content to avoid repetition */}
        {summary && !hasContent && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.3 }}
            className="font-serif text-lg leading-relaxed text-ink-secondary mb-6 text-center"
          >
            {summary}
          </motion.p>
        )}

        {/* Meta footer */}
        <Byline
          author={author}
          publishedAt={publishedAt}
          consumptionTimeSeconds={consumptionTimeSeconds}
          sourceType={sourceType}
          centered={!hasContent}
          delay={0.4}
        />

        {/* Article body */}
        {hasContent && (
          <>
            <ArticleBody content={content} delay={0.5} />
            {onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={0.65} />}
            <NextPrompt delay={0.7} />
          </>
        )}
        {!hasContent && onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={0.5} />}
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
          {/* Left: image or source block */}
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

          {/* Right: text content */}
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

            {summary && !hasContent && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
                className="font-serif text-base leading-relaxed text-ink-secondary mb-4"
              >
                {summary}
              </motion.p>
            )}

            <Byline author={author} consumptionTimeSeconds={consumptionTimeSeconds} sourceType={sourceType} />
          </div>
        </div>
      </div>

      {/* Article body — full-width prose below the compact header */}
      {hasContent && (
        <div className="max-w-prose mx-auto w-full mt-12">
          <ArticleBody content={content} />
          {onFocusVote && <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} />}
          <NextPrompt />
        </div>
      )}
      {!hasContent && onFocusVote && (
        <div className="max-w-wide mx-auto w-full mt-8">
          <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} />
        </div>
      )}
    </MagazinePage>
  );
};

/* ── Podcast layout ──────────────────────────────────────────────── */

/**
 * A centered, contemplative spread for podcast episodes. Evokes the
 * feeling of a featured audio piece in a print magazine — album art
 * at moderate scale, a decorative waveform, and prominent listen time.
 */
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
    focusVote,
    onFocusVote,
  } = props;
  const hasContent = !!content;
  const listenMin = consumptionTimeSeconds ? Math.round(consumptionTimeSeconds / 60) : null;

  return (
    <MagazinePage className={hasContent ? '' : 'items-center'} flow={hasContent}>
      <div className="max-w-prose mx-auto w-full">
        {/* Type label */}
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

        {/* Album art — square, centered, moderate size */}
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

        {/* Episode title */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
          className="font-serif text-3xl md:text-4xl tracking-tight leading-tight text-ink text-center mb-6"
        >
          {title}
        </motion.h2>

        {/* Media player or waveform + listen time fallback */}
        {mediaUrl ? (
          <div className="mb-8">
            <MediaPlayer
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              articleId={articleId}
              initialProgress={progress}
              delay={0.25}
            />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Waveform delay={0.2} />
            </div>
            {listenMin !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: easeOut, delay: 0.3 }}
                className="text-center mb-6"
              >
                <span className="inline-flex items-center gap-2 text-sm font-mono tracking-wide text-ink-tertiary">
                  <span className="text-lg leading-none text-ink">{listenMin}</span>
                  <span>min listen</span>
                </span>
              </motion.div>
            )}
          </>
        )}

        {/* Summary / episode description — only when no show notes to avoid repetition */}
        {summary && !hasContent && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: mediaUrl ? 0.35 : 0.4 }}
            className="font-serif text-lg leading-relaxed text-ink-secondary mb-6 text-center"
          >
            {summary}
          </motion.p>
        )}

        {/* Author / date byline */}
        <Byline author={author} publishedAt={publishedAt} centered={!hasContent} delay={mediaUrl ? 0.4 : 0.45} />

        {/* Show notes / transcript */}
        {hasContent && (
          <>
            <ArticleBody content={content} delay={mediaUrl ? 0.5 : 0.55} />
            {onFocusVote && (
              <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={mediaUrl ? 0.6 : 0.65} />
            )}
            <NextPrompt delay={mediaUrl ? 0.65 : 0.7} />
          </>
        )}
        {!hasContent && onFocusVote && (
          <VoteRow focusVote={focusVote ?? null} onFocusVote={onFocusVote} delay={mediaUrl ? 0.5 : 0.55} />
        )}
      </div>
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

/* ── Exports ──────────────────────────────────────────────────────── */

export type { MagazineArticleProps, VoteValue };
export { MagazineArticle };
