import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          page: '#020410', // Deep Midnight
          card: '#0B0E17', // Rich Dark Blue (Background)
          elevated: '#131625', // Slightly lighter blue-black
          input: '#0B0E17',
        },
        border: 'var(--border)',
        text: {
          primary: '#FFFFFF', // Pure White for max contrast
          secondary: '#94A3B8', // Slate-400 for secondary text
          tertiary: '#64748B', // Slate-500
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          main: '#6366F1',
          hover: '#4F46E5',
          text: '#FFFFFF',
          soft: '#312E81',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      fontFamily: {
        sans: ['var(--font-orbitron)', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
        audiowide: ['var(--font-audiowide)', 'cursive'],
      },
      fontSize: {
        'display-lg': [
          '32px',
          {
            lineHeight: '40px',
            letterSpacing: '-0.02em',
            fontWeight: '600',
          },
        ],
        'display-md': [
          '24px',
          {
            lineHeight: '32px',
            fontWeight: '600',
          },
        ],
        'heading-lg': [
          '20px',
          {
            lineHeight: '28px',
            fontWeight: '600',
          },
        ],
        'heading-md': [
          '18px',
          {
            lineHeight: '28px',
            fontWeight: '500',
          },
        ],
        'heading-sm': [
          '16px',
          {
            lineHeight: '24px',
            fontWeight: '500',
          },
        ],
        'body-md': [
          '16px',
          {
            lineHeight: '24px',
            fontWeight: '400',
          },
        ],
        'body-sm': [
          '14px',
          {
            lineHeight: '20px',
            fontWeight: '400',
          },
        ],
        caption: [
          '12px',
          {
            lineHeight: '16px',
            fontWeight: '400',
          },
        ],
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: '16px',
        full: '9999px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
        '0.5': '2px',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.safe-top': {
          'padding-top': 'calc(env(safe-area-inset-top) + 16px)',
        },
        '.safe-bottom': {
          'padding-bottom': 'calc(env(safe-area-inset-bottom) + 16px)',
        },
        '.pb-safe-bottom': {
          'padding-bottom': 'env(safe-area-inset-bottom)',
        },
        '.glass-card': {
          background: 'rgba(11, 14, 23, 0.6)', // Semi-transparent dark blue
          'backdrop-filter': 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
        '.holographic-rim': {
          'box-shadow':
            '0 0 20px rgba(99, 102, 241, 0.15), inset 0 0 20px rgba(99, 102, 241, 0.05)', // Indigo glow
          border: '1px solid rgba(165, 180, 252, 0.2)', // Indigo-200 with low opacity
        },
      });
    }),
  ],
};
export default config;
