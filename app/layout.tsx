import type { Metadata } from "next";
import { Inter, Noto_Sans_SC, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
    <html lang="en">
      <body className={`${inter.variable} ${notoSansSC.variable} ${notoSansTC.variable} antialiased`}>
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
        <ErrorBoundary>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

