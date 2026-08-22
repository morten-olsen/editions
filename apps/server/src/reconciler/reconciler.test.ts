process.env['EDITIONS_DB'] = ':memory:';
process.env['EDITIONS_JWT_SECRET'] ??= 'test-secret-do-not-use-in-production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';

import { DatabaseService } from '../database/database.ts';
import { Services } from '../services/services.ts';
import type { DatabaseSchema } from '../database/database.types.ts';

import { applyAnalysisReset, buildReconcileSteps } from './reconciler.ts';
import type { ScopeFilter } from './reconciler.ts';
import { runReconcileSteps } from './reconciler.runner.ts';
import type { ReconcileStep } from './reconciler.runner.ts';
import type { EmbedFn } from './reconciler.embed.ts';
import type { ClassifyFn } from './reconciler.nli.ts';

// --- Test fixtures ---

const createFakeEmbedder = (): { embed: EmbedFn; callCount: () => number } => {
  let calls = 0;
  const embed: EmbedFn = async (text) => {
    calls++;
    const arr = new Float32Array(4);
    for (let i = 0; i < 4; i++) {
      arr[i] = Math.sin((text.charCodeAt(i % text.length) * (i + 1)) / 10);
    }
    const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 4; i++) {
        arr[i] = (arr[i] as number) / norm;
      }
    }
    return arr;
  };
  return { embed, callCount: () => calls };
};

const createFakeClassifier = (): {
  classify: ClassifyFn;
  callCount: () => number;
} => {
  let calls = 0;
  const classify: ClassifyFn = async (text, labels) => {
    calls++;
    return labels
      .map((label) => {
        let score = 0.1;
        if (text.toLowerCase().includes('artificial intelligence') && label.toLowerCase().includes('technology')) {
          score = 0.85;
        }
        if (text.toLowerCase().includes('election') && label.toLowerCase().includes('politics')) {
          score = 0.75;
        }
        return { label, score };
      })
      .sort((a, b) => b.score - a.score);
  };
  return { classify, callCount: () => calls };
};

const seed = async (db: Kysely<DatabaseSchema>): Promise<void> => {
  await db
    .insertInto('users')
    .values({
      id: 'user-1',
      username: 'testuser',
      password_hash: 'fake-hash',
      role: 'admin',
    })
    .execute();

  await db
    .insertInto('sources')
    .values([
      {
        id: 'src-tech',
        user_id: 'user-1',
        type: 'rss',
        name: 'Tech Blog',
        url: 'https://tech.example.com/feed',
        config: '{}',
        direction: 'ltr',
      },
      {
        id: 'src-news',
        user_id: 'user-1',
        type: 'rss',
        name: 'News Feed',
        url: 'https://news.example.com/feed',
        config: '{}',
        direction: 'ltr',
      },
    ])
    .execute();

  const now = new Date().toISOString();
  await db
    .insertInto('articles')
    .values([
      {
        id: 'art-ai',
        source_id: 'src-tech',
        external_id: '1',
        title: 'AI is transforming everything',
        content: '<p>Artificial intelligence continues to reshape industries around the world.</p>',
        extracted_at: now,
      },
      {
        id: 'art-weather',
        source_id: 'src-tech',
        external_id: '2',
        title: 'Weather forecast for today',
        content: '<p>Sunny skies expected across the region this week.</p>',
        extracted_at: now,
      },
      {
        id: 'art-election',
        source_id: 'src-news',
        external_id: '3',
        title: 'Local election results',
        content: '<p>The mayoral race concluded with a decisive victory for the incumbent.</p>',
        extracted_at: now,
      },
    ])
    .execute();

  await db
    .insertInto('focuses')
    .values([
      {
        id: 'focus-tech',
        user_id: 'user-1',
        name: 'Technology',
        description: 'Tech news and AI',
      },
      {
        id: 'focus-all',
        user_id: 'user-1',
        name: 'Everything',
        description: null,
      },
    ])
    .execute();

  await db
    .insertInto('focus_sources')
    .values([
      { focus_id: 'focus-tech', source_id: 'src-tech' },
      { focus_id: 'focus-all', source_id: 'src-tech' },
      { focus_id: 'focus-all', source_id: 'src-news' },
    ])
    .execute();
};

// --- Helpers ---

const getAssignments = async (
  db: Kysely<DatabaseSchema>,
): Promise<{ article_id: string; focus_id: string; similarity: number | null; nli: number | null }[]> => {
  return db
    .selectFrom('article_focuses')
    .select(['article_id', 'focus_id', 'similarity', 'nli'])
    .orderBy('article_id')
    .orderBy('focus_id')
    .execute();
};

