/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        aqua: {
          50: '#f0fdff',
          100: '#ccf7fe',
          200: '#99eefd',
          300: '#4de1f9',
          400: '#06cce8',
          500: '#00afc5',
          600: '#0089a6',
          700: '#006d87',
          800: '#00586e',
          900: '#00495c',
        },
      },
    },
  },
  plugins: [],
}
