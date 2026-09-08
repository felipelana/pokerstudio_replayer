/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The logo's palette: near-black grounds, dark greys, one red.
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
