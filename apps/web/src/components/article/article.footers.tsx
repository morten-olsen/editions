import * as React from 'react';
import { motion } from 'motion/react';

import * as Article from './article.tsx';
import { easeOut } from './article.tsx';
import type { VoteValue } from './article.tsx';
import { VoteControls } from '../vote-controls.tsx';
import { BookmarkButton } from '../bookmark-button.tsx';
import { Button } from '../button.tsx';
import { useMagazineNav } from '../magazine/magazine.layout.tsx';

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

const FocusFooter = ({ focusVote, onFocusVote, globalVote, onGlobalVote, ...rest }: FocusFooterProps): React.ReactElement => (
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
  bookmarked?: boolean;
  onBookmarkToggle?: (() => void) | null;
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

const EditionFooter = ({
  vote,
  onVote,
  label = 'Edition',
  bookmarked,
  onBookmarkToggle,
  voteDelay = 0.5,
  nextDelay = 0.6,
}: EditionFooterProps): React.ReactElement => (
  <>
    {(onVote || onBookmarkToggle) && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut, delay: voteDelay }}
        className="flex items-center justify-center gap-4 pt-6 mt-6 border-t border-border"
      >
        {onVote && <VoteControls value={vote ?? null} onVote={onVote} label={label} />}
        {onBookmarkToggle && <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onBookmarkToggle} />}
      </motion.div>
    )}
    <NextPrompt delay={nextDelay} />
  </>
);

/* ── Exports ──────────────────────────────────────────────────── */

export type { FeedFooterProps, FocusFooterProps, EditionFooterProps };
export { FeedFooter, FocusFooter, EditionFooter, NextPrompt };
