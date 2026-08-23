import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `@tailwindcss/vite` resolves a different copy of Vite's types than Astro
 * bundles, so the plugin shape clashes at the type level while being correct
 * at runtime. Cast through Astro's own type rather than loosen the config.
 */
type VitePlugins = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>;

export default defineConfig({
  site: process.env.ASTRO_SITE || undefined,
  base: process.env.ASTRO_BASE || undefined,
  integrations: [mdx(), react()],
  vite: {
    plugins: tailwindcss() as unknown as VitePlugins,
  },
});
