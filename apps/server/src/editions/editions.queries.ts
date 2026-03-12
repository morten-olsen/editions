import type { Kysely } from 'kysely';

import type { DatabaseSchema, EditionBudgetType } from '../database/database.types.ts';

// --- Types ---

type EditionConfigFocus = {
  focusId: string;
  focusName: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours: number | null;
  excludePriorEditions: boolean | null; // null = inherit edition config setting
  weight: number;
};

type EditionConfig = {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions: boolean;
  enabled: boolean;
  focuses: EditionConfigFocus[];
  createdAt: string;
  updatedAt: string;
};

type CreateEditionConfigParams = {
  userId: string;
  name: string;
  icon?: string | null;
  schedule: string;
  lookbackHours: number;
  excludePriorEditions?: boolean;
  enabled?: boolean;
  focuses: CreateEditionConfigFocusParams[];
};

type CreateEditionConfigFocusParams = {
  focusId: string;
  position: number;
  budgetType: EditionBudgetType;
  budgetValue: number;
  lookbackHours?: number | null;
  excludePriorEditions?: boolean | null;
  weight?: number;
};

type UpdateEditionConfigParams = {
  name?: string;
  icon?: string | null;
  schedule?: string;
  lookbackHours?: number;
  excludePriorEditions?: boolean;
  enabled?: boolean;
  focuses?: CreateEditionConfigFocusParams[];
};

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
  readAt: string | null;
  progress: number;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type Edition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  createdAt: string;
};

type EditionDetail = Edition & {
  articles: EditionArticle[];
};

type EditionSummary = Edition & {
  configName: string;
};

// --- Row mappers ---

const mapFocusLinkRow = (link: {
  focus_id: string;
  focus_name: string;
  position: number;
  budget_type: string;
  budget_value: number;
  lookback_hours: number | null;
  exclude_prior_editions: number | null;
  weight: number;
}): EditionConfigFocus => ({
  focusId: link.focus_id,
  focusName: link.focus_name,
  position: link.position,
  budgetType: link.budget_type as EditionBudgetType,
  budgetValue: link.budget_value,
  lookbackHours: link.lookback_hours,
  excludePriorEditions: link.exclude_prior_editions === null ? null : link.exclude_prior_editions === 1,
  weight: link.weight,
});

const mapEditionArticleRow = (a: {
  id: string;
  source_id: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  image_url: string | null;
  published_at: string | null;
  consumption_time_seconds: number | null;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  source_type: string;
  read_at: string | null;
  progress: number;
  source_name: string;
  focus_id: string;
  focus_name: string;
  position: number;
}): EditionArticle => ({
  id: a.id,
  sourceId: a.source_id,
  title: a.title,
  author: a.author,
  summary: a.summary,
  url: a.url,
  imageUrl: a.image_url,
  publishedAt: a.published_at,
  consumptionTimeSeconds: a.consumption_time_seconds,
  content: a.content,
  mediaUrl: a.media_url,
  mediaType: a.media_type,
  sourceType: a.source_type,
  readAt: a.read_at,
  progress: a.progress,
  sourceName: a.source_name,
  focusId: a.focus_id,
  focusName: a.focus_name,
  position: a.position,
});

const mapEditionRow = (row: {
  id: string;
  edition_config_id: string;
  title: string;
  total_reading_minutes: number | null;
  article_count: number;
  current_position: number;
  read_at: string | null;
  published_at: string;
  created_at: string;
}): Edition => ({
  id: row.id,
  editionConfigId: row.edition_config_id,
  title: row.title,
  totalReadingMinutes: row.total_reading_minutes,
  articleCount: row.article_count,
  currentPosition: row.current_position,
  readAt: row.read_at,
  publishedAt: row.published_at,
  createdAt: row.created_at,
});

// --- Config query helpers ---

const mapConfigRow = (
  row: {
    id: string;
    user_id: string;
    name: string;
    icon: string | null;
    schedule: string;
    lookback_hours: number;
    exclude_prior_editions: number;
    enabled: number;
    created_at: string;
    updated_at: string;
  },
  focuses: EditionConfigFocus[],
): EditionConfig => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  icon: row.icon,
  schedule: row.schedule,
  lookbackHours: row.lookback_hours,
  excludePriorEditions: row.exclude_prior_editions === 1,
  enabled: row.enabled === 1,
  focuses,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const FOCUS_LINK_COLUMNS = [
  'edition_config_focuses.focus_id',
  'edition_config_focuses.position',
  'edition_config_focuses.budget_type',
  'edition_config_focuses.budget_value',
  'edition_config_focuses.lookback_hours',
  'edition_config_focuses.exclude_prior_editions',
  'edition_config_focuses.weight',
  'focuses.name as focus_name',
] as const;

const queryFocusLinks = (db: Kysely<DatabaseSchema>, configId: string) =>
  db
    .selectFrom('edition_config_focuses')
    .innerJoin('focuses', 'focuses.id', 'edition_config_focuses.focus_id')
    .select([...FOCUS_LINK_COLUMNS])
    .where('edition_config_id', '=', configId)
    .orderBy('edition_config_focuses.position', 'asc');

const queryFocusLinksForConfigs = (db: Kysely<DatabaseSchema>, configIds: string[]) =>
  db
    .selectFrom('edition_config_focuses')
    .innerJoin('focuses', 'focuses.id', 'edition_config_focuses.focus_id')
    .select(['edition_config_focuses.edition_config_id', ...FOCUS_LINK_COLUMNS])
    .where('edition_config_id', 'in', configIds)
    .orderBy('edition_config_focuses.position', 'asc');

const queryEditionArticles = (db: Kysely<DatabaseSchema>, editionId: string) =>
  db
    .selectFrom('edition_articles')
    .innerJoin('articles', 'articles.id', 'edition_articles.article_id')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .innerJoin('focuses', 'focuses.id', 'edition_articles.focus_id')
    .select([
      'articles.id',
      'articles.source_id',
      'articles.title',
      'articles.author',
      'articles.summary',
      'articles.url',
      'articles.image_url',
      'articles.published_at',
      'articles.consumption_time_seconds',
      'articles.content',
      'articles.media_url',
      'articles.media_type',
      'articles.read_at',
      'articles.progress',
      'sources.name as source_name',
      'sources.type as source_type',
      'edition_articles.focus_id',
      'focuses.name as focus_name',
      'edition_articles.position',
    ])
    .where('edition_articles.edition_id', '=', editionId)
    .orderBy('edition_articles.position', 'asc');

export type {
  EditionConfig,
  EditionConfigFocus,
  CreateEditionConfigParams,
  CreateEditionConfigFocusParams,
  UpdateEditionConfigParams,
  Edition,
  EditionDetail,
  EditionSummary,
  EditionArticle,
};
export {
  mapFocusLinkRow,
  mapEditionArticleRow,
  mapEditionRow,
  mapConfigRow,
  queryFocusLinks,
  queryFocusLinksForConfigs,
  queryEditionArticles,
};
