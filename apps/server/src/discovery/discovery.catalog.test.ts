import { describe, it, expect } from 'vitest';

import { discoverySources } from './discovery.catalog.ts';

describe('discovery catalog URLs', () => {
  for (const source of discoverySources) {
    it(`${source.name} (${source.url}) is reachable`, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const res = await fetch(source.url, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Editions/1.0 (feed validator)' },
        });

        // Accept any 2xx or 3xx — some feeds return 200, others redirect
        // Also accept 405 (Method Not Allowed for HEAD) — retry with GET
        if (res.status === 405) {
          const getRes = await fetch(source.url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'Editions/1.0 (feed validator)' },
          });
          expect(getRes.ok, `${source.name}: expected 2xx, got ${getRes.status}`).toBe(true);
        } else {
          expect(res.ok, `${source.name}: expected 2xx, got ${res.status}`).toBe(true);
        }
      } finally {
        clearTimeout(timeout);
      }
    }, 15_000);
  }
});
