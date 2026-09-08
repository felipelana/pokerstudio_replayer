import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The landing page is a static site of its own: no API, no shared runtime with
// the replayer. It only borrows the monorepo's stack and conventions.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5180,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
  },
});
