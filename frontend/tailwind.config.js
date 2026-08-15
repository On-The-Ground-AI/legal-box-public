/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#0A0A0A",
          "black-hover": "#1A1A1A",
          orange: "#E05A1E",
          "orange-hover": "#C4481A",
          "orange-pale": "#FEF3EE",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'typing-dot': 'typingDot 1.2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typingDot: {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '30%':           { opacity: '1',   transform: 'scale(1.2)' },
        },
      },
    },
  },
  plugins: [],
}
