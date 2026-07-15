/**
 * W1.3 — minimal service worker for the ops-center PWA (§3-E).
 *
 * Same contract as sw-tour-mode.js: precache only the app-shell assets so the
 * surface is installable; HTML and API stay network-only (the ops center is a
 * realtime dashboard — a cached response is worse than an error).
 */

// Bump the version whenever SHELL_ASSETS bytes change (icons etc.) — cache-
// first serving can't otherwise pick up a same-path asset update.
const CACHE_NAME = 'atoc-tour-ops-shell-v1';
// The manifest is intentionally NOT precached: install metadata (name/icons/
// start_url) must not be pinned in a cache-first store, or a redeploy that
// changes it would be invisible to already-installed clients. Its own HTTP
// cache-control (1h) is enough.
const SHELL_ASSETS = [
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-192.png',
  '/pwa/maskable-512.png',
  '/pwa/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('atoc-tour-ops-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// W6.2 — Web Push: show the notification even when the console is closed;
// clicking focuses an existing ops tab or opens a fresh one.
self.addEventListener('push', (event) => {
  let data = { title: 'AtoC 관제센터', body: '', url: '/admin/tour-ops', tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload — show the defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/maskable-192.png',
      vibrate: [200, 100, 200, 100, 400],
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Same-origin only: never let a push payload's url open an external site.
  let url = '/admin/tour-ops';
  try {
    const raw = (event.notification.data && event.notification.data.url) || '/admin/tour-ops';
    const dest = new URL(raw, self.location.origin);
    if (dest.origin === self.location.origin) url = dest.pathname + dest.search;
  } catch (e) {
    /* keep the default */
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/admin/tour-ops') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!SHELL_ASSETS.includes(url.pathname)) return; // network-only for everything else
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
