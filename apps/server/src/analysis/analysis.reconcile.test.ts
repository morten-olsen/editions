process.env["EDITIONS_DB"] = ":memory:";
process.env["EDITIONS_JWT_SECRET"] ??= "test-secret-do-not-use-in-production";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DatabaseService } from "../database/database.ts";
import { Services } from "../services/services.ts";
import {
  createReconcileSteps,
  runReconcileSteps,
} from "./analysis.reconcile.ts";

import type { Kysely } from "kysely";
import type { DatabaseSchema } from "../database/database.types.ts";
import type { EmbedFn, ClassifyFn } from "./analysis.reconcile.ts";

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
    if (norm > 0) for (let i = 0; i < 4; i++) arr[i]! /= norm;
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
        if (
          text.toLowerCase().includes("artificial intelligence") &&
          label.toLowerCase().includes("technology")
        ) {
          score = 0.85;
        }
        if (
          text.toLowerCase().includes("election") &&
          label.toLowerCase().includes("politics")
        ) {
          score = 0.75;
        }
        return { label, score };
      })
      .sort((a, b) => b.score - a.score);
  };
  return { classify, callCount: () => calls };
};

const seed = async (
  db: Kysely<DatabaseSchema>,
): Promise<void> => {
  await db
    .insertInto("users")
    .values({
      id: "user-1",
      username: "testuser",
      password_hash: "fake-hash",
      role: "admin",
    })
    .execute();

  await db
    .insertInto("sources")
    .values([
      {
        id: "src-tech",
        user_id: "user-1",
        type: "rss",
        name: "Tech Blog",
        url: "https://tech.example.com/feed",
        config: "{}",
        direction: "ltr",
      },
      {
        id: "src-news",
        user_id: "user-1",
        type: "rss",
        name: "News Feed",
        url: "https://news.example.com/feed",
        config: "{}",
        direction: "ltr",
      },
    ])
    .execute();

  const now = new Date().toISOString();
  await db
    .insertInto("articles")
    .values([
      {
        id: "art-ai",
        source_id: "src-tech",
        external_id: "1",
        title: "AI is transforming everything",
        content:
          "<p>Artificial intelligence continues to reshape industries around the world.</p>",
        extracted_at: now,
      },
      {
        id: "art-weather",
        source_id: "src-tech",
        external_id: "2",
        title: "Weather forecast for today",
        content: "<p>Sunny skies expected across the region this week.</p>",
        extracted_at: now,
      },
      {
        id: "art-election",
        source_id: "src-news",
        external_id: "3",
        title: "Local election results",
        content:
          "<p>The mayoral race concluded with a decisive victory for the incumbent.</p>",
        extracted_at: now,
      },
    ])
    .execute();

  await db
    .insertInto("focuses")
    .values([
      {
        id: "focus-tech",
        user_id: "user-1",
        name: "Technology",
        description: "Tech news and AI",
      },
      {
        id: "focus-all",
        user_id: "user-1",
        name: "Everything",
        description: null,
      },
    ])
    .execute();

  await db
    .insertInto("focus_sources")
    .values([
      { focus_id: "focus-tech", source_id: "src-tech", mode: "match" },
      { focus_id: "focus-all", source_id: "src-tech", mode: "always" },
      { focus_id: "focus-all", source_id: "src-news", mode: "always" },
    ])
    .execute();
};

// --- Helpers ---

const getAssignments = async (
  db: Kysely<DatabaseSchema>,
): Promise<Array<{ article_id: string; focus_id: string; similarity: number | null; nli: number | null }>> => {
  return db
    .selectFrom("article_focuses")
    .select(["article_id", "focus_id", "similarity", "nli"])
    .orderBy("article_id")
    .orderBy("focus_id")
    .execute();
};

const effectiveConf = (a: { similarity: number | null; nli: number | null }): number =>
  a.nli ?? a.similarity ?? 0;

