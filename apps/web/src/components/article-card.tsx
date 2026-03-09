import * as React from "react";
import { Link } from "@tanstack/react-router";

import { BookmarkButton } from "./bookmark-button.tsx";
import { VoteControls } from "./vote-controls.tsx";
import type { VoteValue } from "./vote-controls.tsx";

type ArticleCardProps = {
  id: string;
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  readingTimeSeconds?: number | null;
  imageUrl?: string | null;
  url?: string | null;
  href?: string;
  compact?: boolean;
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

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? "< 1 min" : `${minutes} min read`;
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const Dot = (): React.ReactElement => (
  <span className="text-ink-faint">·</span>
);

const ArticleCard = ({
  title,
  sourceName,
  author,
  summary,
  publishedAt,
  readingTimeSeconds,
  imageUrl,
  href,
  compact = false,
  vote,
  onVote,
  focusVote,
  onFocusVote,
  bookmarked,
  onBookmarkToggle,
}: ArticleCardProps): React.ReactElement => {
  const hasVoting = onVote !== undefined || onFocusVote !== undefined;
  const hasBookmark = onBookmarkToggle !== undefined;

  const meta = (
    <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
      <span>{sourceName}</span>
      {publishedAt && (
        <>
          <Dot />
          <span>{formatDate(publishedAt)}</span>
        </>
      )}
      {readingTimeSeconds && (
        <>
          <Dot />
          <span>{formatTime(readingTimeSeconds)}</span>
        </>
      )}
    </div>
  );

  const titleEl = (
    <div className={`font-serif font-medium tracking-tight text-ink leading-snug ${compact ? "text-sm" : "text-lg"}`}>
      {title}
    </div>
  );

  const actionBar = (hasVoting || hasBookmark) ? (
    <div className="flex items-center gap-4 mt-1">
      {onFocusVote && (
        <VoteControls value={focusVote ?? null} onVote={onFocusVote} label="Relevance" />
      )}
      {onVote && (
        <VoteControls value={vote ?? null} onVote={onVote} label="Quality" />
      )}
      {hasBookmark && (
        <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onBookmarkToggle} />
      )}
    </div>
  ) : null;

  const hasImage = !compact && imageUrl;

  const content = hasImage ? (
    <div className="flex flex-col sm:flex-row sm:gap-5">
      {/* Mobile: full-width banner image */}
      <div className="sm:hidden -mx-1 mb-2 aspect-[3/1] rounded-md overflow-hidden bg-surface-sunken">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {meta}
        {titleEl}
        {summary && (
          <div className="text-sm text-ink-secondary leading-relaxed line-clamp-2">
            {summary}
          </div>
        )}
        {author && (
          <div className="text-xs text-ink-tertiary">
            By {author}
          </div>
        )}
        {actionBar}
      </div>
      {/* Desktop: side thumbnail */}
      <div className="hidden sm:block shrink-0 w-28 h-20 rounded-md overflow-hidden bg-surface-sunken self-center">
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  ) : (
    <>
      {meta}
      {titleEl}
      {!compact && summary && (
        <div className="text-sm text-ink-secondary leading-relaxed line-clamp-2">
          {summary}
        </div>
      )}
      {!compact && author && (
        <div className="text-xs text-ink-tertiary">
          By {author}
        </div>
      )}
      {actionBar}
    </>
  );

  const wrapperClass = `flex flex-col gap-1.5 py-4 transition-colors duration-fast ease-gentle ${href ? "cursor-pointer group" : ""}`;

  if (href) {
    return (
      <Link to={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
};

export type { ArticleCardProps };
export { ArticleCard, formatTime, formatDate };
