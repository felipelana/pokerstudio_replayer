/**
 * The same theme as the Vite app, pointed at the same source. There is one copy
 * of the interface and both shells render it, so the two cannot drift while the
 * migration is under way.
 */
const shared = require('../web/tailwind.config.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', '../web/src/**/*.{ts,tsx}'],
  theme: shared.default ? shared.default.theme : shared.theme,
  plugins: [],
};
