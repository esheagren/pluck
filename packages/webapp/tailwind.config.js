/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#2d3436',
        'primary-hover': '#1a1a1a',
        // Dark mode colors
        'dark-bg': '#0f0f0f',
        'dark-surface': '#1a1a1a',
        'dark-border': '#2a2a2a',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
