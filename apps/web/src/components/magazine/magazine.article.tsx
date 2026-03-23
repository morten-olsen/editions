import type { VoteValue } from '../vote-controls.tsx';

/* ── Types ────────────────────────────────────────────────────── */

type MagazineArticleProps = {
  articleId?: string | null;
  title: string;
  sourceName: string;
  author?: string | null;
  summary?: string | null;
  publishedAt?: string | null;
  consumptionTimeSeconds?: number | null;
  imageUrl?: string | null;
  sourceType?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  progress?: number | null;
  content?: string | null;
  positionInSection?: number;
  vote?: VoteValue | null;
  onVote?: ((value: VoteValue) => void) | null;
  voteLabel?: string;
  bookmarked?: boolean;
  onBookmarkToggle?: (() => void) | null;
};

/* ── Exports ──────────────────────────────────────────────────── */

export type { MagazineArticleProps, VoteValue };
export { MagazineArticle } from './magazine.layouts.tsx';
