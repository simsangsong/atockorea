import type { MetadataRoute } from 'next';

/**
 * W1.2 — route-scoped PWA manifest for the Tour Room surface.
 *
 * Next's manifest file convention only works at the app root, and we must NOT
 * declare the whole site as a PWA (§3-A) — so each installable surface serves
 * its own manifest from a route handler and links it via layout metadata.
 * Scope is /tour-mode: entry, room, and guide console install as one app.
 */

const manifest: MetadataRoute.Manifest = {
  name: 'AtoC Tour Room',
  short_name: 'Tour Room',
  description: 'Your live tour room: guide chat, route, and departure alerts.',
  id: '/tour-mode',
  start_url: '/tour-mode',
  scope: '/tour-mode',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#faf9f6',
  theme_color: '#111827',
  icons: [
    { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(JSON.stringify(manifest), {
    headers: {
      'content-type': 'application/manifest+json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
