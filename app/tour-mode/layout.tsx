import type { Metadata, Viewport } from 'next';
import WebviewEscapeBanner from '@/components/tour-mode/WebviewEscapeBanner';
import PwaRegistrar from '@/components/pwa/PwaRegistrar';
import '@/app/tour-room-theme.css';

/**
 * Standalone lightweight shell for Tour Mode (§O-1 ②): no global nav, no
 * footer, no marketing chrome — an invite link must show the room and nothing
 * else, fast, on a phone, on tour-day cellular.
 *
 * W1.2: this surface is an installable PWA (manifest + SW scoped to
 * /tour-mode) so guests can pin the room to their home screen.
 */

export const metadata: Metadata = {
  title: 'Tour Mode — AtoC Korea',
  description: 'Your live tour room: guide chat, route, and departure alerts.',
  robots: { index: false, follow: false },
  manifest: '/tour-mode/manifest.webmanifest',
  icons: { apple: '/pwa/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: 'Tour Room',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f4f2',
};

export default function TourModeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f3f4f2]">
      <PwaRegistrar swPath="/sw-tour-mode.js" scope="/tour-mode" />
      <WebviewEscapeBanner />
      {children}
    </main>
  );
}
