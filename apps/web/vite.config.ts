import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ quoteStyle: 'double' }), react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    host: process.env.HOST ?? undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3007',
        changeOrigin: true,
      },
    },
  },
});
