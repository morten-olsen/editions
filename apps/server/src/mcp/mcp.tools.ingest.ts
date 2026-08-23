import { z } from 'zod/v4';

import { DatabaseService } from '../database/database.ts';
import { DiscoveryService } from '../discovery/discovery.ts';
import { JobService } from '../jobs/jobs.ts';
import type { Services } from '../services/services.ts';
import { SourcesService } from '../sources/sources.ts';

import { LIMITS } from './mcp.budget.ts';
import { normalizeUrl } from './mcp.feeds.ts';
import { defineTool, waitForReadiness, waitSecondsSchema } from './mcp.tools.ts';
import type { McpTool } from './mcp.tools.ts';

/**
 * The tools that put articles into the system. Split from the read-only source
 * tools because these are the ones that own the readiness contract: they start
 * asynchronous work and are responsible for reporting honestly on whether it
 * finished.
 */

// --- add_sources ---

type AddedSource = {
  url: string;
  sourceId: string | null;
  name: string | null;
  state: 'ready' | 'analysing' | 'failed' | 'already_present';
  articles: number;
  error: string | null;
};

/**
 * Fills in each new source's article count and fetch error after the wait.
 *
 * A feed that fails to fetch records the reason on its own row rather than
 * throwing out of the job, so re-reading the rows afterwards is the only way the
 * outcome becomes visible to the caller.
 */
const settleAddedSources = async ({
  services,
  userId,
  results,
}: {
  services: Services;
  userId: string;
  results: AddedSource[];
}): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();
  const ids = results.map((r) => r.sourceId).filter((id): id is string => id !== null);
  if (ids.length === 0) {
    return;
  }

  const rows = await db
    .selectFrom('sources')
    .leftJoin('articles', 'articles.source_id', 'sources.id')
    .select([
      'sources.id',
      'sources.fetch_error',
      'sources.last_fetched_at',
      db.fn.count('articles.id').as('article_count'),
      db.fn.count('articles.analysed_at').as('analysed_count'),
    ])
    .where('sources.id', 'in', ids)
    .where('sources.user_id', '=', userId)
    .groupBy(['sources.id', 'sources.fetch_error', 'sources.last_fetched_at'])
    .execute();

  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const result of results) {
    if (result.sourceId === null || result.state === 'already_present') {
      continue;
    }
    const row = byId.get(result.sourceId);
    if (!row) {
      continue;
    }

    result.articles = Number(row.article_count);
    if (row.fetch_error !== null) {
      result.state = 'failed';
      result.error = row.fetch_error;
    } else if (row.last_fetched_at !== null && Number(row.analysed_count) === Number(row.article_count)) {
      result.state = 'ready';
    }
  }
};

const addSources = defineTool({
  name: 'add_sources',
  title: 'Add sources and wait for them to be usable',
  description: [
    'Add feeds and run them all the way through the pipeline: fetch, extract, embed and classify',
    'against every existing focus. Waits up to waitSeconds for that to finish, then reports per-source',
    'state.',
    '',
    'A source with state "analysing" is NOT yet usable — its articles will not appear in preview_focus',
    'or preview_edition until analysis completes. Call wait_until_ready before drawing conclusions',
    'from any preview. URLs already present are reported as "already_present" and are not duplicated.',
    '',
    'Probe unfamiliar URLs with inspect_feed first; a feed that fails there will fail here too, only',
    'slower.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    sources: z
      .array(
        z.object({
          url: z.url().describe('Feed URL.'),
          name: z.string().optional().describe('Display name. Defaults to the URL host.'),
          type: z.enum(['rss', 'podcast']).default('rss'),
        }),
      )
      .min(1)
      .max(LIMITS.addSources),
    waitSeconds: waitSecondsSchema,
  },
  handler: async ({ sources, waitSeconds }, ctx) => {
    const sourcesService = ctx.services.get(SourcesService);
    const jobs = ctx.services.get(JobService);

    const existing = await sourcesService.list(ctx.userId);
    const existingByUrl = new Map(existing.items.map((s) => [normalizeUrl(s.url), s]));

    const results: AddedSource[] = [];
    const createdIds: string[] = [];

    for (const input of sources) {
      const already = existingByUrl.get(normalizeUrl(input.url));
      if (already) {
        results.push({
          url: input.url,
          sourceId: already.id,
          name: already.name,
          state: 'already_present',
          articles: 0,
          error: null,
        });
        continue;
      }

      const name = input.name ?? new URL(input.url).host;
      const created = await sourcesService.create({
        userId: ctx.userId,
        name,
        url: input.url,
        type: input.type,
      });
      // Record it immediately, so a duplicate inside this same batch is caught too.
      existingByUrl.set(normalizeUrl(input.url), created);
      createdIds.push(created.id);

      jobs.enqueue(
        'refresh_source',
        { sourceId: created.id, userId: ctx.userId },
        { userId: ctx.userId, affects: { sourceIds: [created.id] } },
      );

      results.push({ url: input.url, sourceId: created.id, name, state: 'analysing', articles: 0, error: null });
    }

    const readiness = await waitForReadiness(ctx, { sourceIds: createdIds }, createdIds.length > 0 ? waitSeconds : 0);
    await settleAddedSources({ services: ctx.services, userId: ctx.userId, results });

    return {
      sources: results,
      readiness,
      nextStep:
        readiness.state === 'ready'
          ? 'Sources are analysed. Use profile_source to see what each publishes, then save_focus.'
          : 'Analysis is still running. Call wait_until_ready before trusting any preview.',
    };
  },
});

