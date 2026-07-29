import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DevChunkRecoveryCleanup } from '@/components/DevChunkRecoveryCleanup';
import { DeferredCjkFontsCss } from '@/components/DeferredCjkFontsCss';
import '../globals.css';

/**
 * X13 — the tour app's own ROOT layout.
 *
 * The guest app used to inherit the marketing site's root layout, and paid for
 * all of it on a phone, on tour-day cellular, while standing at a pickup point:
 *
 *   · `import enMessages from '@/messages/en.json'` — 169 KB of marketing copy,
 *     statically imported, for an app that ships its own bundled locale strings
 *   · `CurrencyProvider` — there is no price anywhere in a tour room
 *   · `SessionProvider` (supabase-js) — a guest enters by signed invite token,
 *     not by logging in
 *   · `AnalyticsPageViewTracker`, `Toaster` (sonner), `SpeedInsights`
 *   · `GlobalAiAssistant` and `WelcomeCouponPopupLazy` — both already refuse to
 *     RENDER under /tour-mode, but refusing to render is not refusing to ship:
 *     the chunks were in the bundle either way
 *
 * The evidence that dropping them is safe is not an argument, it is a scan: 193
 * modules are reachable from `app/(app)/tour-mode/**` and **none** imports
 * `lib/i18n`, `lib/currency`, `lib/auth-session`, the analytics tracker or the
 * global widgets. `__tests__/audit/routeGroupIsolation.test.ts` keeps it that
 * way — the day somebody adds one of those imports the guest app quietly starts
 * paying the marketing tax again, and nothing else in the repo would notice.
 *
 * ⚠ Two root layouts means `app/layout.tsx` must NOT exist. Every page lives
 * under `(app)` or `(marketing)`; only route handlers and metadata files remain
 * at the app root, and neither needs a layout.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Tour Mode — AtoC Korea',
  description: 'Your live tour room: guide chat, route, and departure alerts.',
  robots: { index: false, follow: false },
};

export default function AppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * `lang="en"` matches the marketing root deliberately, not lazily: the entry
     * screen resolves the guest's language on the SERVER from the NEXT_LOCALE
     * cookie + Accept-Language (`lib/tour-room/entryLocale.ts`, N6) and the room
     * shells repaint from the stored choice. A `cookies()` read here would force
     * every route dynamic — the regression the marketing root warns about.
     */
    <html lang="en" className="font-sans" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/*
         * 🔴 The fonts are NOT part of the marketing tax and must not be dropped
         * with it.
         *
         * `globals.css` writes `font-family: …, var(--font-inter), …`. An
         * undeclared custom property inside `var()` with no fallback makes the
         * WHOLE declaration invalid at computed-value time — the font stack
         * would not degrade gracefully, it would vanish and inherit. This repo
         * has already shipped that exact bug once with `--tr-on-accent`
         * (undeclared → invalid substitution → colour inherited → black text on
         * dark green). So `next/font` stays.
         *
         * Pretendard is the variable DYNAMIC-SUBSET build: ~13 KB of CSS whose
         * @font-face rules carry narrow unicode-ranges, so an English guest
         * downloads a few KB of font data. Korean and Japanese guests are a
         * large share of this app's users; dropping it would be a visible
         * downgrade, which is not what this ticket is buying.
         */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      {/*
        `lang-tour-app` is not decoration — see globals.css. Without it the room
        falls through to Tailwind's `.font-sans` and a Korean guest loses both
        the CJK fallbacks and the punctuation face that PR #580 added to stop
        full-width apostrophes. On the marketing site `I18nProvider` writes a
        `lang-*` class that does this job; this app deliberately has no provider.
      */}
      <body className={`${inter.variable} font-sans lang-tour-app antialiased`}>
        {/*
         * 🔴 No `relative z-[1]` wrapper here — and dropping it is only safe
         * because `globals.css` also hides `body::before` for `.lang-tour-app`.
         * Read that rule before touching either.
         *
         * The marketing root wraps children in such a wrapper for a reason:
         * `body::before` (the pastel mesh) is a POSITIONED pseudo-element, so it
         * paints above normal-flow content. Removing the wrapper without also
         * removing the mesh rendered this screen as a blank gradient with one
         * washed-out button, while `getComputedStyle` still reported the <h1>
         * as visible at 358x26. Only the screenshot caught it.
         *
         * Not re-adding the wrapper is the point: it would restore the stacking
         * context R8 found trapping the room's `fixed` overlays (z-[71]) under
         * its chrome (z-30). The tour-mode layout owns its own full-height
         * canvas, so with the mesh gone nothing needs lifting.
         */}
        <ErrorBoundary>
          <DevChunkRecoveryCleanup />
          {children}
        </ErrorBoundary>
        {/* Non-blocking: CJK faces arrive after first paint; system fallbacks
            in every stack render the glyphs until then, so no tofu. */}
        <DeferredCjkFontsCss />
      </body>
    </html>
  );
}
