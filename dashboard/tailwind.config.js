/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens driven by CSS variables (see index.css)
        app: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)',
        },
        // WhatsApp brand accents
        wa: {
          DEFAULT: '#25D366',
          dark: '#128C7E',
          teal: '#075E54',
          light: '#DCF8C6',
        },
      },
    },
  },
  plugins: [],
};
