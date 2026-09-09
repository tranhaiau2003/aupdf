/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#121212',
          800: '#1e1e1e',
          700: '#2a2a2a',
          600: '#383838',
          500: '#4a4a4a',
        },
        cyan: {
          brand: '#00e5ff'
        },
        magenta: {
          brand: '#ff007f'
        },
        yellow: {
          brand: '#ffd600'
        }
      }
    },
  },
  plugins: [],
}
