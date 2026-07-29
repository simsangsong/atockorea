import type { MetadataRoute } from 'next';

/**
 * W1.3 — route-scoped PWA manifest for the ops center.
 *
 * Scope is /admin/tour-ops ONLY (§3-A): the ops app must not swallow the rest
 * of /admin — navigating to another admin page from the installed app opens
 * the browser, which is the intended boundary.
 */

const manifest: MetadataRoute.Manifest = {
  name: 'AtoC 관제센터',
  short_name: '관제센터',
  description: '실시간 투어 관제: 전 투어룸 모니터링, SOS 대응, 관제 발신.',
  id: '/admin/tour-ops',
  start_url: '/admin/tour-ops',
  scope: '/admin/tour-ops',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0f172a',
  theme_color: '#0f172a',
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
