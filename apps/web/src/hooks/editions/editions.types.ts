/* ── Types ────────────────────────────────────────────────────────── */

type VoteValue = 1 | -1 | null;

type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt?: string | null;
  progress: number;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type EditionDetail = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  articles: EditionArticle[];
};

type FocusSection = {
  focusId: string;
  focusName: string;
  articles: EditionArticle[];
};

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type EditionConfig = {
  id: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
  createdAt: string;
  updatedAt?: string;
};

type EditionSummary = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  configName: string;
};

type FocusConfig = {
  focusId: string;
  position: number;
  budgetType: 'time' | 'count';
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null;
  weight: number;
};

type Focus = {
  id: string;
  name: string;
  description: string | null;
};

type ViewMode = 'list' | 'magazine';

/* ── Exports ──────────────────────────────────────────────────────── */

export type {
  VoteValue,
  EditionArticle,
  EditionDetail,
  FocusSection,
  EditionConfigFocus,
  EditionConfig,
  EditionSummary,
  FocusConfig,
  Focus,
  ViewMode,
};
