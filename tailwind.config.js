/** @type {import('tailwindcss').Config} */
// Avoid `./components/**/*`: v0 export folders `components/b_<id>/` include their own node_modules;
// Tailwind would scan that tree and dev compile of `/` can hang.
const COMPONENT_SUBDIRS = [
  'admin',
  'app-shell',
  'auth',
  'charts',
  'Detailpage',
  'home',
  'itinerary',
  'itinerary-builder',
  'list',
  'maps',
  'mypage',
  'optimized',
  'planner',
  'product-tour-static',
  'reviews',
  'sangsong027 detailpage',
  'tour',
  'tours',
  'tour-detail-template',
  'tour-detail',
  'ui',
];

module.exports = {
  // Phase D.1 (docs/app-shell-uiux-master-plan-2026-05-17.md): class-based dark
  // mode so next-themes can switch by toggling `class="dark"` on <html>.
  // Default `'media'` ignores user toggle and follows OS only — we want both.
  darkMode: 'class',
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
      /**
       * Typography scale — prefer these tokens over arbitrary values
       * (`text-[12.5px]` etc.) to keep vertical rhythm consistent.
       */
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':['3rem',     { lineHeight: '1.05' }],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        ring: 'var(--ring)',
        input: 'var(--input)',
        /**
         * shadcn / CVA buttons use `bg-primary`, `text-primary-foreground`, `from-primary`, etc.
         * Values come from `app/globals.css` @layer base (`:root` / `.dark`) and, on the home v2
         * body, from `app/home-v2-fidelity.css` (`.home-v2-body-isolate`).
         */
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
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
        /** Matches v0 / shadcn-style `gray-150` used by tour-detail-template */
        gray: {
          150: '#ebebeb',
        },
        /** v0 hero disabled tiles use `border-slate-150/50` */
        slate: {
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
        /**
         * Home v2 page — luxury CTA / chips (aligned with inline #1e3a5f / #172d4a family).
         * Use `from-home-v2-navy-800 to-home-v2-navy-900` etc.; keeps theme `primary` independent.
         */
        homeV2: {
          navy: {
            950: '#0f141c',
            900: '#172d4a',
            875: '#1a3556',
            850: '#152d4d',
            800: '#1e3a5f',
            750: '#234a78',
            700: '#264d7d',
          },
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

