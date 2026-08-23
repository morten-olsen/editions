import crypto from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';

import type { ApiKeyScope } from '../api-keys/api-keys.ts';
import type { DatabaseSchema } from '../database/database.types.ts';
import { JobService } from '../jobs/jobs.ts';
import { createTestApp } from '../test-helpers.ts';
import type { TestContext } from '../test-helpers.ts';

import { allTools, toolRegistry } from './mcp.ts';
import type { ToolContext } from './mcp.tools.ts';

let t: TestContext;
let userId: string;

/**
 * The analysis pipeline spawns a real worker that downloads a ~33MB model, so
 * these tests stub the queue and seed already-analysed rows instead. That keeps
 * the run hermetic while still exercising the readiness logic, which reads the
 * same job list this fake feeds.
 */
type FakeJobs = { enqueued: { type: string; payload: unknown }[] };

const stubJobs = (): FakeJobs => {
  const enqueued: { type: string; payload: unknown }[] = [];
  t.services.set(JobService, {
    enqueue: ((type: string, payload: unknown) => {
      enqueued.push({ type, payload });
      return { id: crypto.randomUUID(), type, status: 'pending' };
    }) as never,
    listByUser: (() => []) as never,
    register: (() => undefined) as never,
    get: (() => undefined) as never,
  });
  return { enqueued };
};

const ctxFor = (scope: ApiKeyScope): ToolContext => ({ services: t.services, userId, scope });

const call = async (name: string, args: unknown = {}, scope: ApiKeyScope = 'admin'): Promise<never> =>
  (await toolRegistry.call({ name, args, ctx: ctxFor(scope) })) as never;

// --- Seeding ---

type SeedArticle = {
  title: string;
  confidence?: number;
  publishedAt?: string;
  consumptionTimeSeconds?: number;
  analysed?: boolean;
  content?: string;
};

const seedSource = async (db: Kysely<DatabaseSchema>, name: string, url: string): Promise<string> => {
  const id = crypto.randomUUID();
  await db
    .insertInto('sources')
    .values({
      id,
      user_id: userId,
      type: 'rss',
      name,
      url,
      config: '{}',
      direction: 'newest',
      last_fetched_at: new Date().toISOString(),
    })
    .execute();
  return id;
};

const seedArticles = async (
  db: Kysely<DatabaseSchema>,
  { sourceId, focusId, articles }: { sourceId: string; focusId?: string; articles: SeedArticle[] },
): Promise<string[]> => {
  const ids: string[] = [];

  for (const [index, article] of articles.entries()) {
    const id = crypto.randomUUID();
    ids.push(id);
    const analysed = article.analysed ?? true;

    await db
      .insertInto('articles')
      .values({
        id,
        source_id: sourceId,
        external_id: `${sourceId}-${index}`,
        url: `https://example.com/${index}`,
        title: article.title,
        summary: `Summary of ${article.title}`,
        content: article.content ?? null,
        consumption_time_seconds: article.consumptionTimeSeconds ?? 300,
        published_at: article.publishedAt ?? new Date().toISOString(),
        extracted_at: new Date().toISOString(),
        analysed_at: analysed ? new Date().toISOString() : null,
      })
      .execute();

    if (focusId !== undefined && article.confidence !== undefined) {
      await db
        .insertInto('article_focuses')
        .values({ article_id: id, focus_id: focusId, similarity: article.confidence, nli: null })
        .execute();
    }
  }

  return ids;
};

const seedFocus = async (
  db: Kysely<DatabaseSchema>,
  { name, minConfidence, sourceIds }: { name: string; minConfidence: number; sourceIds: string[] },
): Promise<string> => {
  const id = crypto.randomUUID();
  await db
    .insertInto('focuses')
    .values({ id, user_id: userId, name, description: `About ${name}`, min_confidence: minConfidence })
    .execute();

  for (const sourceId of sourceIds) {
    await db.insertInto('focus_sources').values({ focus_id: id, source_id: sourceId, weight: 1 }).execute();
  }

  return id;
};

beforeEach(async () => {
  t = await createTestApp();
  const registered = await t.register();
  userId = registered.id;
});

afterEach(async () => {
  await t.stop();
});

// --- Registry contract ---

