/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'] },
      colors: { apple: { text: '#1d1d1f', subtext: '#555555', blue: '#0066cc', blueHover: '#0071e3', red: '#e30000' } },
      keyframes: { flow: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } } },
      animation: { 'flow-current': 'flow 1.5s linear infinite' }
    }
  },
  plugins: [],
}
