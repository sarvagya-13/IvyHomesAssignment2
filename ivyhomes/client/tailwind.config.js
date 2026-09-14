/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#171a1c', muted: '#5c6367', soft: '#858c90' },
        paper: { DEFAULT: '#fbfaf8', raised: '#ffffff', sunk: '#f3f1ed' },
        line: { DEFAULT: '#e4e1db', strong: '#d2cec6' },
        moss: { 50: '#f1f5f2', 100: '#dde7e0', 500: '#3f6b52', 600: '#33573f', 700: '#26412f' },
        clay: { 50: '#fdf3ef', 500: '#b4562f', 600: '#94472a' },
        flag: { 50: '#fdf6ec', 500: '#a8761f' },
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,26,28,.04), 0 1px 1px rgba(23,26,28,.03)',
        lift: '0 4px 16px rgba(23,26,28,.08), 0 1px 2px rgba(23,26,28,.04)',
      },
      borderRadius: { card: '4px' },
    },
  },
  plugins: [],
};
