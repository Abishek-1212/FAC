/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode - Deep blacks with cyan
        dark: {
          bg: '#0B0F19',
          card: '#151B2B',
          border: '#1E2738',
        },
        // Light mode - Sea blue and white theme
        light: {
          bg: '#F0F9FF',      // Very light blue
          card: '#FFFFFF',
          border: '#BAE6FD',  // Light blue border
          primary: '#0284C7', // Sea blue
          secondary: '#0EA5E9', // Sky blue
        },
        // Aqua colors
        aqua: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          900: '#164E63',
        },
        // Cyan accent
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.4)',
        'glow-cyan-sm': '0 0 15px rgba(6, 182, 212, 0.3)',
      },
    },
  },
  plugins: [],
}