const effectiveConf = (a: { similarity: number | null; nli: number | null }): number => a.nli ?? a.similarity ?? 0;

const getEmbeddingCount = async (db: Kysely<DatabaseSchema>): Promise<number> => {
  const row = await db.selectFrom('article_embeddings').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
  return Number(row.count);
};

const getAnalysedCount = async (db: Kysely<DatabaseSchema>): Promise<number> => {
  const row = await db
    .selectFrom('articles')
    .select(db.fn.countAll().as('count'))
    .where('analysed_at', 'is not', null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
};

// Compose the REAL pipeline (via buildReconcileSteps) — extraction is skipped
// because it does live HTTP, and test model names keep fixtures deterministic
const buildSteps = (
  db: Kysely<DatabaseSchema>,
  embedFn: EmbedFn,
  classifyFn?: ClassifyFn,
  opts?: {
    classifier?: 'nli' | 'similarity' | 'hybrid';
    scopeFilter?: ScopeFilter;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ReconcileStep<any>[] =>
  buildReconcileSteps({
    db,
    embedFn,
    classifyFn: classifyFn ?? (async () => []),
    classifier: classifyFn ? (opts?.classifier ?? 'nli') : 'similarity',
    scopeFilter: opts?.scopeFilter,
    skipExtract: true,
    embeddingModel: 'test-model',
    classifierModel: 'test-classifier',
  });

// --- Tests ---

let db: Kysely<DatabaseSchema>;
let services: Services;

beforeEach(async () => {
  services = new Services();
  db = await services.get(DatabaseService).getInstance();
  await seed(db);
});

afterEach(async () => {
  await services.destroy();
});

describe('reconcile steps', () => {
  it('scores all articles against all focuses regardless of source links', async () => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));

    const assignments = await getAssignments(db);

    // Every article × every focus = 3 articles × 2 focuses = 6 assignments
    expect(assignments).toHaveLength(6);

    // All assignments have real similarity and NLI scores
    for (const a of assignments) {
      expect(a.similarity).not.toBeNull();
      expect(a.nli).not.toBeNull();
    }

    // AI article scores high for Technology via NLI
    const aiTech = assignments.find((a) => a.article_id === 'art-ai' && a.focus_id === 'focus-tech');
    expect(aiTech?.nli).toBeCloseTo(0.85, 1);

    // Cross-source scoring: election article (from src-news) scored against
    // focus-tech (which only has src-tech in focus_sources). This verifies
    // that scoring is decoupled from source links.
    const electionTech = assignments.find((a) => a.article_id === 'art-election' && a.focus_id === 'focus-tech');
    expect(electionTech).toBeDefined();
    expect(electionTech?.similarity).not.toBeNull();
    expect(electionTech?.nli).not.toBeNull();

    // All 3 articles marked as analysed
    expect(await getAnalysedCount(db)).toBe(3);
  });

  it('is idempotent — second run produces no new work', async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));
    const embeddingsAfterFirst = await getEmbeddingCount(db);
    const assignmentsAfterFirst = await getAssignments(db);
    const embedCallsAfterFirst = embedCalls();

    expect(embeddingsAfterFirst).toBeGreaterThan(0);
    expect(assignmentsAfterFirst.length).toBeGreaterThan(0);

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));

    expect(await getEmbeddingCount(db)).toBe(embeddingsAfterFirst);
    expect(await getAssignments(db)).toEqual(assignmentsAfterFirst);
    expect(embedCalls()).toBe(embedCallsAfterFirst);
  });

  it('scoped reconcile only classifies the targeted focus', async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));
    const assignmentsBefore = await getAssignments(db);
    const embedCallsBefore = embedCalls();

    await db
      .insertInto('focuses')
      .values({
        id: 'focus-politics',
        user_id: 'user-1',
        name: 'Politics',
        description: 'Elections and governance',
      })
      .execute();
    await db
      .insertInto('focus_sources')
      .values({
        focus_id: 'focus-politics',
        source_id: 'src-news',
      })
      .execute();

    const embeddingsBeforeScoped = await getEmbeddingCount(db);

    await runReconcileSteps(
      buildSteps(db, embed, classify, {
        classifier: 'nli',
        scopeFilter: { focusIds: ['focus-politics'] },
      }),
    );

    // All 3 articles scored against politics focus (not just src-news articles)
    const politicsAssignments = (await getAssignments(db)).filter((a) => a.focus_id === 'focus-politics');
    expect(politicsAssignments).toHaveLength(3);

    // Election article should score high for politics
    const electionPolitics = politicsAssignments.find((a) => a.article_id === 'art-election');
    expect(electionPolitics).toBeDefined();
    expect(effectiveConf(electionPolitics as (typeof politicsAssignments)[number])).toBeCloseTo(0.75, 1);

    const previousAssignments = (await getAssignments(db)).filter((a) => a.focus_id !== 'focus-politics');
    expect(previousAssignments).toEqual(assignmentsBefore);

    expect(await getEmbeddingCount(db)).toBe(embeddingsBeforeScoped);
    expect(embedCalls()).toBeGreaterThan(embedCallsBefore);
  });

  it('similarity strategy classifies using embeddings, not NLI', async () => {
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));
    const nliAssignments = await getAssignments(db);
    const nliCallsTotal = nliCalls();
    expect(nliCallsTotal).toBeGreaterThan(0);

    await db.deleteFrom('article_focuses').execute();

    await runReconcileSteps(buildSteps(db, embed, undefined, { classifier: 'similarity' }));
    const simAssignments = await getAssignments(db);

    expect(nliCalls()).toBe(nliCallsTotal);

    expect(simAssignments).toHaveLength(nliAssignments.length);
    const nliConfidences = nliAssignments.map((a) => effectiveConf(a));
    const simConfidences = simAssignments.map((a) => effectiveConf(a));
    expect(simConfidences).not.toEqual(nliConfidences);
  });

  it('hybrid strategy uses NLI to refine ambiguous similarity scores', async () => {
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'hybrid' }));

    expect(nliCalls()).toBeGreaterThan(0);

    const techAssignments = (await getAssignments(db)).filter((a) => a.focus_id === 'focus-tech');
    const aiAssignment = techAssignments.find((a) => a.article_id === 'art-ai');
    expect(aiAssignment?.nli).toBeCloseTo(0.85, 1);
  });

  it('scoring degrades gracefully when articles lack embeddings', async () => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await db
      .insertInto('articles')
      .values({
        id: 'art-notext',
        source_id: 'src-tech',
        external_id: 'notext',
        title: 'No body',
        extracted_at: new Date().toISOString(),
      })
      .execute();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));

    const embeddings = await db.selectFrom('article_embeddings').select('article_id').execute();
    const embeddedIds = embeddings.map((e) => e.article_id);
    expect(embeddedIds).toContain('art-ai');
    expect(embeddedIds).not.toContain('art-notext');

    const assignments = await getAssignments(db);
    const allFocusAssignments = assignments.filter((a) => a.focus_id === 'focus-all');
    // art-notext has no embedding, so it won't get a similarity score
    expect(allFocusAssignments).toHaveLength(3);

    const { scoreAndRank, emptyVoteContext, defaultUserScoringWeights } = await import('../ranking/ranking.ts');

    const aiEmbedding = await db
      .selectFrom('article_embeddings')
      .select('embedding')
      .where('article_id', '=', 'art-ai')
      .executeTakeFirstOrThrow();

    const [withEmbed] = scoreAndRank({
      candidates: [
        {
          articleId: 'art-ai',
          similarity: 1.0,
          nli: null,
          publishedAt: new Date().toISOString(),
          // Raw BLOB straight from the DB — ranking owns the decode
          embedding: aiEmbedding.embedding,
        },
      ],
      voteContext: emptyVoteContext(),
      weights: defaultUserScoringWeights.focus,
    });

    const [withoutEmbed] = scoreAndRank({
      candidates: [
        {
          articleId: 'art-notext',
          similarity: 1.0,
          nli: null,
          publishedAt: new Date().toISOString(),
          embedding: null,
        },
      ],
      voteContext: emptyVoteContext(),
      weights: defaultUserScoringWeights.focus,
    });

    expect(withEmbed?.score).toBeGreaterThan(0);
    expect(withoutEmbed?.score).toBeGreaterThan(0);
    expect(withEmbed?.score).toBeCloseTo(withoutEmbed?.score ?? 0, 5);
  });

  it('handles articles without content gracefully', async () => {
    await db
      .insertInto('articles')
      .values({
        id: 'art-empty',
        source_id: 'src-tech',
        external_id: '99',
        title: 'No content article',
        extracted_at: new Date().toISOString(),
      })
      .execute();

    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));

    const embeddings = await db
      .selectFrom('article_embeddings')
      .select('article_id')
      .where('article_id', '=', 'art-empty')
      .execute();
    expect(embeddings).toHaveLength(0);

    // Article without content has no embedding, so no similarity scores
    const assignments = await getAssignments(db);
    const emptyAssignments = assignments.filter((a) => a.article_id === 'art-empty');
    expect(emptyAssignments).toHaveLength(0);

    const analysedRow = await db
      .selectFrom('articles')
      .select('analysed_at')
      .where('id', '=', 'art-empty')
      .executeTakeFirstOrThrow();
    expect(analysedRow.analysed_at).not.toBeNull();
  });
});

