import type { Metadata, Viewport } from 'next';
import PwaRegistrar from '@/components/pwa/PwaRegistrar';
// W1.2 — the ops console runs on the tr-* token engine (var(--tr-*) chrome +
// `.tr-root`/`.dark`), but those vars live in tour-room-theme.css which was only
// loaded on /tour-mode. Without it every `bg-[var(--tr-canvas)]` etc. resolved
// to transparent (the room-manager overlay bled through). Load it here so the
// vars are defined for the whole ops route. The `.tr-root`-scoped rules don't
// leak to the rest of the admin.
import '@/app/tour-room-theme.css';

/**
 * W1.3 — PWA wiring for the ops center. This nested layout only contributes
 * head metadata (manifest link, apple-touch-icon, theme color) and the
 * service-worker registration; the visual shell still comes from the admin
 * layout in browser mode and from the W3 app shell in standalone mode.
 */

export const metadata: Metadata = {
  title: '관제센터 — AtoC Korea',
  robots: { index: false, follow: false },
  manifest: '/admin/tour-ops/manifest.webmanifest',
  icons: { apple: '/pwa/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: '관제센터',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function TourOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaRegistrar swPath="/sw-tour-ops.js" scope="/admin/tour-ops" />
      {children}
    </>
  );
}
