process.env["EDITIONS_DB"] = ":memory:";
process.env["EDITIONS_JWT_SECRET"] ??= "test-secret-do-not-use-in-production";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DatabaseService } from "../database/database.ts";
import { Services } from "../services/services.ts";
import {
  reconcile,
  createNliStrategy,
  createSimilarityStrategy,
  createHybridStrategy,
} from "./analysis.reconcile.ts";

import type { Kysely } from "kysely";
import type { DatabaseSchema } from "../database/database.types.ts";
import type { EmbedFn, ClassifyFn } from "./analysis.reconcile.ts";

// --- Test fixtures ---

/**
 * Fake embedder: returns a deterministic 4-dim L2-normalised vector
 * derived from the text. Same text → same embedding. Tracks call count.
 */
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

/**
 * Fake NLI classifier: returns scores based on text/label matching rules.
 * "AI" articles score high for "Technology", everything else scores low.
 */
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

/**
 * Seed a minimal dataset:
 *
 *   Source "Tech Blog"  → "AI is transforming everything" (has content)
 *                       → "Weather forecast for today"    (has content)
 *   Source "News Feed"  → "Local election results"         (has content)
 *
 *   Focus "Technology"  — match mode, linked to Tech Blog
 *   Focus "Everything"  — always mode, linked to both sources
 */
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
): Promise<Array<{ article_id: string; focus_id: string; confidence: number }>> => {
  return db
    .selectFrom("article_focuses")
    .select(["article_id", "focus_id", "confidence"])
    .orderBy("article_id")
    .orderBy("focus_id")
    .execute();
};

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

