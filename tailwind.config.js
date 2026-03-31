/** @type {import('tailwindcss').Config} */
// Avoid `./components/**/*`: v0 export folders `components/b_<id>/` include their own node_modules;
// Tailwind would scan that tree and dev compile of `/` can hang.
const COMPONENT_SUBDIRS = [
  'admin',
  'auth',
  'charts',
  'Detailpage',
  'itinerary',
  'list',
  'maps',
  'mypage',
  'optimized',
  'planner',
  'reviews',
  'sangsong027 detailpage',
  'tour',
  'tours',
  'tour-detail-template',
  'ui',
];

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/*.{js,ts,jsx,tsx,mdx}',
    ...COMPONENT_SUBDIRS.map((d) => `./components/${d}/**/*.{js,ts,jsx,tsx,mdx}`),
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // sans 기본을 Pretendard로 (globals.css CDN + font-sans 유틸)
        sans: ['Pretendard', 'sans-serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        ring: 'var(--ring)',
        input: 'var(--input)',
        /** Matches v0 / shadcn-style `gray-150` used by tour-detail-template */
        gray: {
          150: '#ebebeb',
        },
        // Design system semantic colors (src/design/tokens.ts)
        brand: {
          navy: '#0A1F44',
          blue: '#1E4EDF',
          ocean: '#2EC4B6',
        },
        status: {
          success: '#228B22',
          warning: '#FF8C00',
          error: '#DC2626',
          info: '#1E4EDF',
          neutral: '#E1E5EA',
        },
      },
      minHeight: {
        touch: '44px',
      },
      spacing: {
        13: '3.25rem',
        14: '3.5rem',
        18: '4.5rem',
        22: '5.5rem',
        /** v0 tour-detail-template close button (`w-4.5 h-4.5`) */
        4.5: '1.125rem',
      },
      boxShadow: {
        'design-sm': '0 1px 2px rgba(0,0,0,0.05)',
        'design-md': '0 4px 10px rgba(0,0,0,0.08)',
        'design-lg': '0 12px 24px rgba(0,0,0,0.10)',
        'home-panel': 'var(--home-shadow-panel), 0 0 0 1px rgba(15, 23, 42, 0.035)',
        'home-neutral-card':
          'var(--home-shadow-neutral-card), 0 0 0 1px rgba(15, 23, 42, 0.032)',
        'home-offer-base': 'var(--home-shadow-offer-base)',
        'home-offer-featured-hover': 'var(--home-shadow-offer-featured-hover)',
        'home-offer-smgroup': 'var(--home-shadow-offer-smgroup)',
        'home-offer-smgroup-hover': 'var(--home-shadow-offer-smgroup-hover)',
        'home-offer-private': 'var(--home-shadow-offer-private)',
        'home-offer-private-hover': 'var(--home-shadow-offer-private-hover)',
        'home-offer-bus': 'var(--home-shadow-offer-bus)',
        'home-offer-bus-hover': 'var(--home-shadow-offer-bus-hover)',
        'home-hero-match': 'var(--home-shadow-hero-match)',
        'home-hero-match-hover': 'var(--home-shadow-hero-match-hover)',
      },
      borderRadius: {
        'design-lg': '20px',
        'design-md': '12px',
        'design-sm': '8px',
        'home-card': 'var(--home-radius-card)',
        'home-card-md': 'var(--home-radius-card-md)',
        'home-card-sm': 'var(--home-radius-card-sm)',
        'home-input': 'var(--home-radius-input)',
      },
      transitionDuration: {
        'motion-fast': '150ms',
        'motion-base': '200ms',
        'motion-slow': '220ms',
        /** v0 tour-detail-template card hover transitions */
        400: '400ms',
      },
      transitionTimingFunction: {
        'motion-ease': 'ease-out',
      },
    },
  },
  plugins: [],
}

