import { describe, expect, it } from 'vitest';

import {
  decodeEmbedding,
  defaultUserScoringWeights,
  effectiveConfidence,
  emptyVoteContext,
  mergeVoteContexts,
  minConfidenceFilterSql,
  parseUserScoringWeights,
  scoreAndRank,
} from './ranking.ts';
import type { RankingCandidate, VoteContext } from './ranking.ts';

const NOW = Date.parse('2026-08-22T12:00:00Z');

const vec = (...values: number[]): Float32Array => Float32Array.from(values);

const candidate = (overrides: Partial<RankingCandidate> & { articleId: string }): RankingCandidate => ({
  similarity: null,
  nli: null,
  publishedAt: new Date(NOW).toISOString(),
  embedding: null,
  ...overrides,
});

describe('effectiveConfidence', () => {
  it('prefers nli over similarity', () => {
    expect(effectiveConfidence({ nli: 0.9, similarity: 0.2 })).toBe(0.9);
  });

  it('falls back to similarity when nli is null', () => {
    expect(effectiveConfidence({ nli: null, similarity: 0.7 })).toBe(0.7);
  });

  it('defaults to 0 when both are null', () => {
    expect(effectiveConfidence({ nli: null, similarity: null })).toBe(0);
  });
});

describe('decodeEmbedding', () => {
  it('passes through an already-decoded Float32Array', () => {
    const embedding = vec(1, 2, 3);
    expect(decodeEmbedding(embedding)).toBe(embedding);
  });

  it('decodes a raw BLOB buffer back to the original floats', () => {
    const original = vec(0.25, -1.5, 3);
    const blob = Buffer.from(original.buffer, original.byteOffset, original.byteLength);
    expect(decodeEmbedding(blob)).toEqual(original);
  });

  it('returns null for null, undefined, and unrecognized values', () => {
    expect(decodeEmbedding(null)).toBeNull();
    expect(decodeEmbedding(undefined)).toBeNull();
    expect(decodeEmbedding('not-an-embedding')).toBeNull();
  });
});

describe('scoreAndRank', () => {
  it('ranks by confidence, highest first, with no votes', () => {
    const ranked = scoreAndRank({
      candidates: [
        candidate({ articleId: 'low', similarity: 0.2 }),
        candidate({ articleId: 'high', similarity: 0.9 }),
        candidate({ articleId: 'mid', similarity: 0.5 }),
      ],
      voteContext: emptyVoteContext(),
      weights: { alpha: 1, beta: 0, gamma: 0 },
      now: NOW,
    });

    expect(ranked.map((r) => r.item.articleId)).toEqual(['high', 'mid', 'low']);
    expect(ranked[0]?.score).toBeCloseTo(0.9, 5);
  });

  it('nli takes precedence over similarity in the confidence term', () => {
    const [top] = scoreAndRank({
      candidates: [candidate({ articleId: 'a', similarity: 0.2, nli: 0.9 })],
      voteContext: emptyVoteContext(),
      weights: { alpha: 1, beta: 0, gamma: 0 },
      now: NOW,
    });
    expect(top?.score).toBeCloseTo(0.9, 5);
  });

  it('a direct vote overrides propagation for the same article', () => {
    const shared = vec(1, 0);
    const context: VoteContext = {
      votes: new Map([
        ['up', 1],
        ['down', -1],
      ]),
      // Propagation alone would push every candidate toward -1
      votedArticles: [{ embedding: vec(1, 0), value: -1 }],
    };

    const ranked = scoreAndRank({
      candidates: [
        candidate({ articleId: 'up', embedding: shared }),
        candidate({ articleId: 'down', embedding: shared }),
        candidate({ articleId: 'unvoted', embedding: shared }),
      ],
      voteContext: context,
      weights: { alpha: 0, beta: 1, gamma: 0 },
      now: NOW,
    });

    expect(ranked[0]?.item.articleId).toBe('up');
    expect(ranked[0]?.score).toBeGreaterThan(0);
    // The unvoted candidate follows the propagated (negative) signal, like 'down'
    const unvoted = ranked.find((r) => r.item.articleId === 'unvoted');
    const down = ranked.find((r) => r.item.articleId === 'down');
    expect(unvoted?.score).toBeCloseTo(down?.score ?? Number.NaN, 5);
  });

  it('propagates votes through embedding similarity', () => {
    const context: VoteContext = {
      votes: new Map(),
      votedArticles: [
        { embedding: vec(1, 0), value: 1 },
        { embedding: vec(0, 1), value: -1 },
      ],
    };

    const ranked = scoreAndRank({
      candidates: [
        candidate({ articleId: 'near-downvote', embedding: vec(0, 1) }),
        candidate({ articleId: 'near-upvote', embedding: vec(1, 0) }),
      ],
      voteContext: context,
      weights: { alpha: 0, beta: 1, gamma: 0 },
      now: NOW,
    });

    expect(ranked[0]?.item.articleId).toBe('near-upvote');
    expect(ranked[0]?.score).toBeGreaterThan(0);
    expect(ranked[1]?.score).toBeLessThan(0);
  });

  it('ignores voted articles below the propagation similarity floor', () => {
    const context: VoteContext = {
      votes: new Map(),
      // cosine similarity with (1, 0) is 0.3 — below the 0.4 floor
      votedArticles: [{ embedding: vec(0.3, Math.sqrt(1 - 0.09)), value: 1 }],
    };

    const [withEmbedding] = scoreAndRank({
      candidates: [candidate({ articleId: 'a', embedding: vec(1, 0) })],
      voteContext: context,
      weights: { alpha: 0, beta: 1, gamma: 0 },
      now: NOW,
    });
    const [withoutEmbedding] = scoreAndRank({
      candidates: [candidate({ articleId: 'b', embedding: null })],
      voteContext: context,
      weights: { alpha: 0, beta: 1, gamma: 0 },
      now: NOW,
    });

    expect(withEmbedding?.score).toBeCloseTo(withoutEmbedding?.score ?? Number.NaN, 5);
  });

  it('ramps vote weight below the vote threshold, shifting slack into confidence', () => {
    // 1 vote of 5 → ramp 0.2: effAlpha = 0.5 + 0.4 * 0.8 = 0.82, effBeta = 0.08
    const context: VoteContext = {
      votes: new Map([['other-article', 1]]),
      votedArticles: [],
    };

    const [ranked] = scoreAndRank({
      candidates: [candidate({ articleId: 'a', similarity: 1 })],
      voteContext: context,
      weights: { alpha: 0.5, beta: 0.4, gamma: 0.1 },
      now: NOW,
    });

    // 0.82 * 1 (confidence) + 0.08 * 0 (no signal for this article) + 0.1 * 1 (published now)
    expect(ranked?.score).toBeCloseTo(0.92, 5);
  });

  it('decays recency against the injected clock, with 0.5 neutral for unknown dates', () => {
    const weights = { alpha: 0, beta: 0, gamma: 1 };
    const threeDaysBefore = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();

    const ranked = scoreAndRank({
      candidates: [
        candidate({ articleId: 'fresh' }),
        candidate({ articleId: 'half-life', publishedAt: threeDaysBefore }),
        candidate({ articleId: 'undated', publishedAt: null }),
      ],
      voteContext: emptyVoteContext(),
      weights,
      now: NOW,
    });

    const scores = new Map(ranked.map((r) => [r.item.articleId, r.score]));
    expect(scores.get('fresh')).toBeCloseTo(1, 5);
    expect(scores.get('half-life')).toBeCloseTo(0.5, 5);
    expect(scores.get('undated')).toBeCloseTo(0.5, 5);
  });

  it('multiplies scores by source weight and focus weight', () => {
    const ranked = scoreAndRank({
      candidates: [
        candidate({ articleId: 'weighted', sourceId: 'src-a', similarity: 1 }),
        candidate({ articleId: 'unweighted', sourceId: 'src-b', similarity: 1 }),
      ],
      voteContext: emptyVoteContext(),
      weights: { alpha: 1, beta: 0, gamma: 0 },
      sourceWeights: new Map([['src-a', 2]]),
      focusWeight: 3,
      now: NOW,
    });

    const scores = new Map(ranked.map((r) => [r.item.articleId, r.score]));
    expect(scores.get('weighted')).toBeCloseTo(6, 5);
    expect(scores.get('unweighted')).toBeCloseTo(3, 5);
  });

  it('decodes raw BLOB embeddings before propagation', () => {
    const embedding = vec(1, 0);
    const blob = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    const context: VoteContext = {
      votes: new Map(),
      votedArticles: [{ embedding: vec(1, 0), value: 1 }],
    };

    const [ranked] = scoreAndRank({
      candidates: [candidate({ articleId: 'a', embedding: blob })],
      voteContext: context,
      weights: { alpha: 0, beta: 1, gamma: 0 },
      now: NOW,
    });

    expect(ranked?.score).toBeGreaterThan(0);
  });
});

