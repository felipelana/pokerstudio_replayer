module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'scripts/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
  overrides: [
    {
      // The shared contracts are pure data: no framework, no I/O, no app code.
      files: ['packages/shared/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['react', 'react-*', 'three', '@react-three/*', 'dexie', 'i18next', '@/*', '../../src/server/*'], message: 'packages/shared must stay free of framework and app code.' },
            ],
          },
        ],
      },
    },
    {
      // The interface never imports server code directly — it talks HTTP.
      // The route handler under src/app is the one place that may, because it
      // is the adapter: it is what turns a web Request into a Fastify one.
      files: ['src/{features,components,lib,domain,i18n}/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [{ group: ['@/server/*', '**/src/server/*'], message: 'The web app must reach the backend over HTTP only.' }] },
        ],
      },
    },
  ],
};
