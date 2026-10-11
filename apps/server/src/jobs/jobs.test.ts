import { expect, it } from 'vitest';
import { Services } from '../services/services.ts';
import { JobService } from './jobs.ts';

it('runs one job at a time and coalesces repeated active source work', async () => {
  const jobs = new JobService(new Services());
  let release: () => void = () => {};
  let calls = 0;
  jobs.register('refresh_source', async () => {
    calls++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const first = jobs.enqueue('refresh_source', { sourceId: 's', userId: 'u' });
  expect(jobs.enqueue('refresh_source', { sourceId: 's', userId: 'u' }).id).toBe(first.id);
  const second = jobs.enqueue('refresh_source', { sourceId: 'other', userId: 'u' });
  expect(calls).toBe(1);
  expect(second.status).toBe('pending');
  release();
  await expect.poll(() => calls).toBe(2);
  release();
  await expect.poll(() => second.status).toBe('completed');
});

it('rejects excess queued work without retaining its payload', () => {
  const jobs = new JobService(new Services());
  jobs.register('reconcile_focus', async () => new Promise<void>(() => {}));
  for (let i = 0; i <= 128; i++) jobs.enqueue('reconcile_focus', { focusId: String(i) });
  expect(() => jobs.enqueue('reconcile_focus', { focusId: 'overflow' })).toThrow('queue is full');
});
