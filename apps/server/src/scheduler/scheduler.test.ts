import { expect, it } from 'vitest';
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
