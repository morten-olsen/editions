import { z } from 'zod/v4';
import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import { EditionsService } from '../editions/editions.ts';
import { FocusesService } from '../focuses/focuses.ts';
import { SourcesService } from '../sources/sources.ts';
import { VotesService } from '../votes/votes.ts';

import { LIMITS, capList, truncate } from './mcp.budget.ts';
import { defineTool, readinessAdvice, readinessFor, waitForReadiness } from './mcp.tools.ts';
import type { McpTool } from './mcp.tools.ts';

type Db = Kysely<DatabaseSchema>;

// --- get_workspace ---

type SourceCounts = { total: number; analysed: number; newest: string | null };

/** Article totals per source, so the caller can see coverage without a query per source. */
const countArticlesBySource = async (db: Db, userId: string): Promise<Map<string, SourceCounts>> => {
  const rows = await db
    .selectFrom('articles')
    .innerJoin('sources', 'sources.id', 'articles.source_id')
    .select([
      'articles.source_id',
      db.fn.countAll().as('total'),
      db.fn.count('articles.analysed_at').as('analysed'),
      db.fn.max('articles.published_at').as('newest'),
    ])
    .where('sources.user_id', '=', userId)
    .groupBy('articles.source_id')
    .execute();

  return new Map(
    rows.map((r) => [
      r.source_id,
      { total: Number(r.total), analysed: Number(r.analysed), newest: (r.newest as string | null) ?? null },
    ]),
  );
};

/** Articles scored against each focus — before any threshold is applied. */
const countScoredByFocus = async (db: Db, userId: string): Promise<Map<string, number>> => {
  const rows = await db
    .selectFrom('article_focuses')
    .innerJoin('focuses', 'focuses.id', 'article_focuses.focus_id')
    .select(['article_focuses.focus_id', db.fn.countAll().as('scored')])
    .where('focuses.user_id', '=', userId)
    .groupBy('article_focuses.focus_id')
    .execute();

  return new Map(rows.map((r) => [r.focus_id, Number(r.scored)]));
};

/**
 * Focus-scoped vote counts. Vote signal ramps in with volume, so the count is
 * what tells a caller whether a focus has been curated or is running purely on
 * topic similarity.
 */
const countVotesByFocus = async (db: Db, userId: string): Promise<Map<string, { up: number; down: number }>> => {
  const rows = await db
    .selectFrom('article_votes')
    .select(['focus_id', 'value', db.fn.countAll().as('count')])
    .where('user_id', '=', userId)
    .where('focus_id', 'is not', null)
    .groupBy(['focus_id', 'value'])
    .execute();

  const byFocus = new Map<string, { up: number; down: number }>();
  for (const row of rows) {
    const focusId = row.focus_id as string;
    const entry = byFocus.get(focusId) ?? { up: 0, down: 0 };
    if (row.value === 1) {
      entry.up = Number(row.count);
    } else {
      entry.down = Number(row.count);
    }
    byFocus.set(focusId, entry);
  }
  return byFocus;
};

type IssueSummary = { id: string; title: string; articleCount: number; readingMinutes: number | null; at: string };

/**
 * The most recent issues per config. Fetched in one query over all configs and
 * bucketed in memory — a per-config query would be N round trips for a handful
 * of rows each.
 */
const recentIssuesByConfig = async (db: Db, configIds: string[]): Promise<Map<string, IssueSummary[]>> => {
  const byConfig = new Map<string, IssueSummary[]>();
  if (configIds.length === 0) {
    return byConfig;
  }

  const rows = await db
    .selectFrom('editions')
    .select(['edition_config_id', 'id', 'title', 'article_count', 'total_reading_minutes', 'published_at'])
    .where('edition_config_id', 'in', configIds)
    .orderBy('published_at', 'desc')
    .limit(configIds.length * LIMITS.workspaceIssues)
    .execute();

  for (const row of rows) {
    const list = byConfig.get(row.edition_config_id) ?? [];
    if (list.length < LIMITS.workspaceIssues) {
      list.push({
        id: row.id,
        title: row.title,
        articleCount: row.article_count,
        readingMinutes: row.total_reading_minutes,
        at: row.published_at,
      });
    }
    byConfig.set(row.edition_config_id, list);
  }

  return byConfig;
};

