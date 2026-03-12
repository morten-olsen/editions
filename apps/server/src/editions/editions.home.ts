import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import type { Services } from '../services/services.ts';

// --- Types ---

type HomeConfig = {
  id: string;
  name: string;
  icon: string | null;
};

type HomeEditionSection = {
  focusName: string;
  articleCount: number;
};

type HomeEditionLead = {
  title: string;
  sourceName: string;
  imageUrl: string | null;
  consumptionTimeSeconds: number | null;
};

type HomeEditionHighlight = {
  title: string;
  sourceName: string;
};

type HomeEdition = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  publishedAt: string;
  configName: string;
  configIcon: string | null;
  sections: HomeEditionSection[];
  lead: HomeEditionLead | null;
  highlights: HomeEditionHighlight[];
};

type HomeData = {
  sourcesCount: number;
  focusesCount: number;
  configs: HomeConfig[];
  editions: HomeEdition[];
};

// --- Helpers ---

type EditionRow = {
  id: string;
  edition_config_id: string;
  title: string;
  total_reading_minutes: number | null;
  article_count: number;
  published_at: string;
  config_name: string;
  config_icon: string | null;
};

type ArticlePreviewRow = {
  edition_id: string;
  focus_id: string;
  position: number;
  focus_name: string;
  title: string;
  image_url: string | null;
  consumption_time_seconds: number | null;
  source_name: string;
};

const mapEditionRow = (row: EditionRow): Omit<HomeEdition, 'sections' | 'lead' | 'highlights'> => ({
  id: row.id,
  editionConfigId: row.edition_config_id,
  title: row.title,
  totalReadingMinutes: row.total_reading_minutes,
  articleCount: row.article_count,
  publishedAt: row.published_at,
  configName: row.config_name,
  configIcon: row.config_icon,
});

const buildSections = (articles: ArticlePreviewRow[]): HomeEditionSection[] => {
  const sectionMap = new Map<string, { focusName: string; count: number }>();
  for (const a of articles) {
    const existing = sectionMap.get(a.focus_id);
    if (existing) {
      existing.count += 1;
    } else {
      sectionMap.set(a.focus_id, { focusName: a.focus_name, count: 1 });
    }
  }
  return Array.from(sectionMap.values()).map((s) => ({
    focusName: s.focusName,
    articleCount: s.count,
  }));
};

const pickLead = (articles: ArticlePreviewRow[]): HomeEditionLead | null => {
  const leadArticle = articles.find((a) => a.image_url) ?? articles[0] ?? null;
  return leadArticle
    ? {
        title: leadArticle.title,
        sourceName: leadArticle.source_name,
        imageUrl: leadArticle.image_url,
        consumptionTimeSeconds: leadArticle.consumption_time_seconds,
      }
    : null;
};

const pickHighlights = (articles: ArticlePreviewRow[]): HomeEditionHighlight[] => {
  const leadArticle = articles.find((a) => a.image_url) ?? articles[0] ?? null;
  return articles
    .filter((a) => a !== leadArticle)
    .slice(0, 2)
    .map((a) => ({ title: a.title, sourceName: a.source_name }));
};

const assembleEdition = (edRow: EditionRow, articles: ArticlePreviewRow[]): HomeEdition => ({
  ...mapEditionRow(edRow),
  sections: buildSections(articles),
  lead: pickLead(articles),
  highlights: pickHighlights(articles),
});

const groupArticlesByEdition = (rows: ArticlePreviewRow[]): Map<string, ArticlePreviewRow[]> => {
  const map = new Map<string, ArticlePreviewRow[]>();
  for (const row of rows) {
    const existing = map.get(row.edition_id);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.edition_id, [row]);
    }
  }
  return map;
};

// --- Service ---

class HomeService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  getHomeData = async (userId: string): Promise<HomeData> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    const [sourcesCount, focusesCount, configs, editionRows] = await Promise.all([
      this.#countSources(db, userId),
      this.#countFocuses(db, userId),
      this.#fetchConfigs(db, userId),
      this.#fetchUnreadEditions(db, userId),
    ]);

    if (editionRows.length === 0) {
      return {
        sourcesCount,
        focusesCount,
        configs,
        editions: editionRows.map((row) => ({ ...mapEditionRow(row), sections: [], lead: null, highlights: [] })),
      };
    }

    const articlesByEdition = await this.#fetchArticlePreviews(
      db,
      editionRows.map((r) => r.id),
    );
    const editions = editionRows.map((edRow) => assembleEdition(edRow, articlesByEdition.get(edRow.id) ?? []));

    return { sourcesCount, focusesCount, configs, editions };
  };

  #countSources = async (db: Kysely<DatabaseSchema>, userId: string): Promise<number> =>
    db
      .selectFrom('sources')
      .select(db.fn.countAll<number>().as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow()
      .then((r) => r.count);

  #countFocuses = async (db: Kysely<DatabaseSchema>, userId: string): Promise<number> =>
    db
      .selectFrom('focuses')
      .select(db.fn.countAll<number>().as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow()
      .then((r) => r.count);

  #fetchConfigs = async (db: Kysely<DatabaseSchema>, userId: string): Promise<HomeConfig[]> =>
    db
      .selectFrom('edition_configs')
      .select(['id', 'name', 'icon'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

  #fetchUnreadEditions = async (db: Kysely<DatabaseSchema>, userId: string): Promise<EditionRow[]> =>
    db
      .selectFrom('editions')
      .innerJoin('edition_configs', 'edition_configs.id', 'editions.edition_config_id')
      .select([
        'editions.id',
        'editions.edition_config_id',
        'editions.title',
        'editions.total_reading_minutes',
        'editions.article_count',
        'editions.published_at',
        'edition_configs.name as config_name',
        'edition_configs.icon as config_icon',
      ])
      .where('edition_configs.user_id', '=', userId)
      .where('editions.read_at', 'is', null)
      .orderBy('editions.published_at', 'desc')
      .execute();

  #fetchArticlePreviews = async (
    db: Kysely<DatabaseSchema>,
    editionIds: string[],
  ): Promise<Map<string, ArticlePreviewRow[]>> => {
    const rows = await db
      .selectFrom('edition_articles')
      .innerJoin('articles', 'articles.id', 'edition_articles.article_id')
      .innerJoin('sources', 'sources.id', 'articles.source_id')
      .innerJoin('focuses', 'focuses.id', 'edition_articles.focus_id')
      .select([
        'edition_articles.edition_id',
        'edition_articles.focus_id',
        'edition_articles.position',
        'focuses.name as focus_name',
        'articles.title',
        'articles.image_url',
        'articles.consumption_time_seconds',
        'sources.name as source_name',
      ])
      .where('edition_articles.edition_id', 'in', editionIds)
      .orderBy('edition_articles.edition_id', 'asc')
      .orderBy('edition_articles.position', 'asc')
      .execute();

    return groupArticlesByEdition(rows);
  };
}

export type { HomeConfig, HomeEditionSection, HomeEditionLead, HomeEditionHighlight, HomeEdition, HomeData };
export { HomeService };
