/**
 * W1.3 — minimal service worker for the ops-center PWA (§3-E).
 *
 * Same contract as sw-tour-mode.js: precache only the app-shell assets so the
 * surface is installable; HTML and API stay network-only (the ops center is a
 * realtime dashboard — a cached response is worse than an error).
 */

const CACHE_NAME = 'atoc-tour-ops-shell-v1';
const SHELL_ASSETS = [
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/maskable-192.png',
  '/pwa/maskable-512.png',
  '/pwa/apple-touch-icon.png',
  '/admin/tour-ops/manifest.webmanifest',
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
  const url = (event.notification.data && event.notification.data.url) || '/admin/tour-ops';
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