const getWorkspace = defineTool({
  name: 'get_workspace',
  title: 'Get the whole workspace',
  description: [
    'The orientation call — start here. Returns every source, focus and edition config this user has,',
    'with article counts, focus match counts, recent issues and the current analysis readiness.',
    '',
    'One call replaces listing each of those separately. It is bounded by what the user has built by',
    'hand, so it stays small no matter how many articles exist.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {},
  handler: async (_args, ctx) => {
    const db = await ctx.services.get(DatabaseService).getInstance();
    const [sources, focuses, configs, weights] = await Promise.all([
      ctx.services.get(SourcesService).list(ctx.userId),
      ctx.services.get(FocusesService).list(ctx.userId),
      ctx.services.get(EditionsService).listConfigs(ctx.userId),
      ctx.services.get(VotesService).loadUserScoringWeights(ctx.userId),
    ]);

    const [countsBySource, scoredByFocus, votesByFocus, issuesByConfig] = await Promise.all([
      countArticlesBySource(db, ctx.userId),
      countScoredByFocus(db, ctx.userId),
      countVotesByFocus(db, ctx.userId),
      recentIssuesByConfig(
        db,
        configs.map((c) => c.id),
      ),
    ]);

    return {
      sources: capList(
        sources.items.map((source) => {
          const counts = countsBySource.get(source.id);
          return {
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url,
            articles: counts?.total ?? 0,
            analysed: counts?.analysed ?? 0,
            newestArticleAt: counts?.newest ?? null,
            lastFetchedAt: source.lastFetchedAt,
            fetchError: source.fetchError,
          };
        }),
        LIMITS.workspaceSources,
      ),
      focuses: focuses.map((focus) => ({
        id: focus.id,
        name: focus.name,
        description: truncate(focus.description, LIMITS.summaryChars),
        minConfidence: focus.minConfidence,
        minConsumptionTimeSeconds: focus.minConsumptionTimeSeconds,
        maxConsumptionTimeSeconds: focus.maxConsumptionTimeSeconds,
        linkedSources: focus.sources.length,
        // Articles scored against this focus at all — call preview_focus for the
        // count that actually clears the threshold.
        scoredArticles: scoredByFocus.get(focus.id) ?? 0,
        votes: votesByFocus.get(focus.id) ?? { up: 0, down: 0 },
      })),
      editionConfigs: configs.map((config) => ({
        id: config.id,
        name: config.name,
        schedule: config.schedule,
        lookbackHours: config.lookbackHours,
        excludePriorEditions: config.excludePriorEditions,
        enabled: config.enabled,
        focuses: config.focuses.map((f) => ({
          focusId: f.focusId,
          focusName: f.focusName,
          position: f.position,
          budgetType: f.budgetType,
          budgetValue: f.budgetValue,
        })),
        recentIssues: issuesByConfig.get(config.id) ?? [],
      })),
      scoringWeights: weights,
      readiness: await readinessFor(ctx),
    };
  },
});

// --- wait_until_ready ---

const waitUntilReady = defineTool({
  name: 'wait_until_ready',
  title: 'Wait for analysis to settle',
  description: [
    'Block until the given sources and focuses have finished analysis, or until waitSeconds elapses.',
    'Returns the readiness state either way — it does not fail on timeout.',
    '',
    'Use this whenever a previous tool returned state "analysing"; counts taken before that are',
    'provisional. It returns immediately on state "stalled", which means articles remain unanalysed',
    'with no job running — usually extraction failing on dead links. Do NOT retry a stalled scope in a',
    'loop; nothing will change. Proceed, or call refresh_sources to retry those articles.',
    '',
    'Scope it to the sources or focuses you care about; leaving both empty waits on everything the',
    'user owns, which can take much longer.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    sourceIds: z.array(z.string()).default([]),
    focusIds: z.array(z.string()).default([]),
    waitSeconds: z.number().int().min(0).max(120).default(60),
  },
  handler: async ({ sourceIds, focusIds, waitSeconds }, ctx) => {
    const readiness = await waitForReadiness(ctx, { sourceIds, focusIds }, waitSeconds);
    return {
      readiness,
      // Only `analysing` means the budget actually ran out — `stalled` returns
      // early on purpose, so reporting it as a timeout would invite a retry.
      timedOut: readiness.state === 'analysing',
      nextStep: readinessAdvice(readiness, 'Everything in scope is analysed. Previews are now trustworthy.'),
    };
  },
});

// --- get_article ---

const getArticle = defineTool({
  name: 'get_article',
  title: 'Get one article',
  description: [
    'Fetch a single article’s metadata, and its body text when includeContent is true.',
    '',
    'This is the ONLY tool that returns article body text, deliberately: bodies are large and reading',
    'many of them will exhaust your context without improving your decisions. To understand what a',
    'source publishes use profile_source, and to judge a focus use preview_focus — both give you',
    'titles and statistics at a fraction of the cost. Reach for this only when a specific article’s',
    'classification is puzzling and the title alone does not explain it.',
  ].join(' '),
  scope: 'read',
  readOnly: true,
  inputSchema: {
    articleId: z.string(),
    includeContent: z
      .boolean()
      .default(false)
      .describe(`Include body text, truncated to ${LIMITS.articleContentChars} characters.`),
  },
  handler: async ({ articleId, includeContent }, ctx) => {
    const article = await ctx.services.get(SourcesService).getArticle(ctx.userId, articleId);

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      author: article.author,
      summary: truncate(article.summary, LIMITS.summaryChars),
      sourceId: article.sourceId,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      consumptionTimeSeconds: article.consumptionTimeSeconds,
      readAt: article.readAt,
      analysed: article.extractedAt !== null,
      content: includeContent ? truncate(article.content, LIMITS.articleContentChars) : null,
    };
  },
});

