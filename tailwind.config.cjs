/**
 * One app serves the replayer and the landing page, and an app has one Tailwind
 * configuration. This is the union of the two that existed.
 *
 * The colours were already identical in both, because both only name CSS
 * variables; the landing adds four the replayer never used. The font stack is
 * the union of the two lists, so neither site loses a fallback it had. Nothing
 * here overrides a value the other side defined differently, which is what
 * makes the merge safe to make.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './landingpage/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        content: 'var(--text)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-deep': 'var(--accent-deep)',
        line: 'var(--border)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans',
          'Noto Sans CJK SC',
          'Noto Sans SC',
          'Noto Sans JP',
          'Noto Sans KR',
          'system-ui',
          'sans-serif',
        ],
        mono: ['Roboto Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        page: '1200px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
