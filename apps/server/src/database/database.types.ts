import type { ColumnType } from 'kysely';

// --- Column helpers ---

type Timestamp = ColumnType<string, string | undefined, string>;

// --- Table types ---

type UserRole = 'admin' | 'user';

type UsersTable = {
  id: string;
  username: string;
  password_hash: string | null;
  role: UserRole;
  scoring_weights: string | null; // JSON: UserScoringWeights
  created_at: Timestamp;
  updated_at: Timestamp;
};

type SourceType = 'rss' | 'podcast' | 'mastodon' | 'bluesky' | 'youtube' | 'custom' | 'bookmarks';

type SourcesTable = {
  id: string;
  user_id: string;
  type: SourceType;
  name: string;
  url: string;
  config: string; // JSON
  direction: string;
  last_fetched_at: string | null;
  fetch_error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type ArticlesTable = {
  id: string;
  source_id: string;
  external_id: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  consumption_time_seconds: number | null;
  image_url: string | null;
  media_url: string | null;
  media_type: string | null;
  published_at: string | null;
  fetched_at: Timestamp;
  extracted_at: string | null;
  analysed_at: string | null;
  read_at: string | null;
  progress: ColumnType<number, number | undefined, number>;
  created_at: Timestamp;
};

type FocusesTable = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  min_confidence: ColumnType<number, number | undefined, number>;
  min_consumption_time_seconds: number | null;
  max_consumption_time_seconds: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type FocusSourceMode = 'always' | 'match';

type EditionBudgetType = 'time' | 'count';

type FocusSourcesTable = {
  focus_id: string;
  source_id: string;
  mode: FocusSourceMode;
  weight: ColumnType<number, number | undefined, number>;
};

type ArticleFocusesTable = {
  article_id: string;
  focus_id: string;
  similarity: number | null;
  similarity_model: string | null;
  nli: number | null;
  nli_model: string | null;
  assigned_at: Timestamp;
};

type ArticleEmbeddingsTable = {
  article_id: string;
  embedding: Buffer;
  model: string;
  created_at: Timestamp;
};

type EditionConfigsTable = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookback_hours: number;
  exclude_prior_editions: number; // SQLite boolean
  enabled: number; // SQLite boolean
  created_at: Timestamp;
  updated_at: Timestamp;
};

type EditionConfigFocusesTable = {
  edition_config_id: string;
  focus_id: string;
  position: number;
  budget_type: EditionBudgetType;
  budget_value: number;
  lookback_hours: number | null;
  exclude_prior_editions: number | null; // null = inherit edition default; 1 = always exclude; 0 = never exclude
  weight: ColumnType<number, number | undefined, number>;
};

type EditionConfigSourceBudgetsTable = {
  edition_config_id: string;
  source_id: string;
  max_articles: number | null;
  max_reading_minutes: number | null;
};

type EditionsTable = {
  id: string;
  edition_config_id: string;
  title: string;
  total_reading_minutes: number | null;
  article_count: number;
  current_position: number;
  read_at: string | null;
  published_at: Timestamp;
  created_at: Timestamp;
};

type EditionArticlesTable = {
  edition_id: string;
  article_id: string;
  focus_id: string;
  position: number;
};

type ArticleVoteValue = 1 | -1;

type ArticleVotesTable = {
  id: string;
  user_id: string;
  article_id: string;
  focus_id: string | null;
  edition_id: string | null;
  value: ArticleVoteValue;
  created_at: Timestamp;
};

type BookmarksTable = {
  id: string;
  user_id: string;
  article_id: string;
  created_at: Timestamp;
};

// --- Full schema ---

type DatabaseSchema = {
  users: UsersTable;
  sources: SourcesTable;
  articles: ArticlesTable;
  focuses: FocusesTable;
  focus_sources: FocusSourcesTable;
  article_focuses: ArticleFocusesTable;
  article_embeddings: ArticleEmbeddingsTable;
  edition_configs: EditionConfigsTable;
  edition_config_focuses: EditionConfigFocusesTable;
  edition_config_source_budgets: EditionConfigSourceBudgetsTable;
  editions: EditionsTable;
  edition_articles: EditionArticlesTable;
  article_votes: ArticleVotesTable;
  bookmarks: BookmarksTable;
};

export type {
  Timestamp,
  DatabaseSchema,
  UserRole,
  UsersTable,
  SourcesTable,
  SourceType,
  ArticlesTable,
  FocusesTable,
  FocusSourceMode,
  FocusSourcesTable,
  ArticleFocusesTable,
  ArticleEmbeddingsTable,
  EditionConfigsTable,
  EditionConfigFocusesTable,
  EditionConfigSourceBudgetsTable,
  EditionsTable,
  EditionArticlesTable,
  EditionBudgetType,
  ArticleVoteValue,
  ArticleVotesTable,
  BookmarksTable,
};
