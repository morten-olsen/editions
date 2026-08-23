import { z } from 'zod/v4';

import { DatabaseService } from '../database/database.ts';
import { DiscoveryService } from '../discovery/discovery.ts';
import { SourcesService } from '../sources/sources.ts';

import { LIMITS, capList, capped, clamp, truncate } from './mcp.budget.ts';
import { probeFeed, ratePerWeek } from './mcp.feeds.ts';
import { defineTool, readinessFor } from './mcp.tools.ts';
import type { McpTool } from './mcp.tools.ts';

/**
 * Read-only tools for understanding sources — what a feed is, what the catalog
 * offers, what a subscribed source actually publishes. The tools that create or
 * refresh sources live in `mcp.tools.ingest.ts`.
 */

// --- inspect_feed ---

const inspectFeed = defineTool({
  name: 'inspect_feed',
  title: 'Inspect a feed URL',
  description: [
    'Probe one or more feed URLs WITHOUT adding them. Returns whether each URL is a usable feed,',
    'how often it publishes, whether items carry full text or only summaries, and a sample of recent',
    'titles. Use this to judge a candidate source before calling add_sources — it has no side effects',
    'and does not consume any analysis time.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    urls: z
      .array(z.url())
      .min(1)
      .max(LIMITS.feedProbe.max)
      .describe(`Feed URLs to probe (max ${LIMITS.feedProbe.max}).`),
  },
  handler: async ({ urls }) => {
    const results = await Promise.all(urls.map(probeFeed));
    return { feeds: results };
  },
});

// --- browse_catalog ---

const browseCatalog = defineTool({
  name: 'browse_catalog',
  title: 'Browse the discovery catalog',
  description: [
    'Search the curated catalog of ready-made sources, focuses and edition configs. Each entry can be',
    'adopted wholesale with adopt_from_catalog. Prefer this over hand-building a setup from scratch:',
    'catalog focuses come with tuned confidence thresholds and source weights.',
    'Entries already adopted by this user are marked.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    kind: z
      .enum(['sources', 'focuses', 'edition_configs', 'all'])
      .default('all')
      .describe('Which part of the catalog to search.'),
    search: z.string().optional().describe('Free-text match against name and description.'),
    tag: z.string().optional().describe('Filter by tag. Omit and set kind="all" to see available tags.'),
    limit: z.number().int().min(1).max(LIMITS.catalog.max).optional(),
  },
  handler: async ({ kind, search, tag, limit }, ctx) => {
    const discovery = ctx.services.get(DiscoveryService);
    const take = clamp(limit, LIMITS.catalog);
    const adopted = await discovery.getAdoptionStatus(ctx.userId);
    const params = { search, tag, limit: take };

    const empty = { items: [], total: 0, offset: 0, limit: take };
    const wants = (k: string): boolean => kind === 'all' || kind === k;

    const sources = wants('sources') ? discovery.listSources(params) : empty;
    const focuses = wants('focuses') ? discovery.listFocuses(params) : empty;
    const editionConfigs = wants('edition_configs') ? discovery.listEditionConfigs(params) : empty;

    return {
      tags: discovery.listTags(),
      sources: capped(
        sources.items.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          url: s.url,
          description: truncate(s.description, LIMITS.summaryChars),
          tags: s.tags,
          adopted: adopted.adoptedSourceUrls.has(s.url),
        })),
        sources.total,
      ),
      focuses: capped(
        focuses.items.map((f) => ({
          id: f.id,
          name: f.name,
          description: truncate(f.description, LIMITS.summaryChars),
          sourceCount: f.sources.length,
          adopted: adopted.adoptedFocusOrigins.has(f.id),
        })),
        focuses.total,
      ),
      editionConfigs: capped(
        editionConfigs.items.map((e) => ({
          id: e.id,
          name: e.name,
          description: truncate(e.description, LIMITS.summaryChars),
          schedule: e.schedule,
          focusCount: e.focuses.length,
          adopted: adopted.adoptedEditionOrigins.has(e.id),
        })),
        editionConfigs.total,
      ),
    };
  },
});

// --- profile_source ---

const profileSource = defineTool({
  name: 'profile_source',
  title: 'Profile what a source publishes',
  description: [
    'Summarise a source: publishing volume, reading-time distribution, which focuses its articles',
    'already match, and a sample of recent titles. This is the tool for understanding a source’s',
    'subject matter — do NOT try to page through its articles, a busy source has thousands and the',
    'sample here is representative.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    sourceId: z.string(),
    sampleSize: z.number().int().min(1).max(LIMITS.sourceSample.max).optional(),
  },
  handler: async ({ sourceId, sampleSize }, ctx) => {
    const sourcesService = ctx.services.get(SourcesService);
    // Ownership check — throws SourceNotFoundError for another user's source.
    const source = await sourcesService.get(ctx.userId, sourceId);
    const db = await ctx.services.get(DatabaseService).getInstance();
    const take = clamp(sampleSize, LIMITS.sourceSample);

    const stats = await db
      .selectFrom('articles')
      .select([
        db.fn.countAll().as('total'),
        db.fn.count('analysed_at').as('analysed'),
        db.fn.avg('consumption_time_seconds').as('avg_seconds'),
        db.fn.min('published_at').as('oldest'),
        db.fn.max('published_at').as('newest'),
      ])
      .where('source_id', '=', sourceId)
      .executeTakeFirstOrThrow();

    const recent = await db
      .selectFrom('articles')
      .select(['id', 'title', 'summary', 'published_at', 'consumption_time_seconds'])
      .where('source_id', '=', sourceId)
      .orderBy('published_at', 'desc')
      .limit(take)
      .execute();

    const allStats = await sourcesService.getClassificationStats(ctx.userId);
    const focusStats = allStats.find((s) => s.sourceId === sourceId)?.focuses ?? [];

    const total = Number(stats.total);

    return {
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        type: source.type,
        lastFetchedAt: source.lastFetchedAt,
        fetchError: source.fetchError,
      },
      volume: {
        articles: total,
        analysed: Number(stats.analysed),
        oldestArticleAt: stats.oldest,
        newestArticleAt: stats.newest,
        itemsPerWeek: ratePerWeek({
          count: total,
          from: stats.oldest as string | null,
          to: stats.newest as string | null,
        }),
        avgReadingSeconds: stats.avg_seconds === null ? null : Math.round(Number(stats.avg_seconds)),
      },
      // Which focuses this source already feeds, strongest first — the fastest way
      // to see whether a source is on-topic for an existing focus.
      focusDistribution: capList(
        focusStats.map((f) => ({
          focusId: f.focusId,
          focusName: f.focusName,
          articles: f.articleCount,
          avgConfidence: Number(f.avgConfidence.toFixed(3)),
        })),
        LIMITS.focusSample.max,
      ),
      recentArticles: recent.map((a) => ({
        id: a.id,
        title: truncate(a.title, LIMITS.titleChars),
        summary: truncate(a.summary, LIMITS.summaryChars),
        publishedAt: a.published_at,
        consumptionTimeSeconds: a.consumption_time_seconds,
      })),
      readiness: await readinessFor(ctx, { sourceIds: [sourceId] }),
    };
  },
});

// --- Exports ---

const sourceTools: McpTool[] = [inspectFeed, browseCatalog, profileSource];

export { sourceTools };