describe('tool registry', () => {
  it('exposes tools cumulatively by scope', () => {
    const read = toolRegistry.listForScope('read').map((tool) => tool.name);
    const write = toolRegistry.listForScope('write').map((tool) => tool.name);
    const admin = toolRegistry.listForScope('admin').map((tool) => tool.name);

    expect(read).toContain('get_workspace');
    expect(read).not.toContain('add_sources');
    expect(read).not.toContain('delete_entity');

    expect(write).toEqual(expect.arrayContaining([...read, 'add_sources', 'save_focus']));
    expect(write).not.toContain('delete_entity');

    expect(admin).toEqual(expect.arrayContaining([...write, 'delete_entity']));
    expect(admin).toHaveLength(allTools.length);
  });

  it('refuses a tool above the key’s scope', async () => {
    await expect(toolRegistry.call({ name: 'add_sources', args: {}, ctx: ctxFor('read') })).rejects.toThrow(
      /requires an API key with "write" scope/,
    );
    await expect(toolRegistry.call({ name: 'delete_entity', args: {}, ctx: ctxFor('write') })).rejects.toThrow(
      /requires an API key with "admin" scope/,
    );
  });

  it('rejects an unknown tool', async () => {
    await expect(toolRegistry.call({ name: 'nope', args: {}, ctx: ctxFor('admin') })).rejects.toThrow(/Unknown tool/);
  });

  it('validates arguments before running', async () => {
    await expect(call('get_article', { articleId: 42 })).rejects.toThrow();
    await expect(call('preview_focus', {})).rejects.toThrow();
  });

  it('marks read-only tools accurately', () => {
    const readOnly = allTools.filter((tool) => tool.readOnly).map((tool) => tool.name);
    const mutating = allTools.filter((tool) => !tool.readOnly).map((tool) => tool.name);

    expect(readOnly).toEqual(
      expect.arrayContaining(['get_workspace', 'preview_focus', 'preview_edition', 'inspect_feed']),
    );
    expect(mutating).toEqual(
      expect.arrayContaining(['add_sources', 'save_focus', 'generate_edition', 'delete_entity']),
    );
  });

  it('describes every tool and keeps names stable', () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.title.length).toBeGreaterThan(0);
    }
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(allTools.length);
  });
});

// --- Context budgeting ---

describe('context budgeting', () => {
  it('never returns article content except from get_article', async () => {
    const db = await t.db();
    const secret = 'FULL BODY TEXT THAT MUST NOT LEAK';
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    const [articleId] = await seedArticles(db, {
      sourceId,
      focusId,
      articles: [{ title: 'A story', confidence: 0.9, content: secret }],
    });

    const configId = crypto.randomUUID();
    await db
      .insertInto('edition_configs')
      .values({
        id: configId,
        user_id: userId,
        name: 'Daily',
        schedule: '0 7 * * *',
        lookback_hours: 48,
        exclude_prior_editions: 0,
        enabled: 1,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({
        edition_config_id: configId,
        focus_id: focusId,
        position: 0,
        budget_type: 'count',
        budget_value: 5,
        weight: 1,
      })
      .execute();

    const responses = await Promise.all([
      call('get_workspace'),
      call('profile_source', { sourceId }),
      call('preview_focus', { focusId }),
      call('preview_edition', { editionConfigId: configId }),
      call('get_article', { articleId }),
    ]);

    for (const response of responses) {
      expect(JSON.stringify(response)).not.toContain(secret);
    }

    const withContent = await call('get_article', { articleId, includeContent: true });
    expect(JSON.stringify(withContent)).toContain(secret);
  });

  it('truncates article content and marks the cut', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const [articleId] = await seedArticles(db, {
      sourceId,
      articles: [{ title: 'Long read', content: 'x'.repeat(10_000) }],
    });

    const result = await call('get_article', { articleId, includeContent: true });
    const content = (result as unknown as { content: string }).content;

    expect(content).toContain('[truncated, 10000 chars total]');
    expect(content.length).toBeLessThan(4200);
  });

  /**
   * The point of the sampling design is that responses stay flat as the corpus
   * grows. Asserting a byte ceiling against a deliberately large workspace is
   * what stops a future field addition from quietly reintroducing a full dump.
   */
  it('keeps responses bounded as the corpus grows', async () => {
    const db = await t.db();
    const sourceIds = await Promise.all(
      Array.from({ length: 12 }, (_, i) => seedSource(db, `Source ${i}`, `https://s${i}.example/feed.xml`)),
    );
    const focusId = await seedFocus(db, { name: 'Everything', minConfidence: 0.2, sourceIds });

    for (const sourceId of sourceIds) {
      await seedArticles(db, {
        sourceId,
        focusId,
        articles: Array.from({ length: 60 }, (_, i) => ({
          title: `A reasonably long article headline number ${i} about some topic`,
          confidence: 0.2 + (i % 8) / 10,
          content: 'body '.repeat(500),
        })),
      });
    }

    const configId = crypto.randomUUID();
    await db
      .insertInto('edition_configs')
      .values({
        id: configId,
        user_id: userId,
        name: 'Daily',
        schedule: '0 7 * * *',
        lookback_hours: 48,
        exclude_prior_editions: 0,
        enabled: 1,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({
        edition_config_id: configId,
        focus_id: focusId,
        position: 0,
        budget_type: 'count',
        budget_value: 200,
        weight: 1,
      })
      .execute();

    const sizes = await Promise.all(
      (
        [
          ['get_workspace', {}],
          ['profile_source', { sourceId: sourceIds[0] }],
          ['preview_focus', { focusId }],
          ['preview_edition', { editionConfigId: configId }],
        ] as const
      ).map(async ([name, args]) => [name, JSON.stringify(await call(name, args)).length] as const),
    );

    for (const [name, chars] of sizes) {
      // Measured at ~1.3k–5.3k chars for this workspace; 24k (~6k tokens) leaves
      // room for new fields while still failing loudly on an unbounded list.
      expect(chars, `${name} returned ${chars} chars for 720 articles`).toBeLessThan(24_000);
    }
  });

  it('reports the true total when a list is capped', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Busy', 'https://busy.example/feed.xml');
    const focusId = await seedFocus(db, { name: 'Everything', minConfidence: 0, sourceIds: [sourceId] });
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: Array.from({ length: 40 }, (_, i) => ({ title: `Story ${i}`, confidence: 0.8 })),
    });

    const result = await call('preview_focus', { focusId, sampleSize: 5 });
    const preview = result as unknown as { matchCount: number; topMatches: unknown[] };

    expect(preview.matchCount).toBe(40);
    expect(preview.topMatches).toHaveLength(5);
  });
});