// --- delete_entity ---

const DELETABLE = ['source', 'focus', 'edition_config', 'issue'] as const;

const deleteEntity = defineTool({
  name: 'delete_entity',
  title: 'Delete a source, focus, edition config or issue',
  description: [
    'Permanently delete one entity. Deleting a source also deletes its articles; deleting a focus also',
    'deletes its classifications; deleting an edition config also deletes its issues. None of this is',
    'recoverable.',
    '',
    'Requires an admin-scoped API key and an explicit confirm: true. Confirm with the user in your own',
    'conversation before calling this — the key’s scope authorises the action, it does not indicate the',
    'user asked for this particular deletion.',
  ].join(' '),
  scope: 'admin',
  readOnly: false,
  inputSchema: {
    type: z.enum(DELETABLE),
    id: z.string(),
    confirm: z.literal(true).describe('Must be true. Guards against an accidental call.'),
  },
  handler: async ({ type, id }, ctx) => {
    switch (type) {
      case 'source': {
        const source = await ctx.services.get(SourcesService).get(ctx.userId, id);
        if (source.type === 'bookmarks') {
          throw new Error('The built-in bookmarks source cannot be deleted');
        }
        await ctx.services.get(SourcesService).delete(ctx.userId, id);
        break;
      }
      case 'focus':
        await ctx.services.get(FocusesService).delete(ctx.userId, id);
        break;
      case 'edition_config':
        await ctx.services.get(EditionsService).deleteConfig(ctx.userId, id);
        break;
      case 'issue':
        await ctx.services.get(EditionsService).deleteEdition(ctx.userId, id);
        break;
    }

    return { deleted: { type, id } };
  },
});

// --- Exports ---

const workspaceTools: McpTool[] = [getWorkspace, waitUntilReady, getArticle, deleteEntity];

export { workspaceTools };
