/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#171512',
        paper: '#FAFAF7',
        emerald: {
          DEFAULT: '#0B6E4F',
          dark: '#08543C',
          light: '#E7F2ED',
        },
        gold: '#C08A2E',
        coral: '#E8604C',
        line: '#E4E1D8',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};