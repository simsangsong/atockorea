import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Inter, Playfair_Display } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
// home-v2.css and home-v2-fidelity.css are imported by components/home/HomeMainBody so they
// only ship on the homepage route. home-premium.css remains in globals.css because its
// `--home-*` tokens are referenced by Tailwind shadow classes on /match and /mypage too.
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DevChunkRecoveryCleanup } from "@/components/DevChunkRecoveryCleanup";
import { LocaleCurrencySync } from "@/components/LocaleCurrencySync";
import { Toaster } from "@/components/ui/sonner";
import { rootHtmlLangFromNextLocaleCookie } from "@/lib/rootHtmlLangFromCookie";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Latin display — brand mark & editorial accents (tour-product / premium surfaces) */
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display-serif",
  weight: ["500", "600", "700"],
  display: "swap",
});

import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Korea Day Tours, Hand-Picked by Our Team",
  description: "Korea day tours hand-picked by our team. Same operators trusted by Klook, GetYourGuide, and Viator — book direct here, compare prices anytime.",
  url: '/',
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationStructuredData = generateStructuredData('Organization', {});
  const websiteStructuredData = generateStructuredData('WebSite', {});
  const jar = await cookies();
  const htmlLang = rootHtmlLangFromNextLocaleCookie(jar.get("NEXT_LOCALE")?.value);

  return (
    <html lang={htmlLang} className="font-sans" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Preconnect to webfont CDNs so DNS + TLS finish before the stylesheet links resolve. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
         * Pretendard (Korean) — moved out of globals.css @import to remove the CSS-level
         * waterfall. The CSS itself is ~3 KB and uses unicode-range to fetch woff2 only
         * when matching glyphs are needed.
         */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        {/*
         * CJK full weights for ja / zh-CN / zh-TW. Google Fonts splits each language's
         * woff2 by unicode-range, so a Korean visitor doesn't pay for Japanese glyphs.
         */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}>
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
                <DevChunkRecoveryCleanup />
                <LocaleCurrencySync />
                <div className="relative z-[1] min-h-dvh min-h-[100dvh] flex flex-col">
                  {children}
                </div>
              </CurrencyProvider>
            </I18nProvider>
          </ErrorBoundary>
        </Suspense>
        <Toaster position="top-center" closeButton richColors />
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
