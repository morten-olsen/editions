/**
 * Edition — Magazine view
 *
 * An issue read the way a magazine is read: a page at a time, two at a time on
 * a wide screen, and nothing to do but turn them. The reader's place is kept
 * between visits, and an article counts as read once its last page is turned
 * past — no scroll depth to infer, because there is no scrolling.
 */

import * as React from 'react';
import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';

import { VoteControls, type VoteValue } from '../../components/vote-controls.tsx';
import { BookmarkButton } from '../../components/bookmark-button.tsx';
import { ContentsButton, MagazineNavProvider } from '../../components/magazine/magazine.tsx';
import {
  Folio,
  formatFor,
  useElementSize,
  useFontsReady,
  PagedSurface,
  FOOTER_SPACE,
} from '../../components/reader/reader.ts';
import type { PageFooterArgs } from '../../components/reader/reader.ts';

import type { EditionArticle, EditionDetail, FocusSection } from './edition-types.ts';
import { useMagazineProgress } from './edition-magazine-progress.ts';
import { useMagazineSheets, type ArticleSpan } from './edition-magazine-sheets.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type MagazineViewProps = {
  edition: EditionDetail;
  sections: FocusSection[];
  votes: Record<string, VoteValue>;
  globalVotes: Record<string, VoteValue>;
  focusVotes: Record<string, VoteValue>;
  bookmarkedIds: Set<string>;
  onVote: (articleId: string, value: VoteValue) => void;
  onGlobalVote: (articleId: string, value: VoteValue) => void;
  onFocusVote: (articleId: string, focusId: string, value: VoteValue) => void;
  onBookmarkToggle: (articleId: string) => void;
  onSaveUrl: (url: string) => Promise<void>;
  onMarkArticleViewed: (sourceId: string, articleId: string) => void;
  onExit: () => void;
  onMarkDone: () => void;
};

/* ── Private helpers ──────────────────────────────────────────── */

/** The article a given page belongs to, if any. */
const spanAt = (spans: ArticleSpan[], page: number): ArticleSpan | null =>
  spans.find((span) => page >= span.firstPage && page <= span.lastPage) ?? null;

/* ── Article actions ──────────────────────────────────────────── */

type ArticleActionsProps = {
  article: EditionArticle;
  votes: Record<string, VoteValue>;
  globalVotes: Record<string, VoteValue>;
  focusVotes: Record<string, VoteValue>;
  bookmarked: boolean;
  /** A hand-sized page — tighten spacing, but never drop the labels. */
  compact: boolean;
  onVote: (articleId: string, value: VoteValue) => void;
  onGlobalVote: (articleId: string, value: VoteValue) => void;
  onFocusVote: (articleId: string, focusId: string, value: VoteValue) => void;
  onBookmarkToggle: (articleId: string) => void;
};

/**
 * What a reader can do once they reach the end of a piece. Sized for the
 * footer band, so it sits under the last page rather than interrupting it.
 *
 * The labels stay at every size. A bare pair of chevrons gives a reader no way
 * to know what they are voting on, and there are three different votes here —
 * so a narrow page buys room by tightening the gaps and reducing the original
 * link to its icon, not by removing the words.
 */
const ArticleActions = ({
  article,
  votes,
  globalVotes,
  focusVotes,
  bookmarked,
  compact,
  onVote,
  onGlobalVote,
  onFocusVote,
  onBookmarkToggle,
}: ArticleActionsProps): React.ReactElement => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4, delay: 0.15 }}
    className={`flex items-center ${compact ? 'gap-1.5' : 'gap-3'}`}
  >
    <VoteControls
      value={focusVotes[article.id] ?? null}
      onVote={(value) => onFocusVote(article.id, article.focusId, value)}
      label="Relevance"
    />
    <VoteControls
      value={globalVotes[article.id] ?? null}
      onVote={(value) => onGlobalVote(article.id, value)}
      label="Quality"
    />
    <VoteControls value={votes[article.id] ?? null} onVote={(value) => onVote(article.id, value)} label="Edition" />
    <BookmarkButton bookmarked={bookmarked} onToggle={() => onBookmarkToggle(article.id)} />
    {article.url && (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View original"
        title="View original"
        className="shrink-0 font-mono text-[10px] tracking-wide text-ink-faint transition-colors duration-fast hover:text-ink-secondary"
      >
        {compact ? <ExternalLink size={13} strokeWidth={1.75} /> : 'Original'}
      </a>
    )}
  </motion.div>
);

/* ── Page footer ──────────────────────────────────────────────── */

/** Everything the reader can act on, and the voting callbacks behind it. */
type ArticleActionBindings = Omit<ArticleActionsProps, 'article' | 'bookmarked' | 'compact'> & {
  isBookmarked: (articleId: string) => boolean;
};

type PageFooterProps = {
  args: PageFooterArgs;
  span: ArticleSpan | null;
  actions: ArticleActionBindings;
  compact: boolean;
};

/**
 * The band every typeset page reserves. The folio sits there on every page but
 * the cover — the contents refers to those numbers, so they have to be on the
 * pages themselves. The actions appear only where a piece ends.
 */
