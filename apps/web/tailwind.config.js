/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        content: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        line: 'var(--border)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'Noto Sans CJK SC', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