describe('applyAnalysisReset', () => {
  const runPipeline = async (): Promise<void> => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();
    await runReconcileSteps(buildSteps(db, embed, classify, { classifier: 'nli' }));
  };

  it("'scores' clears classifications and analysed_at but keeps embeddings and content", async () => {
    await runPipeline();

    await applyAnalysisReset(db, { reset: 'scores' });

    expect(await getAssignments(db)).toHaveLength(0);
    const embeddings = await db.selectFrom('article_embeddings').select('article_id').execute();
    expect(embeddings.length).toBeGreaterThan(0);
    const analysed = await db.selectFrom('articles').select('id').where('analysed_at', 'is not', null).execute();
    expect(analysed).toHaveLength(0);
    const withContent = await db.selectFrom('articles').select('id').where('content', 'is not', null).execute();
    expect(withContent.length).toBeGreaterThan(0);
  });

  it("'content' also clears embeddings, content, and extracted_at", async () => {
    await runPipeline();

    await applyAnalysisReset(db, { reset: 'content' });

    expect(await getAssignments(db)).toHaveLength(0);
    expect(await db.selectFrom('article_embeddings').select('article_id').execute()).toHaveLength(0);
    const extracted = await db.selectFrom('articles').select('id').where('extracted_at', 'is not', null).execute();
    expect(extracted).toHaveLength(0);
    const withContent = await db.selectFrom('articles').select('id').where('content', 'is not', null).execute();
    expect(withContent).toHaveLength(0);
  });

  it('a focus-scoped reset only clears that focus and keeps analysed_at', async () => {
    await runPipeline();

    await applyAnalysisReset(db, { reset: 'scores', scopeFilter: { focusIds: ['focus-tech'] } });

    const assignments = await getAssignments(db);
    expect(assignments.filter((a) => a.focus_id === 'focus-tech')).toHaveLength(0);
    expect(assignments.filter((a) => a.focus_id === 'focus-all').length).toBeGreaterThan(0);
    const analysed = await db.selectFrom('articles').select('id').where('analysed_at', 'is not', null).execute();
    expect(analysed.length).toBeGreaterThan(0);
  });

  it('a source-scoped reset leaves other sources untouched', async () => {
    await runPipeline();

    await applyAnalysisReset(db, { reset: 'scores', scopeFilter: { sourceIds: ['src-news'] } });

    const assignments = await getAssignments(db);
    expect(assignments.some((a) => a.article_id === 'art-election')).toBe(false);
    expect(assignments.some((a) => a.article_id === 'art-ai')).toBe(true);
  });

  it('backfillExtractedAt marks content-bearing unextracted articles', async () => {
    await db
      .insertInto('articles')
      .values({
        id: 'art-legacy',
        source_id: 'src-tech',
        external_id: 'legacy-1',
        title: 'Pre-extraction-tracking article',
        content: '<p>Content ingested before extracted_at existed.</p>',
      })
      .execute();

    await applyAnalysisReset(db, { backfillExtractedAt: true });

    const row = await db
      .selectFrom('articles')
      .select('extracted_at')
      .where('id', '=', 'art-legacy')
      .executeTakeFirstOrThrow();
    expect(row.extracted_at).not.toBeNull();
  });
});

describe('runReconcileSteps', () => {
  it('reports real totals from countRemaining and isolates step failures', async () => {
    const progress: { phase: string; completed: number; total: number }[] = [];
    const ran: number[] = [];

    const failing: ReconcileStep<number> = {
      name: 'boom',
      countRemaining: async () => 2,
      fetchBatch: async function* (): AsyncGenerator<number[]> {
        yield [1, 2];
      },
      processBatch: async () => {
        throw new Error('kaboom');
      },
    };
    const after: ReconcileStep<number> = {
      name: 'after',
      countRemaining: async () => 1,
      fetchBatch: async function* (): AsyncGenerator<number[]> {
        yield [1];
      },
      processBatch: async (batch) => {
        ran.push(...batch);
      },
    };

    await expect(runReconcileSteps([failing, after], (p) => progress.push({ ...p }))).rejects.toThrow('boom: kaboom');

    // The failure did not stop the later step
    expect(ran).toEqual([1]);
    const afterTicks = progress.filter((p) => p.phase === 'after');
    expect(afterTicks.at(-1)).toEqual({ phase: 'after', completed: 1, total: 1 });
  });
});
