import * as React from 'react';

import { VoteControls } from '../vote-controls.tsx';
import { Button } from '../button.tsx';

import type { VoteValue } from './article.tsx';
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

/* ── Exports ──────────────────────────────────────────────────── */

export type { FeedFooterProps, FocusFooterProps };
export { FeedFooter, FocusFooter };
