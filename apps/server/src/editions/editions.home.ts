import { DatabaseService } from "../database/database.ts";

import type { Services } from "../services/services.ts";

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

// --- Service ---

class HomeService {
  #services: Services;

  constructor(services: Services) {
    this.#services = services;
  }

  getHomeData = async (userId: string): Promise<HomeData> => {
    const db = await this.#services.get(DatabaseService).getInstance();

    // Phase 1: parallel lightweight queries
    const [sourcesCount, focusesCount, configs, editionRows] = await Promise.all([
      db
        .selectFrom("sources")
        .select(db.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow()
        .then((r) => r.count),

      db
        .selectFrom("focuses")
        .select(db.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .executeTakeFirstOrThrow()
        .then((r) => r.count),

      db
        .selectFrom("edition_configs")
        .select(["id", "name", "icon"])
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .execute(),

      db
        .selectFrom("editions")
        .innerJoin("edition_configs", "edition_configs.id", "editions.edition_config_id")
        .select([
          "editions.id",
          "editions.edition_config_id",
          "editions.title",
          "editions.total_reading_minutes",
          "editions.article_count",
          "editions.published_at",
          "edition_configs.name as config_name",
          "edition_configs.icon as config_icon",
        ])
        .where("edition_configs.user_id", "=", userId)
        .where("editions.read_at", "is", null)
        .orderBy("editions.published_at", "desc")
        .execute(),
    ]);

    // Early return if no unread editions
    if (editionRows.length === 0) {
      return {
        sourcesCount,
        focusesCount,
        configs,
        editions: editionRows.map((row) => ({
          id: row.id,
          editionConfigId: row.edition_config_id,
          title: row.title,
          totalReadingMinutes: row.total_reading_minutes,
          articleCount: row.article_count,
          publishedAt: row.published_at,
          configName: row.config_name,
          configIcon: row.config_icon,
          sections: [],
          lead: null,
          highlights: [],
        })),
      };
    }

    // Phase 2: bulk fetch article preview data for all unread editions
    const editionIds = editionRows.map((r) => r.id);

    const articleRows = await db
      .selectFrom("edition_articles")
      .innerJoin("articles", "articles.id", "edition_articles.article_id")
      .innerJoin("sources", "sources.id", "articles.source_id")
      .innerJoin("focuses", "focuses.id", "edition_articles.focus_id")
      .select([
        "edition_articles.edition_id",
        "edition_articles.focus_id",
        "edition_articles.position",
        "focuses.name as focus_name",
        "articles.title",
        "articles.image_url",
        "articles.consumption_time_seconds",
        "sources.name as source_name",
      ])
      .where("edition_articles.edition_id", "in", editionIds)
      .orderBy("edition_articles.edition_id", "asc")
      .orderBy("edition_articles.position", "asc")
      .execute();

    // Group articles by edition
    const articlesByEdition = new Map<string, typeof articleRows>();
    for (const row of articleRows) {
      const existing = articlesByEdition.get(row.edition_id);
      if (existing) {
        existing.push(row);
      } else {
        articlesByEdition.set(row.edition_id, [row]);
      }
    }

    // Assemble editions with sections, lead, and highlights
    const editions: HomeEdition[] = editionRows.map((edRow) => {
      const articles = articlesByEdition.get(edRow.id) ?? [];

      // Build sections: group by focus, preserving insertion order
      const sectionMap = new Map<string, { focusName: string; count: number }>();
      for (const a of articles) {
        const existing = sectionMap.get(a.focus_id);
        if (existing) {
          existing.count += 1;
        } else {
          sectionMap.set(a.focus_id, { focusName: a.focus_name, count: 1 });
        }
      }
      const sections: HomeEditionSection[] = Array.from(sectionMap.values()).map((s) => ({
        focusName: s.focusName,
        articleCount: s.count,
      }));

      // Lead: prefer first article with an image, fall back to position 0
      const withImage = articles.find((a) => a.image_url);
      const leadArticle = withImage ?? articles[0] ?? null;
      const lead: HomeEditionLead | null = leadArticle
        ? {
            title: leadArticle.title,
            sourceName: leadArticle.source_name,
            imageUrl: leadArticle.image_url,
            consumptionTimeSeconds: leadArticle.consumption_time_seconds,
          }
        : null;

      // Highlights: next articles after lead (different from lead), up to 2
      const highlights: HomeEditionHighlight[] = articles
        .filter((a) => a !== leadArticle)
        .slice(0, 2)
        .map((a) => ({ title: a.title, sourceName: a.source_name }));

      return {
        id: edRow.id,
        editionConfigId: edRow.edition_config_id,
        title: edRow.title,
        totalReadingMinutes: edRow.total_reading_minutes,
        articleCount: edRow.article_count,
        publishedAt: edRow.published_at,
        configName: edRow.config_name,
        configIcon: edRow.config_icon,
        sections,
        lead,
        highlights,
      };
    });

    return { sourcesCount, focusesCount, configs, editions };
  };
}

export type {
  HomeConfig,
  HomeEditionSection,
  HomeEditionLead,
  HomeEditionHighlight,
  HomeEdition,
  HomeData,
};
export { HomeService };