describe("reconcile", () => {
  it("assigns always-mode focuses and classifies match-mode focuses, saving all scores", async () => {
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();
    const strategy = createNliStrategy(classify);

    const result = await reconcile(
      ["art-ai", "art-weather", "art-election"],
      db,
      embed,
      strategy,
      { embeddingModel: "test-model" },
    );

    expect(result.articlesLoaded).toBe(3);
    expect(result.articlesEmbedded).toBe(3);

    const assignments = await getAssignments(db);

    // "Everything" focus (always mode): all 3 articles get confidence 1.0
    const alwaysAssignments = assignments.filter(
      (a) => a.focus_id === "focus-all",
    );
    expect(alwaysAssignments).toHaveLength(3);
    for (const a of alwaysAssignments) {
      expect(a.confidence).toBe(1.0);
    }

    // "Technology" focus (match mode): both tech-source articles get scores saved
    const techAssignments = assignments.filter(
      (a) => a.focus_id === "focus-tech",
    );
    expect(techAssignments).toHaveLength(2);

    // AI article scores high
    const aiTech = techAssignments.find((a) => a.article_id === "art-ai");
    expect(aiTech!.confidence).toBeCloseTo(0.85, 1);

    // Weather article scores low but is still saved (filtering is per-focus at query time)
    const weatherTech = techAssignments.find(
      (a) => a.article_id === "art-weather",
    );
    expect(weatherTech).toBeDefined();
    expect(weatherTech!.confidence).toBeCloseTo(0.1, 1);

    // All 3 articles marked as analysed
    expect(await getAnalysedCount(db)).toBe(3);
  });

  it("is idempotent — second run produces no new work", async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();
    const strategy = createNliStrategy(classify);
    const opts = { embeddingModel: "test-model" };

    // First run
    const first = await reconcile(
      ["art-ai", "art-weather", "art-election"],
      db,
      embed,
      strategy,
      opts,
    );
    const embeddingsAfterFirst = await getEmbeddingCount(db);
    const assignmentsAfterFirst = await getAssignments(db);
    const embedCallsAfterFirst = embedCalls();

    expect(first.articlesEmbedded).toBeGreaterThan(0);
    expect(first.assignmentsCreated).toBeGreaterThan(0);

    // Second run — same articles, same options
    const second = await reconcile(
      ["art-ai", "art-weather", "art-election"],
      db,
      embed,
      strategy,
      opts,
    );

    expect(second.articlesEmbedded).toBe(0);
    expect(second.assignmentsCreated).toBe(0);

    // DB state unchanged
    expect(await getEmbeddingCount(db)).toBe(embeddingsAfterFirst);
    expect(await getAssignments(db)).toEqual(assignmentsAfterFirst);

    // Embedder was NOT called again
    expect(embedCalls()).toBe(embedCallsAfterFirst);
  });

  it("scoped reconcile only classifies the targeted focus", async () => {
    const { embed, callCount: embedCalls } = createFakeEmbedder();
    const { classify } = createFakeClassifier();
    const strategy = createNliStrategy(classify);
    const opts = { embeddingModel: "test-model" };

    // First: full reconcile
    await reconcile(
      ["art-ai", "art-weather", "art-election"],
      db,
      embed,
      strategy,
      opts,
    );
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

    // Scoped reconcile: only the new focus
    const result = await reconcile(
      ["art-ai", "art-weather", "art-election"],
      db,
      embed,
      strategy,
      { ...opts, focusIds: ["focus-politics"] },
    );

    // Only the election article (from src-news) should get a new assignment
    expect(result.assignmentsCreated).toBe(1);

    const politicsAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id === "focus-politics",
    );
    expect(politicsAssignments).toHaveLength(1);
    expect(politicsAssignments[0]!.article_id).toBe("art-election");
    expect(politicsAssignments[0]!.confidence).toBeCloseTo(0.75, 1);

    // Previous assignments untouched
    const previousAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id !== "focus-politics",
    );
    expect(previousAssignments).toEqual(assignmentsBefore);

    // No new embeddings (all articles already had them)
    expect(result.articlesEmbedded).toBe(0);
    expect(embedCalls()).toBe(embedCallsBefore);
  });

  it("similarity strategy classifies using embeddings, not NLI", async () => {
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    // Run with NLI strategy first
    const nliStrategy = createNliStrategy(classify);
    await reconcile(
      ["art-ai", "art-weather"],
      db,
      embed,
      nliStrategy,
      { embeddingModel: "test-model" },
    );
    const nliAssignments = await getAssignments(db);
    const nliCallsTotal = nliCalls();
    expect(nliCallsTotal).toBeGreaterThan(0);

    // Clear assignments to re-run with a different strategy
    await db.deleteFrom("article_focuses").execute();

    // Run with similarity strategy — uses the embeddings already stored
    const simStrategy = createSimilarityStrategy(embed);
    await reconcile(
      ["art-ai", "art-weather"],
      db,
      embed,
      simStrategy,
      { embeddingModel: "test-model" },
    );
    const simAssignments = await getAssignments(db);

    // NLI was NOT called again (still same total from before)
    expect(nliCalls()).toBe(nliCallsTotal);

    // Both runs produced assignments for the same articles/focuses,
    // but with different confidence values (different strategies)
    expect(simAssignments).toHaveLength(nliAssignments.length);
    const nliConfidences = nliAssignments.map((a) => a.confidence);
    const simConfidences = simAssignments.map((a) => a.confidence);
    expect(simConfidences).not.toEqual(nliConfidences);
  });

  it("hybrid strategy uses similarity for clear results and NLI for ambiguous ones", async () => {
    // Create an embedder where "Technology" focus embedding is moderately
    // similar to both articles (to push scores into the ambiguous zone)
    const { embed } = createFakeEmbedder();
    const { classify, callCount: nliCalls } = createFakeClassifier();

    // Use a wide ambiguous range so most similarity scores trigger NLI refinement
    const hybridStrategy = createHybridStrategy(embed, classify, [0.0, 1.0]);

    await reconcile(
      ["art-ai", "art-weather"],
      db,
      embed,
      hybridStrategy,
      { embeddingModel: "test-model" },
    );

    // With ambiguous range [0, 1], ALL similarity results should be refined by NLI
    expect(nliCalls()).toBeGreaterThan(0);

    // The final scores should reflect the NLI classifier's output
    const techAssignments = (await getAssignments(db)).filter(
      (a) => a.focus_id === "focus-tech",
    );
    const aiAssignment = techAssignments.find(
      (a) => a.article_id === "art-ai",
    );
    // NLI classifier returns 0.85 for AI + Technology
    expect(aiAssignment!.confidence).toBeCloseTo(0.85, 1);
  });

  it("scoring degrades gracefully when articles lack embeddings", async () => {
    // This tests the integration between reconcile output and the scoring
    // system. Articles classified via "always" mode have no embedding;
    // vote propagation should fall back to 0 rather than crash.
    const { embed } = createFakeEmbedder();
    const { classify } = createFakeClassifier();
    const strategy = createNliStrategy(classify);

    // Reconcile only the content-less article (will get always-assignment but no embedding)
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

    await reconcile(
      ["art-ai", "art-notext"],
      db,
      embed,
      strategy,
      { embeddingModel: "test-model" },
    );

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
    expect(allFocusAssignments).toHaveLength(2);

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
        confidence: 1.0,
        publishedAt: new Date().toISOString(),
        embedding: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4),
      },
      emptyVoteContext(),
      focusWeights,
    );

    // Article without embedding also scores (falls back to confidence + recency)
    const scoreWithoutEmbed = computeScore(
      {
        articleId: "art-notext",
        confidence: 1.0,
        publishedAt: new Date().toISOString(),
        embedding: null,
      },
      emptyVoteContext(),
      focusWeights,
    );

    // Both produce valid numeric scores
    expect(scoreWithEmbed).toBeGreaterThan(0);
    expect(scoreWithoutEmbed).toBeGreaterThan(0);

    // With an empty vote context, both should score the same
    // (no vote propagation to differentiate them)
    expect(scoreWithEmbed).toBeCloseTo(scoreWithoutEmbed, 5);
  });

  it("handles articles without content gracefully", async () => {
    // Add an article with no content
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
    const strategy = createNliStrategy(classify);

    const result = await reconcile(
      ["art-empty"],
      db,
      embed,
      strategy,
      { embeddingModel: "test-model" },
    );

    // Article loaded but no embedding (no text to embed)
    expect(result.articlesLoaded).toBe(1);
    expect(result.articlesEmbedded).toBe(0);

    // Still gets "always" focus assignment (doesn't require content)
    const assignments = await getAssignments(db);
    const alwaysAssignment = assignments.find(
      (a) => a.article_id === "art-empty" && a.focus_id === "focus-all",
    );
    expect(alwaysAssignment).toBeDefined();
    expect(alwaysAssignment!.confidence).toBe(1.0);

    // No "match" focus assignment (no text to classify)
    const matchAssignment = assignments.find(
      (a) => a.article_id === "art-empty" && a.focus_id === "focus-tech",
    );
    expect(matchAssignment).toBeUndefined();

    // Still marked as analysed
    expect(await getAnalysedCount(db)).toBe(1);
  });
});
