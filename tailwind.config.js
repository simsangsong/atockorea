/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
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
      boxShadow: {
        'design-sm': '0 1px 2px rgba(0,0,0,0.05)',
        'design-md': '0 4px 10px rgba(0,0,0,0.08)',
        'design-lg': '0 12px 24px rgba(0,0,0,0.10)',
      },
      borderRadius: {
        'design-lg': '20px',
        'design-md': '12px',
        'design-sm': '8px',
      },
      transitionDuration: {
        'motion-fast': '150ms',
        'motion-base': '200ms',
        'motion-slow': '220ms',
      },
      transitionTimingFunction: {
        'motion-ease': 'ease-out',
      },
    },
  },
  plugins: [],
}