// --- Readiness ---

describe('readiness reporting', () => {
  const READINESS_TOOLS = ['get_workspace', 'profile_source', 'preview_focus', 'preview_edition'];

  it('attaches readiness to every tool that returns analysed data', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    await seedArticles(db, { sourceId, focusId, articles: [{ title: 'A story', confidence: 0.9 }] });

    const configId = crypto.randomUUID();
    await db
      .insertInto('edition_configs')
      .values({
        id: configId,
        user_id: userId,
        name: 'Daily',
        schedule: '0 7 * * *',
        lookback_hours: 48,
        exclude_prior_editions: 0,
        enabled: 1,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({
        edition_config_id: configId,
        focus_id: focusId,
        position: 0,
        budget_type: 'count',
        budget_value: 5,
        weight: 1,
      })
      .execute();

    const args: Record<string, unknown> = {
      get_workspace: {},
      profile_source: { sourceId },
      preview_focus: { focusId },
      preview_edition: { editionConfigId: configId },
    };

    for (const name of READINESS_TOOLS) {
      const result = (await call(name, args[name])) as unknown as { readiness?: { state: string } };
      expect(result.readiness, `${name} must report readiness`).toBeDefined();
      expect(result.readiness?.state).toBe('ready');
    }
  });

  it('reports analysing while a job is in flight', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    await seedArticles(db, {
      sourceId,
      articles: [
        { title: 'Done', analysed: true },
        { title: 'Pending', analysed: false },
        { title: 'Also pending', analysed: false },
      ],
    });

    // A running job is what distinguishes "in flight" from "stuck".
    t.services.set(JobService, {
      enqueue: (() => ({ id: 'j', status: 'pending' })) as never,
      listByUser: (() => [{ id: 'j', status: 'running', affects: { sourceIds: [], focusIds: [] } }]) as never,
      register: (() => undefined) as never,
      get: (() => undefined) as never,
    });

    const result = (await call('get_workspace')) as unknown as {
      readiness: { state: string; analysed: number; pending: number; pendingSources: { name: string }[] };
    };

    expect(result.readiness.state).toBe('analysing');
    expect(result.readiness.analysed).toBe(1);
    expect(result.readiness.pending).toBe(2);
    expect(result.readiness.pendingSources[0]?.name).toBe('Example');
  });

  /**
   * Extraction fails permanently on some URLs, the job completes, and those
   * articles stay unanalysed. Reported as "analysing" this would make every
   * wait loop run to its full budget forever.
   */
  it('reports stalled when articles are unanalysed but nothing is running', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    stubJobs(); // listByUser returns no active jobs
    await seedArticles(db, {
      sourceId,
      articles: [
        { title: 'Done', analysed: true },
        { title: 'Never extracted', analysed: false },
      ],
    });

    const result = (await call('get_workspace')) as unknown as {
      readiness: { state: string; pending: number; activeJobs: number };
    };

    expect(result.readiness.state).toBe('stalled');
    expect(result.readiness.pending).toBe(1);
    expect(result.readiness.activeJobs).toBe(0);
  });

  it('does not wait on a stalled scope', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    stubJobs();
    await seedArticles(db, { sourceId, articles: [{ title: 'Never extracted', analysed: false }] });

    const started = Date.now();
    const result = (await call('wait_until_ready', { waitSeconds: 30 })) as unknown as {
      readiness: { state: string };
      timedOut: boolean;
      nextStep: string;
    };

    expect(result.readiness.state).toBe('stalled');
    expect(Date.now() - started).toBeLessThan(2000);
    // Not a timeout — reporting it as one would invite a pointless retry.
    expect(result.timedOut).toBe(false);
    expect(result.nextStep).toMatch(/waiting will not help/i);
  });

  /**
   * A focus whose articles are analysed but unscored against it. The
   * article-level counts look clean, so per-focus classification coverage is
   * the only thing that reveals the focus is not usable yet.
   */
  it('detects unscored articles that the article-level counts miss', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'New topic', minConfidence: 0.3, sourceIds: [sourceId] });
    await seedArticles(db, { sourceId, articles: [{ title: 'Unscored' }, { title: 'Also unscored' }] });

    // Unscoped, every article is analysed — nothing to report.
    const workspace = (await call('get_workspace')) as unknown as { readiness: { state: string } };
    expect(workspace.readiness.state).toBe('ready');

    // Scoped to the focus, two articles are missing a score. With no job to
    // produce them this is stalled, not in flight.
    const stalled = (await call('preview_focus', { focusId })) as unknown as {
      readiness: { state: string; pendingClassification: number };
    };
    expect(stalled.readiness.state).toBe('stalled');
    expect(stalled.readiness.pendingClassification).toBe(2);

    // With the reconcile job running — what save_focus actually produces — the
    // same shortfall is in flight and worth waiting on.
    t.services.set(JobService, {
      enqueue: (() => ({ id: 'j', status: 'pending' })) as never,
      listByUser: (() => [{ id: 'j', status: 'running', affects: { sourceIds: [], focusIds: [focusId] } }]) as never,
      register: (() => undefined) as never,
      get: (() => undefined) as never,
    });

    const running = (await call('preview_focus', { focusId })) as unknown as {
      readiness: { state: string; pendingClassification: number };
    };
    expect(running.readiness.state).toBe('analysing');
    expect(running.readiness.pendingClassification).toBe(2);
  });

  it('returns without waiting when nothing is outstanding', async () => {
    const started = Date.now();
    const result = (await call('wait_until_ready', { waitSeconds: 30 })) as unknown as {
      readiness: { state: string };
      timedOut: boolean;
    };

    expect(result.readiness.state).toBe('ready');
    expect(result.timedOut).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

// --- Focus tuning ---

describe('preview_focus', () => {
  it('separates matches from near-misses at the threshold', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.5, sourceIds: [sourceId] });
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: [
        { title: 'Strong match', confidence: 0.85 },
        { title: 'Weak match', confidence: 0.55 },
        { title: 'Near miss', confidence: 0.45 },
        { title: 'Far miss', confidence: 0.05 },
      ],
    });

    const result = (await call('preview_focus', { focusId })) as unknown as {
      matchCount: number;
      scoredCount: number;
      topMatches: { title: string; confidence: number }[];
      nearMisses: { title: string; confidence: number }[];
      confidenceHistogram: { from: number; count: number }[];
    };

    expect(result.matchCount).toBe(2);
    expect(result.scoredCount).toBe(4);
    expect(result.topMatches.map((a) => a.title)).toEqual(['Strong match', 'Weak match']);
    // Near-misses are ordered by how close they came — the actionable one first.
    expect(result.nearMisses.map((a) => a.title)).toEqual(['Near miss', 'Far miss']);
    expect(result.confidenceHistogram.find((b) => b.from === 0.8)?.count).toBe(1);
  });

  it('applies an unsaved threshold override without persisting it', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.5, sourceIds: [sourceId] });
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: [
        { title: 'Strong', confidence: 0.85 },
        { title: 'Near miss', confidence: 0.45 },
      ],
    });

    const loosened = (await call('preview_focus', { focusId, minConfidence: 0.4 })) as unknown as {
      matchCount: number;
      applied: { minConfidence: number; overridesApplied: boolean };
    };
    expect(loosened.matchCount).toBe(2);
    expect(loosened.applied.overridesApplied).toBe(true);

    const saved = await db
      .selectFrom('focuses')
      .select('min_confidence')
      .where('id', '=', focusId)
      .executeTakeFirstOrThrow();
    expect(saved.min_confidence).toBe(0.5);
  });

  it('counts articles cut by the reading-time bounds separately', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: [
        { title: 'Short', confidence: 0.9, consumptionTimeSeconds: 60 },
        { title: 'Long', confidence: 0.9, consumptionTimeSeconds: 3600 },
      ],
    });

    const result = (await call('preview_focus', {
      focusId,
      maxConsumptionTimeSeconds: 600,
    })) as unknown as { matchCount: number; excludedByReadingTime: number };

    expect(result.matchCount).toBe(1);
    expect(result.excludedByReadingTime).toBe(1);
  });
});

