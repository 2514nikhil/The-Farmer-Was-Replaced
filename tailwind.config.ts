import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        farm: {
          bg: '#f5f0e8',
          panel: '#ffffff',
          'panel-border': '#d4c4a8',
          accent: '#c45a2a',
          'accent-hover': '#a84820',
          gold: '#d4a017',
          green: '#4a7c2e',
          'green-light': '#6bb33e',
          brown: '#8b6914',
          soil: '#a67c52',
          sky: '#87ceeb',
          grass: '#5d9b3b',
          text: '#3d3528',
          'text-muted': '#7a6f5e',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 2px 8px rgba(61, 53, 40, 0.08), 0 0 0 1px #d4c4a8',
        'panel-hover': '0 4px 16px rgba(196, 90, 42, 0.15), 0 0 0 1px #c45a2a',
        'inner-panel': 'inset 0 2px 4px rgba(61, 53, 40, 0.05)',
      },
    },
  },
  plugins: [],
};
export default config;
