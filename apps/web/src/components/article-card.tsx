import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { motion, type Transition } from 'motion/react';

import { BookmarkButton } from './bookmark-button.tsx';
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
  read?: boolean;
  vote?: VoteValue;
  onVote?: (value: VoteValue) => void;
  focusVote?: VoteValue;
  onFocusVote?: (value: VoteValue) => void;
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

const formatTime = (seconds: number, sourceType?: string | null): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '< 1 min';
  }
  if (!sourceType) {
    return `${minutes} min`;
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

const ease = [0.25, 0.1, 0.25, 1] as const;
const gentle: Transition = { duration: 0.35, ease };

const MotionLink = motion.create(Link);

/* ── Card content ────────────────────────────────────────────────── */

type CardContentProps = Omit<ArticleCardProps, 'id' | 'url' | 'href'>;

const CardContent = ({
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  consumptionTimeSeconds,
  sourceType,
  imageUrl,
  compact = false,
  read = false,
  vote,
  onVote,
  focusVote,
  onFocusVote,
  bookmarked,
  onBookmarkToggle,
}: CardContentProps): React.ReactElement => {
  const muted = read;
  const hasImage = !compact && imageUrl && !muted;
  const hasActions = onVote !== undefined || onFocusVote !== undefined || onBookmarkToggle !== undefined;

  if (compact || muted) {
    return (
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-xs tracking-wide text-ink-faint mb-1">
            <span className={muted ? '' : 'text-accent'}>{sourceName}</span>
            {publishedAt && (
              <>
                <span>·</span>
                <span>{formatDate(publishedAt)}</span>
              </>
            )}
          </div>
          <div
            className={`font-serif tracking-tight leading-snug ${muted ? 'text-sm text-ink-tertiary' : 'text-sm text-ink font-medium'}`}
          >
            {title}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Image — full-width above content */}
      {hasImage && (
        <div className="aspect-[3/1] rounded-lg overflow-hidden bg-surface-sunken mb-4">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Source badge */}
      <div className="flex items-center gap-1.5 font-mono text-xs tracking-wide mb-2">
        <span className="text-accent">{sourceName}</span>
        {sourceType === 'podcast' && (
          <>
            <span className="text-ink-faint">·</span>
            <span className="text-accent font-medium">Podcast</span>
          </>
        )}
      </div>

      {/* Title — editorial scale */}
      <h3 className="font-serif text-xl font-medium tracking-tight leading-snug text-ink mb-2 group-hover:text-accent transition-colors duration-fast">
        {title}
      </h3>

      {/* Summary */}
      {summary && <p className="font-serif text-sm leading-relaxed text-ink-secondary line-clamp-2 mb-3">{summary}</p>}

      {/* Byline + meta */}
      <div className="flex items-center gap-2 text-xs text-ink-tertiary">
        {author && <span>By {author}</span>}
        {author && (publishedAt || consumptionTimeSeconds) && <span className="text-ink-faint">·</span>}
        {publishedAt && <span>{formatDate(publishedAt)}</span>}
        {consumptionTimeSeconds != null && (
          <>
            {publishedAt && <span className="text-ink-faint">·</span>}
            <span>{formatTime(consumptionTimeSeconds, sourceType)}</span>
          </>
        )}
      </div>

      {/* Actions */}
      {hasActions && !muted && (
        <div className="flex items-center gap-4 mt-3">
          {onFocusVote && <VoteControls value={focusVote ?? null} onVote={onFocusVote} label="Relevance" />}
          {onVote && <VoteControls value={vote ?? null} onVote={onVote} label="Quality" />}
          {onBookmarkToggle && <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onBookmarkToggle} />}
        </div>
      )}
    </>
  );
};

/* ── Card wrapper ────────────────────────────────────────────────── */

const ArticleCard = ({ id, href, read = false, ...rest }: ArticleCardProps): React.ReactElement => {
  const aiId = `article-${id}`;
  const aiLabel = [rest.title, rest.sourceName, rest.publishedAt ? formatDate(rest.publishedAt) : null]
    .filter(Boolean)
    .join(' · ');
  const muted = read;

  if (href) {
    return (
      <MotionLink
        to={href}
        animate={{ opacity: muted ? 0.55 : 1 }}
        transition={gentle}
        className={`block py-6 ${href ? 'cursor-pointer group' : ''}`}
        data-ai-id={aiId}
        data-ai-role="link"
        data-ai-label={aiLabel}
      >
        <CardContent read={read} {...rest} />
      </MotionLink>
    );
  }

  return (
    <motion.div
      animate={{ opacity: muted ? 0.55 : 1 }}
      transition={gentle}
      className="py-6"
      data-ai-id={aiId}
      data-ai-role="section"
      data-ai-label={aiLabel}
    >
      <CardContent read={read} {...rest} />
    </motion.div>
  );
};

export type { ArticleCardProps };
export { ArticleCard, formatTime, formatDate };