// --- Editions ---

describe('preview_edition', () => {
  const seedEdition = async (
    db: Kysely<DatabaseSchema>,
    { focusId, budgetValue, lookbackHours }: { focusId: string; budgetValue: number; lookbackHours: number },
  ): Promise<string> => {
    const configId = crypto.randomUUID();
    await db
      .insertInto('edition_configs')
      .values({
        id: configId,
        user_id: userId,
        name: 'Daily',
        schedule: '0 7 * * *',
        lookback_hours: lookbackHours,
        exclude_prior_editions: 0,
        enabled: 1,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({
        edition_config_id: configId,
        focus_id: focusId,
        position: 0,
        budget_type: 'count',
        budget_value: budgetValue,
        weight: 1,
      })
      .execute();
    return configId;
  };

  it('diagnoses a section that cannot fill its budget', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    await seedArticles(db, { sourceId, focusId, articles: [{ title: 'Only story', confidence: 0.9 }] });

    const configId = await seedEdition(db, { focusId, budgetValue: 10, lookbackHours: 48 });
    const result = (await call('preview_edition', { editionConfigId: configId })) as unknown as {
      sections: { shortfall: { missing: number; candidatePoolInWindow: number; likelyCause: string } | null }[];
    };

    const shortfall = result.sections[0]?.shortfall;
    expect(shortfall).not.toBeNull();
    expect(shortfall?.missing).toBe(9);
    expect(shortfall?.candidatePoolInWindow).toBe(1);
    expect(shortfall?.likelyCause).toMatch(/widen lookbackHours|add sources/i);
  });

  it('reports no shortfall when the budget is met', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: Array.from({ length: 5 }, (_, i) => ({ title: `Story ${i}`, confidence: 0.9 })),
    });

    const configId = await seedEdition(db, { focusId, budgetValue: 2, lookbackHours: 48 });
    const result = (await call('preview_edition', { editionConfigId: configId })) as unknown as {
      sections: { shortfall: unknown; articles: number }[];
      totalArticles: number;
    };

    expect(result.sections[0]?.shortfall).toBeNull();
    expect(result.sections[0]?.articles).toBe(2);
  });

  it('blames the lookback window when matches exist but none are recent', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await seedArticles(db, {
      sourceId,
      focusId,
      articles: Array.from({ length: 5 }, (_, i) => ({ title: `Old ${i}`, confidence: 0.9, publishedAt: old })),
    });

    const configId = await seedEdition(db, { focusId, budgetValue: 3, lookbackHours: 24 });
    const result = (await call('preview_edition', { editionConfigId: configId })) as unknown as {
      sections: { shortfall: { candidatePoolInWindow: number; likelyCause: string } | null }[];
    };

    expect(result.sections[0]?.shortfall?.candidatePoolInWindow).toBe(0);
    expect(result.sections[0]?.shortfall?.likelyCause).toMatch(/matched nothing published in the last 24h/);
  });
});

