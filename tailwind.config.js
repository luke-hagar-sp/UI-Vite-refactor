/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,ts,css}'],
  darkMode: 'class',
  corePlugins: {
    // preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Custom colors for v4
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    }
  }
}
