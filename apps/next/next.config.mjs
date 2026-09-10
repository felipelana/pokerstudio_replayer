import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The replayer, served by Next.
 *
 * There is no second copy of the interface: `@` points at the same `src` the
 * Vite app renders, so the two shells cannot drift while the migration is under
 * way. `standalone` is what keeps the production image small.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  // The shared package ships TypeScript source, not a build.
  transpilePackages: ['@pokerstudio/shared'],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // An import ending in '?url' is how Vite asks for a file to be emitted
    // and for its address back. The same request is honoured here, so the
    // import in the library page is left exactly as it is. The same request is honoured here, so the import in the
    // library page is left exactly as it is.
    config.module.rules.push({ resourceQuery: /url/, type: 'asset/resource' });

    // The shared package writes its relative imports with a .js suffix,
    // because the API consumes it as ESM. The files themselves are TypeScript,
    // so the suffix is mapped rather than the package being changed.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(here, '../web/src'),
      '@pokerstudio/shared': path.resolve(here, '../../packages/shared/src/index.ts'),
    };
    return config;
  },
};

export default nextConfig;
