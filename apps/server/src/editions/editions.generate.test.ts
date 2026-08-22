import { describe, expect, it } from 'vitest';

import { emptyVoteContext } from '../ranking/ranking.ts';

import { generateEdition } from './editions.generate.ts';
import type { CandidateRow, FocusGenerationInput } from './editions.generate.ts';

const NOW = Date.parse('2026-08-22T12:00:00Z');

// Confidence-only weights make ordering deterministic from `similarity`
const CONFIDENCE_ONLY = { alpha: 1, beta: 0, gamma: 0 };

const makeCandidate = (params: {
  id: string;
  sourceId: string;
  similarity?: number;
  consumptionTimeSeconds?: number | null;
}): CandidateRow => ({
  id: params.id,
  source_id: params.sourceId,
  published_at: new Date(NOW).toISOString(),
  consumption_time_seconds: params.consumptionTimeSeconds ?? null,
  similarity: params.similarity ?? 0.5,
  nli: null,
  embedding: null,
});

const makeFocus = (params: {
  focusId: string;
  candidates: CandidateRow[];
  budgetType?: 'count' | 'time';
  budgetValue?: number;
  weight?: number;
  excludePriorEditions?: boolean;
  sourceWeights?: Map<string, number>;
}): FocusGenerationInput => ({
  focusId: params.focusId,
  budgetType: params.budgetType ?? 'count',
  budgetValue: params.budgetValue ?? 10,
  weight: params.weight ?? 1,
  excludePriorEditions: params.excludePriorEditions ?? false,
  sourceWeights: params.sourceWeights ?? new Map(),
  candidates: params.candidates,
  voteContext: emptyVoteContext(),
});

// rng always returning 0 makes the weighted picker deterministic:
// it always picks the first source still in the pool
const firstSourceRng = (): number => 0;

const generate = (focuses: FocusGenerationInput[], excludedArticleIds = new Set<string>()) =>
  generateEdition({
    focuses,
    excludedArticleIds,
    editionWeights: CONFIDENCE_ONLY,
    rng: firstSourceRng,
    now: NOW,
  });

describe('generateEdition', () => {
  it('returns an empty edition for no focuses or no candidates', () => {
    expect(generate([])).toEqual({ articles: [], totalReadingSeconds: 0 });
    expect(generate([makeFocus({ focusId: 'f1', candidates: [] })])).toEqual({
      articles: [],
      totalReadingSeconds: 0,
    });
  });

  it('respects a count budget, taking the highest-scored articles first', () => {
    const result = generate([
      makeFocus({
        focusId: 'f1',
        budgetType: 'count',
        budgetValue: 2,
        candidates: [
          makeCandidate({ id: 'low', sourceId: 'src', similarity: 0.1 }),
          makeCandidate({ id: 'high', sourceId: 'src', similarity: 0.9 }),
          makeCandidate({ id: 'mid', sourceId: 'src', similarity: 0.5 }),
        ],
      }),
    ]);

    expect(result.articles.map((a) => a.articleId)).toEqual(['high', 'mid']);
    expect(result.articles.map((a) => a.position)).toEqual([0, 1]);
  });

  it('respects a reading-time budget in minutes', () => {
    const result = generate([
      makeFocus({
        focusId: 'f1',
        budgetType: 'time',
        budgetValue: 10,
        candidates: [
          makeCandidate({ id: 'a', sourceId: 'src', similarity: 0.9, consumptionTimeSeconds: 300 }),
          makeCandidate({ id: 'b', sourceId: 'src', similarity: 0.8, consumptionTimeSeconds: 300 }),
          makeCandidate({ id: 'c', sourceId: 'src', similarity: 0.7, consumptionTimeSeconds: 300 }),
        ],
      }),
    ]);

    // 300s = 5 minutes each; the 10-minute budget fits exactly two
    expect(result.articles.map((a) => a.articleId)).toEqual(['a', 'b']);
    expect(result.totalReadingSeconds).toBe(600);
  });

  it('never re-offers an article claimed by an earlier focus', () => {
    const shared = (): CandidateRow => makeCandidate({ id: 'shared', sourceId: 'src', similarity: 0.9 });

    const result = generate([
      makeFocus({ focusId: 'first', budgetValue: 1, candidates: [shared()] }),
      makeFocus({
        focusId: 'second',
        budgetValue: 2,
        candidates: [shared(), makeCandidate({ id: 'other', sourceId: 'src', similarity: 0.1 })],
      }),
    ]);

    expect(result.articles).toEqual([
      { articleId: 'shared', focusId: 'first', position: 0 },
      { articleId: 'other', focusId: 'second', position: 1 },
    ]);
  });

  it('excludes prior-edition articles only for focuses that opted in', () => {
    const excluded = new Set(['seen-before']);
    const candidates = (): CandidateRow[] => [
      makeCandidate({ id: 'seen-before', sourceId: 'src', similarity: 0.9 }),
      makeCandidate({ id: 'fresh', sourceId: 'src', similarity: 0.1 }),
    ];

    const excluding = generate(
      [makeFocus({ focusId: 'f1', excludePriorEditions: true, candidates: candidates() })],
      excluded,
    );
    expect(excluding.articles.map((a) => a.articleId)).toEqual(['fresh']);

    const including = generate(
      [makeFocus({ focusId: 'f1', excludePriorEditions: false, candidates: candidates() })],
      excluded,
    );
    expect(including.articles.map((a) => a.articleId)).toEqual(['seen-before', 'fresh']);
  });

  it('distributes picks across sources via the weighted picker', () => {
    // rng() = 0 always picks the first source in the pool, so source order is
    // deterministic: drain src-a, then src-b
    const result = generate([
      makeFocus({
        focusId: 'f1',
        budgetValue: 4,
        sourceWeights: new Map([
          ['src-a', 1],
          ['src-b', 1],
        ]),
        candidates: [
          makeCandidate({ id: 'b1', sourceId: 'src-b', similarity: 0.7 }),
          makeCandidate({ id: 'a1', sourceId: 'src-a', similarity: 0.99 }),
          makeCandidate({ id: 'a2', sourceId: 'src-a', similarity: 0.5 }),
          makeCandidate({ id: 'b2', sourceId: 'src-b', similarity: 0.6 }),
        ],
      }),
    ]);

    // src-a holds the top-scored article, so it heads the pool; within a
    // source, articles come out highest-score first
    expect(result.articles.map((a) => a.articleId)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('moves on when a source is exhausted before the budget is', () => {
    const result = generate([
      makeFocus({
        focusId: 'f1',
        budgetValue: 3,
        candidates: [
          makeCandidate({ id: 'a1', sourceId: 'src-a', similarity: 0.9 }),
          makeCandidate({ id: 'b1', sourceId: 'src-b', similarity: 0.8 }),
          makeCandidate({ id: 'b2', sourceId: 'src-b', similarity: 0.7 }),
        ],
      }),
    ]);

    expect(result.articles.map((a) => a.articleId)).toEqual(['a1', 'b1', 'b2']);
  });

  it('sums reading time across focuses and assigns global positions', () => {
    const result = generate([
      makeFocus({
        focusId: 'f1',
        budgetValue: 1,
        candidates: [makeCandidate({ id: 'a', sourceId: 'src', consumptionTimeSeconds: 120 })],
      }),
      makeFocus({
        focusId: 'f2',
        budgetValue: 1,
        candidates: [makeCandidate({ id: 'b', sourceId: 'src', consumptionTimeSeconds: 60 })],
      }),
    ]);

    expect(result.articles.map((a) => a.position)).toEqual([0, 1]);
    expect(result.totalReadingSeconds).toBe(180);
  });
});