// --- Writes ---

describe('write tools', () => {
  it('creates sources, skips duplicates and enqueues analysis', async () => {
    const db = await t.db();
    const jobs = stubJobs();
    await seedSource(db, 'Existing', 'https://example.com/feed.xml');

    const result = (await call(
      'add_sources',
      {
        sources: [
          { url: 'https://example.com/feed.xml', name: 'Duplicate' },
          { url: 'https://fresh.example/rss', name: 'Fresh' },
        ],
        waitSeconds: 0,
      },
      'write',
    )) as unknown as { sources: { url: string; state: string }[] };

    expect(result.sources.find((s) => s.url.includes('example.com'))?.state).toBe('already_present');
    expect(result.sources.find((s) => s.url.includes('fresh'))?.state).toBe('analysing');
    expect(jobs.enqueued).toHaveLength(1);
    expect(jobs.enqueued[0]?.type).toBe('refresh_source');
  });

  it('treats a trailing slash as the same source', async () => {
    const db = await t.db();
    stubJobs();
    await seedSource(db, 'Existing', 'https://example.com/feed.xml');

    const result = (await call(
      'add_sources',
      { sources: [{ url: 'https://Example.com/feed.xml/' }], waitSeconds: 0 },
      'write',
    )) as unknown as { sources: { state: string }[] };

    expect(result.sources[0]?.state).toBe('already_present');
  });

  it('creates and updates a focus', async () => {
    const db = await t.db();
    stubJobs();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');

    const created = (await call(
      'save_focus',
      {
        name: 'Space',
        description: 'Rockets, orbital missions and planetary science.',
        minConfidence: 0.4,
        sources: [{ sourceId, weight: 2, minConfidence: null }],
        waitSeconds: 0,
      },
      'write',
    )) as unknown as { focus: { id: string; minConfidence: number; sources: unknown[] }; created: boolean };

    expect(created.created).toBe(true);
    expect(created.focus.minConfidence).toBe(0.4);
    expect(created.focus.sources).toHaveLength(1);

    const updated = (await call(
      'save_focus',
      { focusId: created.focus.id, minConfidence: 0.6, waitSeconds: 0 },
      'write',
    )) as unknown as { focus: { minConfidence: number }; created: boolean };

    expect(updated.created).toBe(false);
    expect(updated.focus.minConfidence).toBe(0.6);
  });

  it('deletes only with admin scope and an explicit confirm', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');

    await expect(call('delete_entity', { type: 'source', id: sourceId }, 'admin')).rejects.toThrow();
    await expect(
      toolRegistry.call({
        name: 'delete_entity',
        args: { type: 'source', id: sourceId, confirm: true },
        ctx: ctxFor('write'),
      }),
    ).rejects.toThrow(/admin/);

    await call('delete_entity', { type: 'source', id: sourceId, confirm: true }, 'admin');

    const remaining = await db.selectFrom('sources').select('id').where('id', '=', sourceId).executeTakeFirst();
    expect(remaining).toBeUndefined();
  });

  it('refuses to delete the built-in bookmarks source', async () => {
    const db = await t.db();
    const id = crypto.randomUUID();
    await db
      .insertInto('sources')
      .values({
        id,
        user_id: userId,
        type: 'bookmarks',
        name: 'Saved Articles',
        url: 'bookmarks://saved',
        config: '{}',
        direction: 'newest',
      })
      .execute();

    await expect(call('delete_entity', { type: 'source', id, confirm: true }, 'admin')).rejects.toThrow(
      /bookmarks source cannot be deleted/,
    );
  });
});

