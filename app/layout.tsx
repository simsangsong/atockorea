import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import "./home-v2.css";
import "./home-v2-fidelity.css";
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { rootHtmlLangFromNextLocaleCookie } from "@/lib/rootHtmlLangFromCookie";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Licensed Korea-based Platform for Day Tours",
  description: "Direct connection to trusted Korea tours. Licensed Korean travel agencies, certified guides, and lower prices through direct partnerships.",
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
    <html lang={htmlLang} className="font-sans" suppressHydrationWarning>
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
                <div className="relative z-[1] min-h-dvh min-h-[100dvh] flex flex-col">
                  {children}
                </div>
              </CurrencyProvider>
            </I18nProvider>
          </ErrorBoundary>
        </Suspense>
        <Toaster position="top-center" closeButton richColors />
      </body>
    </html>
  );
}