const PageFooter = ({ args, span, actions, compact }: PageFooterProps): React.ReactElement | null => {
  // A cover isn't numbered.
  if (args.index === 0) {
    return null;
  }

  const endsHere = span !== null && args.index === span.lastPage;

  return (
    <div
      className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-2 pb-3 ${
        compact ? 'px-2' : 'px-6'
      }`}
      style={{ height: FOOTER_SPACE }}
    >
      {endsHere && (
        <ArticleActions
          {...actions}
          article={span.article}
          bookmarked={actions.isBookmarked(span.article.id)}
          compact={compact}
        />
      )}
      <Folio index={args.index} total={args.total} />
    </div>
  );
};

/* ── Exit ─────────────────────────────────────────────────────── */

/**
 * Sits in the footer band every page reserves, so it never lands on top of a
 * headline. Bottom-left is also outside the edge zone that turns pages.
 */
const ExitButton = ({ onExit }: { onExit: () => void }): React.ReactElement => (
  <button
    onClick={onExit}
    className="fixed bottom-4 left-5 z-60 cursor-pointer font-mono text-[10px] tracking-widest text-ink-faint uppercase transition-colors duration-fast hover:text-ink-secondary"
  >
    ← Exit
  </button>
);

/* ── Issue state ──────────────────────────────────────────────── */

type UseIssueArgs = Pick<MagazineViewProps, 'edition' | 'sections' | 'onMarkArticleViewed' | 'onMarkDone'>;

/**
 * Measures the surface, typesets the issue into it, and keeps the reader's
 * place. Turning past an article's last page is what marks it read — with no
 * scrolling there is no scroll depth to infer it from, which is simpler and
 * also more honest about what was actually reached.
 */
const useIssue = ({ edition, sections, onMarkArticleViewed, onMarkDone }: UseIssueArgs) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const size = useElementSize(containerRef);
  const fontsReady = useFontsReady();
  const format = React.useMemo(() => formatFor(size), [size]);

  const { page, setPage, savePage } = useMagazineProgress(edition.id);
  const pageRef = React.useRef(page);
  pageRef.current = page;

  const handleNavigate = React.useCallback(
    (target: number): void => {
      setPage(target);
      savePage(target);
    },
    [setPage, savePage],
  );

  const { sheets, spans, contents } = useMagazineSheets({
    edition,
    sections,
    page: format.page,
    enabled: fontsReady,
    onNavigate: handleNavigate,
    onMarkDone,
  });

  const spansRef = React.useRef(spans);
  spansRef.current = spans;

  const handleTurn = React.useCallback(
    (target: number): void => {
      const leaving = spanAt(spansRef.current, pageRef.current);
      if (leaving && (target < leaving.firstPage || target > leaving.lastPage)) {
        onMarkArticleViewed(leaving.article.sourceId, leaving.article.id);
      }
      handleNavigate(target);
    },
    [handleNavigate, onMarkArticleViewed],
  );

  return { containerRef, format, sheets, contents, spansRef, page, handleTurn };
};

/* ── MagazineView ─────────────────────────────────────────────── */

const MagazineView = ({
  edition,
  sections,
  votes,
  globalVotes,
  focusVotes,
  bookmarkedIds,
  onVote,
  onGlobalVote,
  onFocusVote,
  onBookmarkToggle,
  onMarkArticleViewed,
  onExit,
  onMarkDone,
}: MagazineViewProps): React.ReactElement => {
  const { containerRef, format, sheets, contents, spansRef, page, handleTurn } = useIssue({
    edition,
    sections,
    onMarkArticleViewed,
    onMarkDone,
  });

  const actions = React.useMemo<ArticleActionBindings>(
    () => ({
      votes,
      globalVotes,
      focusVotes,
      onVote,
      onGlobalVote,
      onFocusVote,
      onBookmarkToggle,
      isBookmarked: (articleId: string) => bookmarkedIds.has(articleId),
    }),
    [votes, globalVotes, focusVotes, bookmarkedIds, onVote, onGlobalVote, onFocusVote, onBookmarkToggle],
  );

  const renderFooter = React.useCallback(
    (args: PageFooterArgs): React.ReactNode => (
      <PageFooter
        args={args}
        span={spanAt(spansRef.current, args.index)}
        actions={actions}
        compact={format.mode === 'compact'}
      />
    ),
    [actions, spansRef, format.mode],
  );

  const nav = React.useMemo(
    () => ({ page, total: sheets.length, onPageChange: handleTurn }),
    [page, sheets.length, handleTurn],
  );

  return (
    <MagazineNavProvider value={nav}>
      <div className="fixed inset-0 z-50 bg-surface-sunken">
        <ExitButton onExit={onExit} />
        <ContentsButton sections={contents} onNavigate={handleTurn} />
        <PagedSurface
          containerRef={containerRef}
          format={format}
          sheets={sheets}
          index={Math.min(page, Math.max(sheets.length - 1, 0))}
          onTurn={handleTurn}
          coverAlone
          footer={renderFooter}
          onExit={onExit}
        />
      </div>
    </MagazineNavProvider>
  );
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { MagazineViewProps };
export { MagazineView };
