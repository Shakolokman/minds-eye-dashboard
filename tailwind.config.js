/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#2B3841',
          darker: '#1E2A31',
          darkest: '#151E24',
          gold: '#E1C36E',
          'gold-light': '#F0D88A',
          'gold-dim': '#B8A05A',
          slate: '#3A4D58',
          'slate-light': '#4A6070',
          muted: '#A8BFCC',
          surface: '#324049',
          'surface-light': '#3D4F5A',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
