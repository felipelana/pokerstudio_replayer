import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The landing page is a static site of its own: no API and no runtime tie to
// the replayer. The one thing it does share is the room catalogue, which is
// pure data bundled at build time, so the grid here and the importer there
// cannot disagree about which rooms are supported.

/**
 * The public settings are named the way Next names them, so one line of source
 * serves both bundlers. Vite does not hand process.env to the browser, so the
 * five values are substituted here at build time, read from the same .env files
 * as before, with the old VITE_ names still accepted.
 *
 * A setting nobody gave becomes the literal `undefined` rather than an empty
 * string, because the source falls back with `??` and an empty string would
 * pass that test and win.
 */
const PUBLIC = [
  'NEXT_PUBLIC_REPLAYER_URL',
  'NEXT_PUBLIC_REPLAYER_URL_PROD',
  'NEXT_PUBLIC_REPLAYER_URL_STAGING',
  'NEXT_PUBLIC_REPLAYER_URL_DEV',
  'NEXT_PUBLIC_SITE_URL',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const define = Object.fromEntries(
    PUBLIC.map((name) => {
      const value = env[name] ?? env[name.replace('NEXT_PUBLIC_', 'VITE_')];
      return [`process.env.${name}`, value ? JSON.stringify(value) : 'undefined'];
    }),
  );

  return {
    define,
    plugins: [react()],
    base: './',
    resolve: {
      alias: {
        '@landing': path.resolve(__dirname, './src'),
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
  };
});
