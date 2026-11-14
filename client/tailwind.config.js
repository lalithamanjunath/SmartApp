/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        muted: '#6d778b',
        canvas: '#f6f7fb',
        line: '#e8eaf0',
        indigo: { 50: '#f0f0ff', 100: '#e5e5ff', 500: '#6259e8', 600: '#4f46e5', 700: '#4338ca' },
        citrus: '#d5f36a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 32px rgba(27, 39, 71, .06)',
      },
      borderRadius: {
        xl2: '1.125rem',
      },
    },
  },
  plugins: [],
};