// --- Create-vs-update id handling ---

/**
 * An agent reported that creating was impossible: "it requires a focus/edition
 * ID even when the ID is omitted, resulting in Focus not found". The cause was
 * `focusId: ""` — a model filling an optional string field routinely sends an
 * empty string or the literal "null" instead of omitting the key, and the
 * handler branched on `=== undefined`, so a blank id was read as an update.
 */
describe('optional ids on create-or-update tools', () => {
  const BLANK_FORMS: [label: string, value: unknown][] = [
    ['omitted', undefined],
    ['empty string', ''],
    ['whitespace', '   '],
    ['json null', null],
    ['literal "null"', 'null'],
    ['literal "undefined"', 'undefined'],
    ['literal "none"', 'none'],
    ['literal "N/A"', 'N/A'],
  ];

  for (const [label, value] of BLANK_FORMS) {
    it(`save_focus creates when focusId is ${label}`, async () => {
      stubJobs();
      const args: Record<string, unknown> = {
        name: `Space ${label}`,
        description: 'Rockets, orbital missions and planetary science.',
        waitSeconds: 0,
      };
      if (value !== undefined) {
        args.focusId = value;
      }

      const result = (await call('save_focus', args, 'write')) as unknown as {
        created: boolean;
        focus: { id: string };
      };

      expect(result.created).toBe(true);
      expect(result.focus.id).toBeTruthy();
    });

    it(`save_edition_config creates when editionConfigId is ${label}`, async () => {
      const args: Record<string, unknown> = { name: `Daily ${label}`, schedule: '0 7 * * *', lookbackHours: 24 };
      if (value !== undefined) {
        args.editionConfigId = value;
      }

      const result = (await call('save_edition_config', args, 'write')) as unknown as {
        created: boolean;
        editionConfig: { id: string };
      };

      expect(result.created).toBe(true);
      expect(result.editionConfig.id).toBeTruthy();
    });
  }

  it('still updates when a real id is given, and trims stray whitespace', async () => {
    stubJobs();
    const created = (await call(
      'save_focus',
      { name: 'Space', description: 'Rockets and telescopes.', waitSeconds: 0 },
      'write',
    )) as unknown as { focus: { id: string } };

    const updated = (await call(
      'save_focus',
      { focusId: `  ${created.focus.id}  `, minConfidence: 0.6, waitSeconds: 0 },
      'write',
    )) as unknown as { created: boolean; focus: { id: string; minConfidence: number } };

    expect(updated.created).toBe(false);
    expect(updated.focus.id).toBe(created.focus.id);
    expect(updated.focus.minConfidence).toBe(0.6);
  });

  it('tells the agent how to create when a genuinely wrong id is passed', async () => {
    stubJobs();
    await expect(call('save_focus', { focusId: 'no-such-focus', name: 'X', waitSeconds: 0 }, 'write')).rejects.toThrow(
      /call save_focus with no focusId/,
    );
    await expect(
      call('save_edition_config', { editionConfigId: 'no-such-config', name: 'X' }, 'write'),
    ).rejects.toThrow(/call save_edition_config with no editionConfigId/);
  });

  it('treats a blank focusId on vote_articles as a global vote', async () => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const [articleId] = await seedArticles(db, { sourceId, articles: [{ title: 'A story' }] });

    const result = (await call(
      'vote_articles',
      { focusId: '', votes: [{ articleId, value: 'up' }] },
      'write',
    )) as unknown as { scope: unknown; results: { action: string }[] };

    expect(result.scope).toBe('global');
    expect(result.results[0]?.action).toBe('voted');

    const rows = await db.selectFrom('article_votes').select('focus_id').where('user_id', '=', userId).execute();
    expect(rows).toEqual([{ focus_id: null }]);
  });
});

