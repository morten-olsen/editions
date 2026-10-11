import { expect, it } from 'vitest';
import { createTestApp } from '../test-helpers.ts';
import { FocusesService } from '../focuses/focuses.ts';
import { VotesService } from '../votes/votes.ts';
import { generateEdition, loadGenerationInputs } from './editions.generate.ts';

it('ranks every page while retaining only budget-bounded candidates for later focuses', async () => {
  const t = await createTestApp();
  try {
    const db = await t.db();
    await db
      .insertInto('users')
      .values({
        id: 'u',
        username: 'u',
        role: 'admin',
        scoring_weights: JSON.stringify({ edition: { alpha: 1, beta: 0, gamma: 0 } }),
      })
      .execute();
    await db
      .insertInto('sources')
      .values({
        id: 's',
        user_id: 'u',
        type: 'rss',
        name: 'Source',
        url: 'https://example.com',
        config: '{}',
        direction: 'ltr',
      })
      .execute();
    for (const id of ['f1', 'f2']) {
      await db.insertInto('focuses').values({ id, user_id: 'u', name: id, min_confidence: 0 }).execute();
      await db.insertInto('focus_sources').values({ focus_id: id, source_id: 's', weight: 1 }).execute();
    }
    for (let i = 0; i < 140; i++) {
      const id = String(i).padStart(3, '0');
      await db
        .insertInto('articles')
        .values({
          id,
          source_id: 's',
          external_id: id,
          title: id,
          content: 'Text',
          published_at: new Date().toISOString(),
          consumption_time_seconds: 60,
        })
        .execute();
      await db
        .insertInto('article_embeddings')
        .values({ article_id: id, embedding: Buffer.from(new Float32Array([1, 0]).buffer), model: 'test' })
        .execute();
      for (const focus of ['f1', 'f2'])
        await db
          .insertInto('article_focuses')
          .values({ article_id: id, focus_id: focus, similarity: i / 140, similarity_model: 'test' })
          .execute();
    }
    await db
      .insertInto('edition_configs')
      .values({
        id: 'config',
        user_id: 'u',
        name: 'Prior',
        schedule: '* * * * *',
        lookback_hours: 24,
        exclude_prior_editions: 1,
        enabled: 1,
      })
      .execute();
    await db
      .insertInto('editions')
      .values({ id: 'prior', edition_config_id: 'config', title: 'Prior', article_count: 1, current_position: 0 })
      .execute();
    await db
      .insertInto('edition_articles')
      .values({ edition_id: 'prior', article_id: '139', focus_id: 'f1', position: 0 })
      .execute();
    const inputs = await loadGenerationInputs({
      db,
      focusesService: t.services.get(FocusesService),
      votesService: t.services.get(VotesService),
      userId: 'u',
      configId: 'unused',
      defaultLookbackHours: 24,
      defaultExcludePriorEditions: false,
      focuses: ['f1', 'f2'].map((focusId, position) => ({
        focusId,
        position,
        budgetType: 'count',
        budgetValue: 1,
        lookbackHours: null,
        excludePriorEditions: null,
        weight: 1,
      })),
    });
    expect(generateEdition({ ...inputs, rng: () => 0 }).articles.map((a) => a.articleId)).toEqual(['139', '138']);
    expect(inputs.focuses.map((f) => f.candidates.length)).toEqual([2, 2]);
    expect(inputs.focuses.flatMap((f) => f.candidates).every((c) => c.embedding === null)).toBe(true);
    const exclude = await loadGenerationInputs({
      db,
      focusesService: t.services.get(FocusesService),
      votesService: t.services.get(VotesService),
      userId: 'u',
      configId: 'config',
      defaultLookbackHours: 24,
      defaultExcludePriorEditions: true,
      focuses: ['f1', 'f2'].map((focusId, position) => ({
        focusId,
        position,
        budgetType: 'count',
        budgetValue: 1,
        lookbackHours: null,
        excludePriorEditions: position === 0,
        weight: 1,
      })),
    });
    expect(generateEdition({ ...exclude, rng: () => 0 }).articles.map((a) => a.articleId)).toEqual(['138', '139']);
    expect(exclude.excludedArticleIds.size).toBe(0);

    // Propagation must be scored before page embeddings are discarded.
    await db
      .updateTable('users')
      .set({ scoring_weights: JSON.stringify({ edition: { alpha: 0, beta: 1, gamma: 0 } }) })
      .where('id', '=', 'u')
      .execute();
    await db
      .updateTable('article_embeddings')
      .set({ embedding: Buffer.from(new Float32Array([0, 1]).buffer) })
      .where('article_id', 'in', ['138', '139'])
      .execute();
    await db.insertInto('article_votes').values({ id: 'vote', user_id: 'u', article_id: '000', value: 1 }).execute();
    const voted = await loadGenerationInputs({
      db,
      focusesService: t.services.get(FocusesService),
      votesService: t.services.get(VotesService),
      userId: 'u',
      configId: 'unused',
      defaultLookbackHours: 24,
      defaultExcludePriorEditions: false,
      focuses: ['f1', 'f2'].map((focusId, position) => ({
        focusId,
        position,
        budgetType: 'count',
        budgetValue: 1,
        lookbackHours: null,
        excludePriorEditions: null,
        weight: 1,
      })),
    });
    expect(generateEdition({ ...voted, rng: () => 0 }).articles.map((a) => a.articleId)).toEqual(['137', '136']);
  } finally {
    await t.stop();
  }
});
