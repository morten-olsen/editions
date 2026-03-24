import * as React from 'react';
import { motion } from 'motion/react';

import { VoteControls } from '../vote-controls.tsx';
import { BookmarkButton } from '../bookmark-button.tsx';
import { Button } from '../button.tsx';
import { useMagazineNav } from '../magazine/magazine.layout.tsx';

import type { VoteValue } from './article.tsx';
import { easeOut } from './article.tsx';
import * as Article from './article.tsx';

/* ── Reader footer (shared base) ──────────────────────────────── */

type ReaderFooterProps = {
  votes: React.ReactNode;
  onDone: () => void;
  articleUrl?: string | null;
  delay?: number;
};

const ReaderFooter = ({ votes, onDone, articleUrl, delay = 0.5 }: ReaderFooterProps): React.ReactElement => (
  <Article.Footer delay={delay}>
    <div className="w-px h-8 bg-border mx-auto mt-16 mb-8" />
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-4 mb-6">{votes}</div>
      <div className="flex items-center justify-center gap-3">
        <Button variant="primary" size="sm" onClick={onDone}>
          Done
        </Button>
        {articleUrl && (
          <a href={articleUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              View original
            </Button>
          </a>
        )}
      </div>
    </div>
  </Article.Footer>
);

/* ── Feed footer ──────────────────────────────────────────────── */

type FeedFooterProps = {
  vote: VoteValue;
  onVote: (value: VoteValue) => void;
  onDone: () => void;
  articleUrl?: string | null;
  delay?: number;
};

const FeedFooter = ({ vote, onVote, ...rest }: FeedFooterProps): React.ReactElement => (
  <ReaderFooter votes={<VoteControls value={vote} onVote={onVote} label="Quality" />} {...rest} />
);

/* ── Focus footer ─────────────────────────────────────────────── */

type FocusFooterProps = {
  focusVote: VoteValue;
  onFocusVote: (value: VoteValue) => void;
  globalVote: VoteValue;
  onGlobalVote: (value: VoteValue) => void;
  onDone: () => void;
  articleUrl?: string | null;
  delay?: number;
};

const FocusFooter = ({
  focusVote,
  onFocusVote,
  globalVote,
  onGlobalVote,
  ...rest
}: FocusFooterProps): React.ReactElement => (
  <ReaderFooter
    votes={
      <>
        <VoteControls value={focusVote} onVote={onFocusVote} label="Relevance" />
        <VoteControls value={globalVote} onVote={onGlobalVote} label="Quality" />
      </>
    }
    {...rest}
  />
);

/* ── Edition footer ───────────────────────────────────────────── */
/* Used in magazine view — edition-scoped vote + next prompt      */

type EditionFooterProps = {
  vote: VoteValue | null;
  onVote?: ((value: VoteValue) => void) | null;
  label?: string;
  focusVote?: VoteValue | null;
  onFocusVote?: ((value: VoteValue) => void) | null;
  globalVote?: VoteValue | null;
  onGlobalVote?: ((value: VoteValue) => void) | null;
  bookmarked?: boolean;
  onBookmarkToggle?: (() => void) | null;
  articleUrl?: string | null;
  voteDelay?: number;
  nextDelay?: number;
};

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

const OriginalLinkButton = ({ url }: { url: string }): React.ReactElement => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="shrink-0 rounded-md p-1 text-ink-faint hover:text-ink-secondary transition-colors duration-fast"
    aria-label="View original"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM6.39 5.67C7.11 4.48 8.18 3.5 10 3.5c1.82 0 2.89.98 3.61 2.17.35.58.61 1.22.8 1.83H5.59c.19-.61.45-1.25.8-1.83ZM5.2 9h9.6a9.7 9.7 0 0 1 0 2H5.2a9.7 9.7 0 0 1 0-2Zm.39 3.5h8.82c-.19.61-.45 1.25-.8 1.83C12.89 15.52 11.82 16.5 10 16.5c-1.82 0-2.89-.98-3.61-2.17a8.2 8.2 0 0 1-.8-1.83Z" />
    </svg>
  </a>
);

const EditionFooter = ({
  vote,
  onVote,
  label = 'Edition',
  focusVote,
  onFocusVote,
  globalVote,
  onGlobalVote,
  bookmarked,
  onBookmarkToggle,
  articleUrl,
  voteDelay = 0.5,
  nextDelay = 0.6,
}: EditionFooterProps): React.ReactElement => {
  const hasActions = onVote || onFocusVote || onGlobalVote || onBookmarkToggle || articleUrl;

  return (
    <>
      {hasActions && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: easeOut, delay: voteDelay }}
          className="flex items-center justify-center gap-4 pt-6 mt-6 border-t border-border"
        >
          {onFocusVote && <VoteControls value={focusVote ?? null} onVote={onFocusVote} label="Relevance" />}
          {onGlobalVote && <VoteControls value={globalVote ?? null} onVote={onGlobalVote} label="Quality" />}
          {onVote && <VoteControls value={vote ?? null} onVote={onVote} label={label} />}
          {onBookmarkToggle && <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onBookmarkToggle} />}
          {articleUrl && <OriginalLinkButton url={articleUrl} />}
        </motion.div>
      )}
      <NextPrompt delay={nextDelay} />
    </>
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { FeedFooterProps, FocusFooterProps, EditionFooterProps };
export { FeedFooter, FocusFooter, EditionFooter, NextPrompt };