// --- Voting ---

describe('vote_articles', () => {
  const seedVotable = async (): Promise<{ focusId: string; articleIds: string[] }> => {
    const db = await t.db();
    const sourceId = await seedSource(db, 'Example', 'https://example.com/feed.xml');
    const focusId = await seedFocus(db, { name: 'Tech', minConfidence: 0.3, sourceIds: [sourceId] });
    const articleIds = await seedArticles(db, {
      sourceId,
      focusId,
      articles: [
        { title: 'First', confidence: 0.8 },
        { title: 'Second', confidence: 0.7 },
        { title: 'Third', confidence: 0.6 },
      ],
    });
    return { focusId, articleIds };
  };

  it('records a batch of focus-scoped votes', async () => {
    const { focusId, articleIds } = await seedVotable();

    const result = (await call(
      'vote_articles',
      {
        focusId,
        votes: [
          { articleId: articleIds[0], value: 'up' },
          { articleId: articleIds[1], value: 'up' },
          { articleId: articleIds[2], value: 'down' },
        ],
      },
      'write',
    )) as unknown as { summary: { recorded: number }; results: { action: string }[] };

    expect(result.summary.recorded).toBe(3);
    expect(result.results.map((r) => r.action)).toEqual(['voted', 'voted', 'voted']);

    const db = await t.db();
    const rows = await db
      .selectFrom('article_votes')
      .select(['value'])
      .where('focus_id', '=', focusId)
      .where('user_id', '=', userId)
      .execute();
    expect(rows.map((r) => r.value).sort()).toEqual([-1, 1, 1]);
  });

  /**
   * The user may have voted deliberately; an agent curating "initial" votes
   * must not silently reverse that.
   */
  it('leaves existing votes alone unless told otherwise', async () => {
    const { focusId, articleIds } = await seedVotable();
    const target = articleIds[0] as string;

    await call('vote_articles', { focusId, votes: [{ articleId: target, value: 'up' }] }, 'write');

    const skipped = (await call(
      'vote_articles',
      { focusId, votes: [{ articleId: target, value: 'down' }] },
      'write',
    )) as unknown as { results: { action: string; value: number | null }[]; summary: { skippedExisting: number } };

    expect(skipped.results[0]?.action).toBe('skipped_existing');
    expect(skipped.results[0]?.value).toBe(1);
    expect(skipped.summary.skippedExisting).toBe(1);

    const replaced = (await call(
      'vote_articles',
      { focusId, votes: [{ articleId: target, value: 'down' }], overwriteExisting: true },
      'write',
    )) as unknown as { results: { action: string; value: number | null }[] };

    expect(replaced.results[0]?.action).toBe('replaced');
    expect(replaced.results[0]?.value).toBe(-1);
  });

  it('reports an unchanged vote without rewriting it', async () => {
    const { focusId, articleIds } = await seedVotable();
    const target = articleIds[0] as string;

    await call('vote_articles', { focusId, votes: [{ articleId: target, value: 'up' }] }, 'write');
    const again = (await call(
      'vote_articles',
      { focusId, votes: [{ articleId: target, value: 'up' }] },
      'write',
    )) as unknown as { results: { action: string }[]; summary: { alreadySet: number } };

    expect(again.results[0]?.action).toBe('already_set');
    expect(again.summary.alreadySet).toBe(1);
  });

  it('clears a vote, and reports clearing an absent one', async () => {
    const { focusId, articleIds } = await seedVotable();
    const [voted, unvoted] = articleIds as [string, string];

    await call('vote_articles', { focusId, votes: [{ articleId: voted, value: 'up' }] }, 'write');
    const result = (await call(
      'vote_articles',
      {
        focusId,
        votes: [
          { articleId: voted, value: 'clear' },
          { articleId: unvoted, value: 'clear' },
        ],
      },
      'write',
    )) as unknown as { results: { action: string }[] };

    expect(result.results.map((r) => r.action)).toEqual(['cleared', 'nothing_to_clear']);

    const db = await t.db();
    const remaining = await db.selectFrom('article_votes').select('id').where('user_id', '=', userId).execute();
    expect(remaining).toHaveLength(0);
  });

  it('keeps focus-scoped and global votes separate', async () => {
    const { focusId, articleIds } = await seedVotable();
    const target = articleIds[0] as string;

    await call('vote_articles', { focusId, votes: [{ articleId: target, value: 'up' }] }, 'write');
    // No focusId — a global vote on the same article must be its own row, not a
    // conflict with the focus-scoped one.
    const global = (await call(
      'vote_articles',
      { votes: [{ articleId: target, value: 'down' }] },
      'write',
    )) as unknown as { results: { action: string }[]; scope: unknown };

    expect(global.results[0]?.action).toBe('voted');
    expect(global.scope).toBe('global');

    const preview = (await call('preview_focus', { focusId })) as unknown as {
      topMatches: { id: string; vote: number | null; globalVote: number | null }[];
      votedInSample: number;
    };
    const row = preview.topMatches.find((a) => a.id === target);
    expect(row?.vote).toBe(1);
    expect(row?.globalVote).toBe(-1);
    expect(preview.votedInSample).toBe(1);
  });

  it('refuses to vote on another user’s article', async () => {
    const { focusId } = await seedVotable();
    const other = await t.register('other', 'password456');

    const db = await t.db();
    await db
      .insertInto('sources')
      .values({
        id: 'their-source',
        user_id: other.id,
        type: 'rss',
        name: 'Theirs',
        url: 'https://theirs.example/feed.xml',
        config: '{}',
        direction: 'newest',
      })
      .execute();
    await db
      .insertInto('articles')
      .values({ id: 'their-article', source_id: 'their-source', external_id: 'x', title: 'Theirs' })
      .execute();

    const result = (await call(
      'vote_articles',
      { focusId, votes: [{ articleId: 'their-article', value: 'up' }] },
      'write',
    )) as unknown as { results: { action: string }[]; summary: { notFound: number } };

    // A vote pulls the article's embedding into this user's propagation context,
    // so an unowned article must be refused rather than silently accepted.
    expect(result.results[0]?.action).toBe('not_found');
    expect(result.summary.notFound).toBe(1);
  });

  it('requires write scope and rejects an unowned focus', async () => {
    const { focusId, articleIds } = await seedVotable();

    await expect(
      toolRegistry.call({
        name: 'vote_articles',
        args: { focusId, votes: [{ articleId: articleIds[0], value: 'up' }] },
        ctx: ctxFor('read'),
      }),
    ).rejects.toThrow(/requires an API key with "write" scope/);

    await expect(
      call('vote_articles', { focusId: 'not-mine', votes: [{ articleId: articleIds[0], value: 'up' }] }, 'write'),
    ).rejects.toThrow(/not found/i);
  });

  it('surfaces per-focus vote counts in the workspace', async () => {
    const { focusId, articleIds } = await seedVotable();
    await call(
      'vote_articles',
      {
        focusId,
        votes: [
          { articleId: articleIds[0], value: 'up' },
          { articleId: articleIds[1], value: 'down' },
        ],
      },
      'write',
    );

    const workspace = (await call('get_workspace')) as unknown as {
      focuses: { id: string; votes: { up: number; down: number } }[];
    };
    expect(workspace.focuses.find((f) => f.id === focusId)?.votes).toEqual({ up: 1, down: 1 });
  });
});

// --- Isolation ---

describe('user isolation', () => {
  it('never exposes another user’s data', async () => {
    const db = await t.db();
    const mine = await seedSource(db, 'Mine', 'https://mine.example/feed.xml');

    const other = await t.register('other', 'password456');
    const theirId = crypto.randomUUID();
    await db
      .insertInto('sources')
      .values({
        id: theirId,
        user_id: other.id,
        type: 'rss',
        name: 'Theirs',
        url: 'https://theirs.example/feed.xml',
        config: '{}',
        direction: 'newest',
      })
      .execute();

    const workspace = (await call('get_workspace')) as unknown as { sources: { items: { id: string }[] } };
    expect(workspace.sources.items.map((s) => s.id)).toEqual([mine]);

    await expect(call('profile_source', { sourceId: theirId })).rejects.toThrow(/not found/i);
    await expect(call('delete_entity', { type: 'source', id: theirId, confirm: true }, 'admin')).rejects.toThrow(
      /not found/i,
    );
  });
});
