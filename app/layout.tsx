import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
// home-v2.css and home-v2-fidelity.css are imported by components/home/HomeMainBody so they
// only ship on the homepage route. home-premium.css remains in globals.css because its
// `--home-*` tokens are referenced by Tailwind shadow classes on /match and /mypage too.
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { SessionProvider } from "@/lib/auth-session";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DevChunkRecoveryCleanup } from "@/components/DevChunkRecoveryCleanup";
import { LocaleCurrencySync } from "@/components/LocaleCurrencySync";
import { AnalyticsPageViewTracker } from "@/components/analytics/AnalyticsPageViewTracker";
import { GlobalAiAssistant } from "@/components/GlobalAiAssistant";
import { DeferredCjkFontsCss } from "@/components/DeferredCjkFontsCss";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Korea Day Tours Checked by Our Team",
  description: "Korea day tours checked by our team before they're listed, with routes, guides, and local operations reviewed on the ground.",
  url: '/',
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationStructuredData = generateStructuredData('Organization', {});
  const websiteStructuredData = generateStructuredData('WebSite', {});
  // Origin of the Supabase project — first fetch target on nearly every page, so warm
  // DNS + TLS during head parse to shave ~300ms off cold visits (C2).
  const supabaseOrigin = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin || null;
    } catch {
      return null;
    }
  })();

  return (
    // Static `lang="en"` (no cookie read) so the whole site can be statically
    // rendered / ISR'd and served from the CDN edge instead of a per-request
    // dynamic SSR — the prior `cookies()` read here forced EVERY route dynamic,
    // which dominated TTFB for far-from-origin (e.g. US) visitors. I18nProvider
    // corrects documentElement.lang to the active locale on hydration (i18n.ts).
    <html lang="en" className="font-sans" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Preconnect to webfont CDNs so DNS + TLS finish before the stylesheet links resolve. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Supabase project origin — warms DNS + TLS before the first data fetch (C2). */}
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        {/*
         * Pretendard — the VARIABLE dynamic-subset build: CSS is ~13 KB gzipped and every
         * @font-face carries a narrow unicode-range pointing at a small per-range woff2
         * chunk, so an English page downloads only a few KB of font data. (The previous
         * `static/pretendard.min.css` looked identical but its woff2 files were the FULL
         * 750 KB-per-weight fonts — ~3.8 MB on every first visit, the dominant cost in
         * the 2026-07-04 Lighthouse baseline.)
         */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/*
         * Noto Sans JP/SC/TC + Noto Serif KR moved out of the render-blocking path:
         * their combined css2 stylesheet is ~517 KB gzipped (thousands of @font-face
         * blocks), which alone added seconds to FCP on 4G. DeferredCjkFontsCss injects
         * the same stylesheet after first paint; until it loads, the system CJK
         * fallbacks already listed in every font stack (PingFang / Meiryo / Malgun…)
         * render the glyphs, so nothing shows tofu.
         */}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationStructuredData),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData),
          }}
        />
        <Suspense fallback={null}>
          <ErrorBoundary>
            <I18nProvider>
              <CurrencyProvider>
                <SessionProvider>
                  <DevChunkRecoveryCleanup />
                  <LocaleCurrencySync />
                  <AnalyticsPageViewTracker />
                  <div className="relative z-[1] min-h-dvh min-h-[100dvh] flex flex-col">
                    {children}
                  </div>
                  <GlobalAiAssistant />
                </SessionProvider>
              </CurrencyProvider>
            </I18nProvider>
          </ErrorBoundary>
        </Suspense>
        <Toaster position="top-center" closeButton richColors />
        <DeferredCjkFontsCss />
        {/*
         * Vercel Speed Insights — RUM (real user monitoring) for FCP/LCP/TBT/CLS.
         * Already in package.json; mounting it here begins data collection on Vercel
         * deploy. Self-contained: no opt-out impact, ~3KB script, no UI footprint.
         */}
        <SpeedInsights />
      </body>
    </html>
  );
}
