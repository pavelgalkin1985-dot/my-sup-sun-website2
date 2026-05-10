/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
          sans: ['Manrope', 'sans-serif'],
          display: ['Unbounded', 'sans-serif'], 
      },
      colors: {
          ocean: {
              deep: '#010A15',    
              mid: '#041E3A',     
              surface: '#0055FF', 
              cyan: '#00F0FF',    
          },
          sun: {
              glow: '#FFD700',
              core: '#FFF5D1'
          }
      },
      animation: {
          'float': 'float 8s ease-in-out infinite',
          'bubble': 'bubble 15s linear infinite',
          'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'pulse-icon': 'pulseIcon 2s infinite',
          'sunset': 'sunset 6s ease-in-out infinite alternate',
          'sunset-reflection': 'sunsetReflection 6s ease-in-out infinite alternate',
          'ripple': 'ripple 4s linear infinite',
      },
      keyframes: {
          float: {
              '0%, 100%': { transform: 'translateY(0) translateX(0)' },
              '50%': { transform: 'translateY(-15px) translateX(5px)' },
          },
          bubble: {
              '0%': { transform: 'translateY(100vh) scale(0)', opacity: '0' },
              '10%': { opacity: '0.6' },
              '90%': { opacity: '0.6' },
              '100%': { transform: 'translateY(-100px) scale(1.5)', opacity: '0' },
          },
          pulseIcon: {
              '0%, 100%': { transform: 'scale(1)', opacity: '1' },
              '50%': { transform: 'scale(1.2)', opacity: '0.8', color: '#00F0FF' },
          },
          sunset: {
              '0%': { transform: 'translateY(-30px) scale(1)', backgroundColor: '#FFD700', boxShadow: '0 0 40px #FFD700' },
              '100%': { transform: 'translateY(40px) scale(0.9)', backgroundColor: '#FF3300', boxShadow: '0 0 50px #FF3300' },
          },
          sunsetReflection: {
              '0%': { opacity: '0.8', width: '40px', backgroundColor: '#FFD700' },
              '100%': { opacity: '0.2', width: '15px', backgroundColor: '#FF3300' },
          },
          ripple: {
              '0%': { transform: 'scale(0.8)', opacity: '1', borderWidth: '2px' },
              '100%': { transform: 'scale(2.5)', opacity: '0', borderWidth: '0px' },
          }
      }
    }
  },
  plugins: [],
}
