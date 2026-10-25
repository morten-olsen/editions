import { expect, it, vi } from 'vitest';
import { createTestApp } from '../test-helpers.ts';
import { JobService } from '../jobs/jobs.ts';
import { SchedulerService } from './scheduler.ts';

it('holds a due edition during analysis and retries after analysis finishes', async () => {
  const t = await createTestApp();
  try {
    const userId = 'u';
    const db = await t.db();
    await db.insertInto('users').values({ id: userId, username: 'user', role: 'admin' }).execute();
    await db.insertInto('focuses').values({ id: 'f', user_id: userId, name: 'Focus' }).execute();
    await db
      .insertInto('edition_configs')
      .values({
        id: 'e',
        user_id: userId,
        name: 'Daily',
        schedule: '* * * * *',
        enabled: 1,
        lookback_hours: 24,
        exclude_prior_editions: 0,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({ edition_config_id: 'e', focus_id: 'f', position: 0, budget_type: 'count', budget_value: 1 })
      .execute();
    const jobs = t.services.get(JobService);
    let release: () => void = () => {};
    jobs.register(
      'recover_analysis',
      async () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const job = jobs.enqueue('recover_analysis', {}, {});
    const scheduler = new SchedulerService(
      t.services,
      { enabled: false, fetchIntervalMinutes: 60 },
      { info: () => {}, error: () => {} },
    );
    await scheduler.tick();
    expect(await db.selectFrom('editions').select('id').execute()).toEqual([]);
    release();
    await expect.poll(() => job.status).toBe('completed');
    await scheduler.tick();
    expect(await db.selectFrom('editions').select('id').execute()).toHaveLength(1);
  } finally {
    await t.stop();
  }
});

it('publishes a due edition between failed feed retries', async () => {
  const t = await createTestApp();
  const fetchMock = vi.fn().mockResolvedValue(new Response('Unavailable', { status: 503 }));
  const retry = Promise.withResolvers<Response>();
  vi.stubGlobal('fetch', fetchMock);
  try {
    const user = await t.register();
    const db = await t.db();
    await db
      .insertInto('sources')
      .values({
        id: 'failed-feed',
        user_id: user.id,
        name: 'Unavailable feed',
        type: 'rss',
        direction: 'newest',
        url: 'https://example.com/feed',
        config: '{}',
      })
      .execute();
    await db.insertInto('focuses').values({ id: 'focus', user_id: user.id, name: 'Focus' }).execute();
    await db
      .insertInto('edition_configs')
      .values({
        id: 'daily',
        user_id: user.id,
        name: 'Daily',
        schedule: '* * * * *',
        enabled: 1,
        lookback_hours: 24,
        exclude_prior_editions: 0,
      })
      .execute();
    await db
      .insertInto('edition_config_focuses')
      .values({
        edition_config_id: 'daily',
        focus_id: 'focus',
        position: 0,
        budget_type: 'count',
        budget_value: 1,
      })
      .execute();
    const jobs = t.services.get(JobService);
    const failure = jobs.enqueue(
      'refresh_source',
      { sourceId: 'failed-feed', userId: user.id },
      {
        userId: user.id,
        affects: { sourceIds: ['failed-feed'] },
      },
    );
    await expect.poll(() => failure.status).toBe('failed');
    expect(failure.error).toContain('HTTP 503');
    fetchMock.mockReturnValueOnce(retry.promise);
    const scheduler = new SchedulerService(
      t.services,
      { enabled: false, fetchIntervalMinutes: 60 },
      {
        info: () => {},
        error: () => {},
      },
    );
    await scheduler.tick();
    const response = await t.inject({
      method: 'GET',
      url: '/api/editions/configs/daily/editions',
      headers: user.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(1);
    // The failed feed is still retried, without consuming another edition slot.
    retry.resolve(new Response('Unavailable', { status: 503 }));
    await expect.poll(() => jobs.listByUser(user.id).filter((job) => job.status === 'failed').length).toBe(2);
    await scheduler.tick();
    const repeated = await t.inject({
      method: 'GET',
      url: '/api/editions/configs/daily/editions',
      headers: user.headers,
    });
    expect(repeated.json().total).toBe(1);
  } finally {
    retry.resolve(new Response('Unavailable', { status: 503 }));
    vi.unstubAllGlobals();
    await t.stop();
  }
});