describe('mergeVoteContexts', () => {
  it('lets the narrower scope win for the same article and concatenates voted articles', () => {
    const global: VoteContext = {
      votes: new Map([
        ['shared', 1],
        ['global-only', -1],
      ]),
      votedArticles: [{ embedding: vec(1, 0), value: 1 }],
    };
    const focusScoped: VoteContext = {
      votes: new Map([['shared', -1]]),
      votedArticles: [{ embedding: vec(0, 1), value: -1 }],
    };

    const merged = mergeVoteContexts(global, focusScoped);

    expect(merged.votes.get('shared')).toBe(-1);
    expect(merged.votes.get('global-only')).toBe(-1);
    expect(merged.votedArticles).toHaveLength(2);
  });
});

describe('parseUserScoringWeights', () => {
  it('returns defaults for null and malformed JSON', () => {
    expect(parseUserScoringWeights(null)).toEqual(defaultUserScoringWeights);
    expect(parseUserScoringWeights('{not json')).toEqual(defaultUserScoringWeights);
  });

  it('merges partial overrides onto the defaults', () => {
    const parsed = parseUserScoringWeights(JSON.stringify({ focus: { alpha: 0.9 } }));

    expect(parsed.focus.alpha).toBe(0.9);
    expect(parsed.focus.beta).toBe(defaultUserScoringWeights.focus.beta);
    expect(parsed.global).toEqual(defaultUserScoringWeights.global);
    expect(parsed.edition).toEqual(defaultUserScoringWeights.edition);
  });
});

describe('minConfidenceFilterSql', () => {
  it('returns null when no threshold applies', () => {
    expect(minConfidenceFilterSql({ minConfidence: 0 })).toBeNull();
    expect(minConfidenceFilterSql({ minConfidence: 0, perSource: new Map() })).toBeNull();
  });

  it('returns a filter for a plain threshold', () => {
    expect(minConfidenceFilterSql({ minConfidence: 0.5 })).not.toBeNull();
  });

  it('returns a filter when only per-source overrides exist', () => {
    expect(minConfidenceFilterSql({ minConfidence: 0, perSource: new Map([['src', 0.7]]) })).not.toBeNull();
  });
});
