type VoteValue = 1 | -1 | null;

type SourceSelection = {
  sourceId: string;
  weight: number;
  minConfidence: number | null;
};

type Source = {
  id: string;
  name: string;
  url: string;
};

type FocusListItem = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  sources: { sourceId: string; weight: number; minConfidence: number | null }[];
  createdAt: string;
};

type FocusDetail = {
  id: string;
  name: string;
  description: string | null;
  sources: { sourceId: string }[];
  createdAt: string;
  updatedAt: string;
};

type FocusEditable = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  minConfidence: number;
  minConsumptionTimeSeconds: number | null;
  maxConsumptionTimeSeconds: number | null;
  sources: SourceSelection[];
};

type FocusArticle = {
  id: string;
  sourceId: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  readAt: string | null;
  confidence: number;
  score: number;
  vote: VoteValue;
  globalVote: VoteValue;
  sourceName: string;
  sourceType: string;
};

type FocusArticlesPage = {
  articles: FocusArticle[];
  total: number;
  offset: number;
  limit: number;
};

type ArticlesWithBookmarks = {
  page: FocusArticlesPage;
  bookmarkedIds: Set<string>;
};

type SortMode = 'top' | 'recent';
type TimeWindow = 'today' | 'week' | 'all';
type ReadStatus = 'all' | 'unread' | 'read';

type JobEntry = {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  affects: { sourceIds: string[]; focusIds: string[] };
};

type VoteOverride = { vote?: VoteValue; globalVote?: VoteValue };

export type {
  VoteValue,
  SourceSelection,
  Source,
  FocusListItem,
  FocusDetail,
  FocusEditable,
  FocusArticle,
  FocusArticlesPage,
  ArticlesWithBookmarks,
  SortMode,
  TimeWindow,
  ReadStatus,
  JobEntry,
  VoteOverride,
};
