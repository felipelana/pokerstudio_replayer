/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The Vite shell, kept alongside Next.
 *
 * It renders the same `src` the Next app does, so it is a second way to open
 * the interface rather than a second copy of it. It stays until the Next build
 * has been in production long enough to be trusted alone.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pokerstudio/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
  server: {
    proxy: {
      // The API runs on its own port in development; same origin in production.
      '/api': { target: process.env.API_URL ?? 'http://localhost:3001', changeOrigin: true },
    },
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
