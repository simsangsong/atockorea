/**
 * W1.2 — minimal service worker for the Tour Room PWA (§3-E).
 *
 * Deliberately tiny: its only job is to satisfy installability and keep the
 * app-shell assets (icons + manifest) available. HTML and API responses are
 * NEVER cached here — the room is a realtime surface and Next owns caching.
 * Requests outside the precache list fall through to the network untouched.
 */

// Bump the version whenever SHELL_ASSETS bytes change (icons etc.) — cache-
// first serving can't otherwise pick up a same-path asset update.
const CACHE_NAME = 'atoc-tour-mode-shell-v1';
// The manifest is intentionally NOT precached (install metadata must not be
// pinned cache-first, or a redeploy changing it stays invisible to installed
// clients). Its own HTTP cache-control (1h) is enough.
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
            .filter((key) => key.startsWith('atoc-tour-mode-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
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

// W4.1 / P-D7 — guest Web Push (rally + delay only; opt-in from the room).
// Clicking focuses an existing tour-mode tab or opens the room fresh.
self.addEventListener('push', (event) => {
  let data = { title: 'AtoC Korea', body: '', url: '/tour-mode', tag: undefined };
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
      vibrate: [200, 100, 200],
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Same-origin only: never let a push payload's url open an external site.
  let url = '/tour-mode';
  try {
    const raw = (event.notification.data && event.notification.data.url) || '/tour-mode';
    const dest = new URL(raw, self.location.origin);
    if (dest.origin === self.location.origin) url = dest.pathname + dest.search;
  } catch (e) {
    /* keep the default */
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/tour-mode') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
