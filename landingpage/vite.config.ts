import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The landing page is a static site of its own: no API and no runtime tie to
// the replayer. The one thing it does share is the room catalogue, which is
// pure data bundled at build time, so the grid here and the importer there
// cannot disagree about which rooms are supported.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pokerstudio/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
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
