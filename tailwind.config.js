/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:  { DEFAULT: '#FAF7F2', light: '#FFFCF7' },
        terra:  { DEFAULT: '#C97B5C', dark: '#A55F44'  },
        ink:    { DEFAULT: '#1A1612', muted: '#6B6358'  },
        border: '#E8E2D8',
      },
      fontFamily: {
        serif:  ['"Syne"', 'sans-serif'],
        sans:   ['Inter', 'system-ui', 'sans-serif'],
        mono:   ['"JetBrains Mono"', 'monospace'],
        accent: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