const getEmbeddingCount = async (
  db: Kysely<DatabaseSchema>,
): Promise<number> => {
  const row = await db
    .selectFrom("article_embeddings")
    .select(db.fn.countAll().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
};

const getAnalysedCount = async (
  db: Kysely<DatabaseSchema>,
): Promise<number> => {
  const row = await db
    .selectFrom("articles")
    .select(db.fn.countAll().as("count"))
    .where("analysed_at", "is not", null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
};

const runReconcile = async (
  db: Kysely<DatabaseSchema>,
  embedFn: EmbedFn,
  classifyFn?: ClassifyFn,
  opts?: { classifier?: "nli" | "similarity" | "hybrid"; scopeFilter?: { sourceIds?: string[]; focusIds?: string[] }; skipExtract?: boolean },
): Promise<void> => {
  const steps = createReconcileSteps({
    db,
    embedFn,
    classifyFn,
    embeddingModel: "test-model",
    classifier: opts?.classifier ?? "nli",
    scopeFilter: opts?.scopeFilter,
    skipExtract: opts?.skipExtract,
  });
  await runReconcileSteps(steps);
};

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

describe("reconcile steps", () => {
  it("assigns always-mode focuses and classifies match-mode focuses, saving all scores", async () => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await runReconcile(db, embed, classify, { classifier: "nli" });

    const assignments = await getAssignments(db);

    // "Everything" focus (always mode): all 3 articles get similarity 1.0
    const alwaysAssignments = assignments.filter(
      (a) => a.focus_id === "focus-all",
    );
    expect(alwaysAssignments).toHaveLength(3);
    for (const a of alwaysAssignments) {
      expect(a.similarity).toBe(1.0);
      expect(a.nli).toBeNull();
    }

    // "Technology" focus (match mode): both tech-source articles get NLI scores
    const techAssignments = assignments.filter(
      (a) => a.focus_id === "focus-tech",
    );
    expect(techAssignments).toHaveLength(2);

    // AI article scores high via NLI
    const aiTech = techAssignments.find((a) => a.article_id === "art-ai");
    expect(aiTech!.nli).toBeCloseTo(0.85, 1);

    // Weather article scores low but is still saved
    const weatherTech = techAssignments.find(
      (a) => a.article_id === "art-weather",
    );
    expect(weatherTech).toBeDefined();
    expect(aiTech!.nli).not.toBeNull();

    // All 3 articles marked as analysed
    expect(await getAnalysedCount(db)).toBe(3);
  });

  it("is idempotent — second run produces no new work", async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    // First run
    await runReconcile(db, embed, classify, { classifier: "nli" });
    const embeddingsAfterFirst = await getEmbeddingCount(db);
    const assignmentsAfterFirst = await getAssignments(db);
    const embedCallsAfterFirst = embedCalls();

    expect(embeddingsAfterFirst).toBeGreaterThan(0);
    expect(assignmentsAfterFirst.length).toBeGreaterThan(0);

    // Second run — same state
    await runReconcile(db, embed, classify, { classifier: "nli" });

    // DB state unchanged
    expect(await getEmbeddingCount(db)).toBe(embeddingsAfterFirst);
    expect(await getAssignments(db)).toEqual(assignmentsAfterFirst);

    // Embedder was NOT called again
    expect(embedCalls()).toBe(embedCallsAfterFirst);
  });

  it("scoped reconcile only classifies the targeted focus", async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    // First: full reconcile
    await runReconcile(db, embed, classify, { classifier: "nli" });
    const assignmentsBefore = await getAssignments(db);
    const embedCallsBefore = embedCalls();

    // Add a new focus linked to the news source
    await db
      .insertInto("focuses")
      .values({
        id: "focus-politics",
        user_id: "user-1",
        name: "Politics",
        description: "Elections and governance",
      })
      .execute();
    await db
      .insertInto("focus_sources")
      .values({
        focus_id: "focus-politics",
        source_id: "src-news",
        mode: "match",
      })
      .execute();

    const embeddingsBeforeScoped = await getEmbeddingCount(db);

    // Scoped reconcile: only the new focus
    await runReconcile(db, embed, classify, {
      classifier: "nli",
      scopeFilter: { focusIds: ["focus-politics"] },
      skipExtract: true,
    });

    // Only the election article (from src-news) should get a new assignment
    const politicsAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id === "focus-politics",
    );
    expect(politicsAssignments).toHaveLength(1);
    expect(politicsAssignments[0]!.article_id).toBe("art-election");
    expect(effectiveConf(politicsAssignments[0]!)).toBeCloseTo(0.75, 1);

    // Previous assignments untouched
    const previousAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id !== "focus-politics",
    );
    expect(previousAssignments).toEqual(assignmentsBefore);

    // No new article embeddings (only the new focus label was embedded)
    expect(await getEmbeddingCount(db)).toBe(embeddingsBeforeScoped);
    // The embedder was called for the "Politics" focus label
    expect(embedCalls()).toBeGreaterThan(embedCallsBefore);
  });

  it("similarity strategy classifies using embeddings, not NLI", async () => {
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    // Run with NLI strategy
    await runReconcile(db, embed, classify, { classifier: "nli" });
    const nliAssignments = await getAssignments(db);
    const nliCallsTotal = nliCalls();
    expect(nliCallsTotal).toBeGreaterThan(0);

    // Clear assignments to re-run with a different strategy
    await db.deleteFrom("article_focuses").execute();

    // Run with similarity-only strategy — no NLI step
    await runReconcile(db, embed, undefined, { classifier: "similarity" });
    const simAssignments = await getAssignments(db);

    // NLI was NOT called again
    expect(nliCalls()).toBe(nliCallsTotal);

    // Both runs produced assignments for the same articles/focuses,
    // but with different effective confidence values
    expect(simAssignments).toHaveLength(nliAssignments.length);
    const nliConfidences = nliAssignments.map((a) => effectiveConf(a));
    const simConfidences = simAssignments.map((a) => effectiveConf(a));
    expect(simConfidences).not.toEqual(nliConfidences);
  });

  it("hybrid strategy uses NLI to refine ambiguous similarity scores", async () => {
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    // Hybrid: runs similarity step then NLI step
    await runReconcile(db, embed, classify, { classifier: "hybrid" });

    // NLI step should have been called
    expect(nliCalls()).toBeGreaterThan(0);

    // The final scores should reflect the NLI classifier's output
    const techAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id === "focus-tech",
    );
    const aiAssignment = techAssignments.find(
      (a) => a.article_id === "art-ai",
    );
    // NLI classifier returns 0.85 for AI + Technology
    expect(aiAssignment!.nli).toBeCloseTo(0.85, 1);
  });

  it("scoring degrades gracefully when articles lack embeddings", async () => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    await db
      .insertInto("articles")
      .values({
        id: "art-notext",
        source_id: "src-tech",
        external_id: "notext",
        title: "No body",
        extracted_at: new Date().toISOString(),
      })
      .execute();

    await runReconcile(db, embed, classify, { classifier: "nli" });

    // art-ai has an embedding, art-notext does not
    const embeddings = await db
      .selectFrom("article_embeddings")
      .select("article_id")
      .execute();
    const embeddedIds = embeddings.map((e) => e.article_id);
    expect(embeddedIds).toContain("art-ai");
    expect(embeddedIds).not.toContain("art-notext");

    // Both have "always" assignments in article_focuses
    const assignments = await getAssignments(db);
    const allFocusAssignments = assignments.filter(
      (a) => a.focus_id === "focus-all",
    );
    // 3 original articles + art-notext = 4 articles in always-mode focus
    expect(allFocusAssignments).toHaveLength(4);

    // Scoring: import computeScore and verify it handles the null embedding
    const { computeScore, emptyVoteContext, focusWeights } = await import(
      "../votes/votes.scoring.ts"
    );

    // Article with embedding scores normally
    const aiEmbedding = await db
      .selectFrom("article_embeddings")
      .select("embedding")
      .where("article_id", "=", "art-ai")
      .executeTakeFirstOrThrow();
    const buf = aiEmbedding.embedding as Buffer;

    const scoreWithEmbed = computeScore(
      {
        articleId: "art-ai",
        similarity: 1.0,
        nli: null,
        publishedAt: new Date().toISOString(),
        embedding: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4),
      },
      emptyVoteContext(),
      focusWeights,
    );

    const scoreWithoutEmbed = computeScore(
      {
        articleId: "art-notext",
        similarity: 1.0,
        nli: null,
        publishedAt: new Date().toISOString(),
        embedding: null,
      },
      emptyVoteContext(),
      focusWeights,
    );

    expect(scoreWithEmbed).toBeGreaterThan(0);
    expect(scoreWithoutEmbed).toBeGreaterThan(0);
    expect(scoreWithEmbed).toBeCloseTo(scoreWithoutEmbed, 5);
  });

  it("handles articles without content gracefully", async () => {
    await db
      .insertInto("articles")
      .values({
        id: "art-empty",
        source_id: "src-tech",
        external_id: "99",
        title: "No content article",
        extracted_at: new Date().toISOString(),
      })
      .execute();

    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();

    // Run only for the empty article's source
    await runReconcile(db, embed, classify, { classifier: "nli" });

    // No embedding for the empty article
    const embeddings = await db
      .selectFrom("article_embeddings")
      .select("article_id")
      .where("article_id", "=", "art-empty")
      .execute();
    expect(embeddings).toHaveLength(0);

    // Still gets "always" focus assignment
    const assignments = await getAssignments(db);
    const alwaysAssignment = assignments.find(
      (a) => a.article_id === "art-empty" && a.focus_id === "focus-all",
    );
    expect(alwaysAssignment).toBeDefined();
    expect(alwaysAssignment!.similarity).toBe(1.0);

    // No "match" focus assignment (no text to classify)
    const matchAssignment = assignments.find(
      (a) => a.article_id === "art-empty" && a.focus_id === "focus-tech",
    );
    expect(matchAssignment).toBeUndefined();

    // Still marked as analysed
    const analysedRow = await db
      .selectFrom("articles")
      .select("analysed_at")
      .where("id", "=", "art-empty")
      .executeTakeFirstOrThrow();
    expect(analysedRow.analysed_at).not.toBeNull();
  });
});
