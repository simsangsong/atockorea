import type { Metadata, Viewport } from 'next';
import WebviewEscapeBanner from '@/components/tour-mode/WebviewEscapeBanner';

/**
 * Standalone lightweight shell for Tour Mode (§O-1 ②): no global nav, no
 * footer, no marketing chrome — an invite link must show the room and nothing
 * else, fast, on a phone, on tour-day cellular.
 */

export const metadata: Metadata = {
  title: 'Tour Mode — AtoC Korea',
  description: 'Your live tour room: guide chat, route, and departure alerts.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function TourModeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#faf9f6]">
      <WebviewEscapeBanner />
      {children}
    </main>
  );
}
