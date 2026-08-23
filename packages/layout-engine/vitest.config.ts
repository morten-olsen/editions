import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * The engine measures text with a canvas and reads computed styles off live
 * elements. jsdom can do neither, so these tests run in a real browser.
 */
export default defineConfig({
  test: {
    name: 'layout-engine',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
