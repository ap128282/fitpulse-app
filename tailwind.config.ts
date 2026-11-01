import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F10',
        card: '#1C1C1E',
        line: '#2C2C2E',
        lime: '#CCFF00',
        violet: '#6C5CE7',
        muted: '#8E8E93',
      },
    },
  },
  plugins: [],
};
export default config;
