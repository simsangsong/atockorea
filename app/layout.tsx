import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Noto_Sans_SC, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { CurrencyProvider } from "@/lib/currency";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-sc",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

import { generateMetadata as generateSEOMetadata, generateStructuredData } from '@/lib/seo';

export const metadata = generateSEOMetadata({
  title: "AtoC Korea - Licensed Korea-based Platform for Day Tours",
  description: "Direct connection to trusted Korea tours. Licensed Korean travel agencies, certified guides, and lower prices through direct partnerships.",
  url: '/',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationStructuredData = generateStructuredData('Organization', {});
  const websiteStructuredData = generateStructuredData('WebSite', {});

  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoSansSC.variable} ${notoSansTC.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
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
                  {children}
                </CurrencyProvider>
              </I18nProvider>
            </ErrorBoundary>
          </Suspense>
          <Toaster position="top-center" closeButton richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}

