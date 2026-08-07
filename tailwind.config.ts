import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bch: {
          navy: '#1e3a5f',
          'navy-light': '#2c5282',
          accent: '#2563eb',
          bg: '#f8fafc',
          card: '#ffffff',
          ink: '#1e293b',
          muted: '#64748b',
          line: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
