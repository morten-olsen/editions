process.env['EDITIONS_DB'] = ':memory:';
process.env['EDITIONS_JWT_SECRET'] = 'test-secret';

import { expect, it } from 'vitest';
import { createApp } from './app.ts';
import { ConfigService } from './config/config.ts';
import { DatabaseService } from './database/database.ts';
import { JobService } from './jobs/jobs.ts';
import { ReconcilerService } from './reconciler/reconciler.ts';

it('startup finishes pending analysis without changing existing scores', async () => {
  const app = await createApp({ logger: false });
  const config = app.services.get(ConfigService).config;
  config.scheduler.enabled = false;
  config.server.port = 0;
  const inference = {
    embed: async (): Promise<Float32Array> => new Float32Array([1, 0]),
    classify: async (text: string, labels: string[]): Promise<{ label: string; score: number }[]> =>
      labels.map((label) => ({ label, score: 0.9 })),
  };
  app.services.set(ReconcilerService, new ReconcilerService(app.services, inference));
  try {
    const db = await app.services.get(DatabaseService).getInstance();
    await db.insertInto('users').values({ id: 'u', username: 'user', role: 'admin' }).execute();
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
    await db.insertInto('focuses').values({ id: 'f', user_id: 'u', name: 'Focus' }).execute();
    await db
      .insertInto('articles')
      .values([
        {
          id: 'done',
          source_id: 's',
          external_id: 'done',
          title: 'Done',
          content: 'content',
          extracted_at: '2026-10-01',
          analysed_at: '2026-10-01',
        },
        {
          id: 'pending',
          source_id: 's',
          external_id: 'pending',
          title: 'Pending',
          content: 'content',
          extracted_at: '2026-10-01',
        },
      ])
      .execute();
    await db
      .insertInto('article_focuses')
      .values({
        article_id: 'done',
        focus_id: 'f',
        similarity: 0.123,
        similarity_model: 'earlier-model',
        nli: 0.456,
        nli_model: 'earlier-model',
      })
      .execute();
    const before = await db
      .selectFrom('article_focuses')
      .selectAll()
      .where('article_id', '=', 'done')
      .executeTakeFirstOrThrow();
    await app.start();
    await expect
      .poll(
        async () =>
          (await db.selectFrom('articles').select('analysed_at').where('id', '=', 'pending').executeTakeFirstOrThrow())
            .analysed_at,
      )
      .not.toBeNull();
    expect(
      await db.selectFrom('article_focuses').selectAll().where('article_id', '=', 'done').executeTakeFirstOrThrow(),
    ).toEqual(before);
    expect(app.services.get(JobService).listByUser(null)).toHaveLength(1);
  } finally {
    await app.stop();
  }
});
