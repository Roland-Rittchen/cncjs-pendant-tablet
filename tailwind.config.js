/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark industrial palette
        surface: {
          DEFAULT: '#0d0d14',
          raised: '#161621',
          card: '#1c1c2a',
          border: '#2a2a3d',
        },
        accent: {
          blue: '#3b82f6',
          green: '#22c55e',
          red: '#ef4444',
          amber: '#f59e0b',
          cyan: '#06b6d4',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      fontSize: {
        'dro': ['2rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'dro-sm': ['1.5rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
}
