import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { motion, type Transition } from 'motion/react';

import { BookmarkButton } from './bookmark-button.tsx';
import { Collapse } from './animate.tsx';
import { VoteControls } from './vote-controls.tsx';
import type { VoteValue } from './vote-controls.tsx';

type ArticleCardProps = {
  id: string;
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  sourceType?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  href?: string;
  compact?: boolean;
  /** When true, renders a muted, compact version for already-read articles */
  read?: boolean;
  /** Global quality vote: "Is this a good article?" */
  vote?: VoteValue;
  onVote?: (value: VoteValue) => void;
  /** Focus-scoped relevance vote: "Does this belong in this focus?" */
  focusVote?: VoteValue;
  onFocusVote?: (value: VoteValue) => void;
  /** Bookmark state */
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
};

const formatTime = (seconds: number, sourceType?: string | null): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '< 1 min';
  }
  const suffix = sourceType === 'podcast' ? 'listen' : 'read';
  return `${minutes} min ${suffix}`;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    return 'Just now';
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const Dot = (): React.ReactElement => <span className="text-ink-faint">·</span>;

/* ── Animation tokens ──────────────────────────────────────────────── */

const ease = [0.25, 0.1, 0.25, 1] as const;

const gentle: Transition = { duration: 0.35, ease };

/* ── Card ───────────────────────────────────────────────────────── */

const MotionLink = motion.create(Link);

const ArticleCard = ({
  id,
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  consumptionTimeSeconds,
  sourceType,
  imageUrl,
  href,
  compact = false,
  read = false,
  vote,
  onVote,
  focusVote,
  onFocusVote,
  bookmarked,
  onBookmarkToggle,
}: ArticleCardProps): React.ReactElement => {
  const aiId = `article-${id}`;
  const aiLabel = [title, sourceName, publishedAt ? formatDate(publishedAt) : null].filter(Boolean).join(' · ');
  const hasVoting = onVote !== undefined || onFocusVote !== undefined;
  const hasBookmark = onBookmarkToggle !== undefined;
  const muted = read;
  const showDetails = !compact;

  const meta = (
    <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
      <span>{sourceName}</span>
      {publishedAt && (
        <>
          <Dot />
          <span>{formatDate(publishedAt)}</span>
        </>
      )}
      {sourceType === 'podcast' && (
        <>
          <Dot />
          <span className="text-accent font-medium">Podcast</span>
        </>
      )}
      {consumptionTimeSeconds && (
        <>
          <Dot />
          <span>{formatTime(consumptionTimeSeconds, sourceType)}</span>
        </>
      )}
    </div>
  );

  const titleEl = (
    <motion.div
      animate={{ opacity: muted ? 0.7 : 1 }}
      transition={gentle}
      className={`font-serif font-medium tracking-tight leading-snug ${muted ? 'text-sm text-ink-tertiary' : compact ? 'text-sm text-ink' : 'text-lg text-ink'}`}
    >
      {title}
    </motion.div>
  );

  const summaryEl =
    showDetails && summary ? (
      <motion.div
        animate={{ opacity: muted ? 0.6 : 1 }}
        transition={gentle}
        className={`text-sm leading-relaxed ${muted ? 'line-clamp-1 text-ink-faint' : 'line-clamp-2 text-ink-secondary'}`}
      >
        {summary}
      </motion.div>
    ) : null;

  const actionBar =
    hasVoting || hasBookmark ? (
      <div className="flex items-center gap-4 mt-1">
        {onFocusVote && <VoteControls value={focusVote ?? null} onVote={onFocusVote} label="Relevance" />}
        {onVote && <VoteControls value={vote ?? null} onVote={onVote} label="Quality" />}
        {hasBookmark && <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onBookmarkToggle} />}
      </div>
    ) : null;

  const hasImage = showDetails && imageUrl;

  const content = (
    <>
      {meta}
      {titleEl}
      {summaryEl}
      <Collapse show={!!hasImage && !muted}>
        <div className="flex flex-col sm:flex-row sm:gap-5">
          <div className="sm:hidden -mx-1 mb-2 aspect-[3/1] rounded-md overflow-hidden bg-surface-sunken">
            <img src={imageUrl!} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="hidden sm:block shrink-0 w-28 h-20 rounded-md overflow-hidden bg-surface-sunken">
            <img src={imageUrl!} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      </Collapse>
      <Collapse show={showDetails && !muted && !!author}>
        <div className="text-xs text-ink-tertiary">By {author}</div>
      </Collapse>
      <Collapse show={!muted && !!actionBar}>{actionBar}</Collapse>
    </>
  );

  const wrapperClass = `flex flex-col gap-1.5 ${href ? 'cursor-pointer group' : ''}`;

  if (href) {
    return (
      <MotionLink
        to={href}
        animate={{ opacity: muted ? 0.55 : 1, paddingTop: muted ? 8 : 16, paddingBottom: muted ? 8 : 16 }}
        transition={gentle}
        className={wrapperClass}
        data-ai-id={aiId}
        data-ai-role="link"
        data-ai-label={aiLabel}
      >
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.div
      animate={{ opacity: muted ? 0.55 : 1, paddingTop: muted ? 8 : 16, paddingBottom: muted ? 8 : 16 }}
      transition={gentle}
      className={wrapperClass}
      data-ai-id={aiId}
      data-ai-role="section"
      data-ai-label={aiLabel}
    >
      {content}
    </motion.div>
  );
};

export type { ArticleCardProps };
export { ArticleCard, formatTime, formatDate };
