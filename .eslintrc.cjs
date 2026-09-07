module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'apps/web/scripts/*.ts'],
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
              { group: ['react', 'react-*', 'three', '@react-three/*', 'dexie', 'i18next', '@/*', '../../apps/*'], message: 'packages/shared must stay free of framework and app code.' },
            ],
          },
        ],
      },
    },
    {
      // The web app never imports server code directly — it talks HTTP.
      files: ['apps/web/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          { patterns: [{ group: ['**/apps/api/*', '@pokerstudio/api*'], message: 'The web app must reach the backend over HTTP only.' }] },
        ],
      },
    },
  ],
};