// --- adopt_from_catalog ---

const adoptFromCatalog = defineTool({
  name: 'adopt_from_catalog',
  title: 'Adopt catalog entries',
  description: [
    'Copy catalog entries into this user’s workspace. Adopting a focus also adopts its sources;',
    'adopting an edition config also adopts its focuses and their sources. Already-adopted entries',
    'are skipped rather than duplicated. Waits for the resulting analysis like add_sources does.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    sourceIds: z.array(z.string()).default([]).describe('Catalog source ids.'),
    focusIds: z.array(z.string()).default([]).describe('Catalog focus ids.'),
    editionConfigIds: z.array(z.string()).default([]).describe('Catalog edition config ids.'),
    waitSeconds: waitSecondsSchema,
  },
  handler: async ({ sourceIds, focusIds, editionConfigIds, waitSeconds }, ctx) => {
    const discovery = ctx.services.get(DiscoveryService);

    // Sequential, not parallel: adopts cascade and dedupe against rows the
    // previous adopt may have just created.
    const adoptedSources = [];
    for (const id of sourceIds) {
      adoptedSources.push({ catalogId: id, ...(await discovery.adoptSource(ctx.userId, id)) });
    }

    const adoptedFocuses = [];
    for (const id of focusIds) {
      adoptedFocuses.push({ catalogId: id, ...(await discovery.adoptFocus(ctx.userId, id)) });
    }

    const adoptedEditionConfigs = [];
    for (const id of editionConfigIds) {
      adoptedEditionConfigs.push({ catalogId: id, ...(await discovery.adoptEditionConfig(ctx.userId, id)) });
    }

    const touchedFocusIds = adoptedFocuses.map((f) => f.focusId);
    const touchedSourceIds = adoptedSources.map((s) => s.sourceId);
    const anythingAdopted = touchedFocusIds.length + touchedSourceIds.length + adoptedEditionConfigs.length > 0;

    const readiness = await waitForReadiness(
      ctx,
      { sourceIds: touchedSourceIds, focusIds: touchedFocusIds },
      anythingAdopted ? waitSeconds : 0,
    );

    return { adoptedSources, adoptedFocuses, adoptedEditionConfigs, readiness };
  },
});

// --- refresh_sources ---

const refreshSources = defineTool({
  name: 'refresh_sources',
  title: 'Re-fetch sources',
  description: [
    'Pull new articles for the given sources (or every source when none are named) and analyse them.',
    'Use when a source looks stale or was added before a focus existed.',
  ].join(' '),
  scope: 'write',
  readOnly: false,
  inputSchema: {
    sourceIds: z.array(z.string()).default([]).describe('Sources to refresh. Empty means all of them.'),
    waitSeconds: waitSecondsSchema,
  },
  handler: async ({ sourceIds, waitSeconds }, ctx) => {
    const sourcesService = ctx.services.get(SourcesService);
    const jobs = ctx.services.get(JobService);

    const all = await sourcesService.list(ctx.userId);
    // The bookmarks source has no feed to fetch.
    const targets = all.items.filter(
      (s) => s.type !== 'bookmarks' && (sourceIds.length === 0 || sourceIds.includes(s.id)),
    );

    for (const source of targets) {
      jobs.enqueue(
        'refresh_source',
        { sourceId: source.id, userId: ctx.userId },
        { userId: ctx.userId, affects: { sourceIds: [source.id] } },
      );
    }

    const ids = targets.map((s) => s.id);
    return {
      refreshed: ids.length,
      sourceIds: ids,
      readiness: await waitForReadiness(ctx, { sourceIds: ids }, ids.length > 0 ? waitSeconds : 0),
    };
  },
});

// --- Exports ---

const ingestTools: McpTool[] = [addSources, adoptFromCatalog, refreshSources];

export type { AddedSource };
export { ingestTools };
