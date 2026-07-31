/**
 * @jest-environment node
 *
 * 🔴 FA-006 (full-app audit 2026-07-30) — the service worker nothing measured.
 *
 * SG-4's ledger claims a unit for the SW image lane. The string `sw-tour-mode`
 * appeared in `__tests__/`, `e2e/` and `scripts/` **zero times**: the file had
 * never been executed by anything but a browser. That matters more for a service
 * worker than for ordinary code — it is the one file a user cannot refresh away
 * from, so a caching mistake follows them until the version string changes.
 *
 * Two invariants are worth pinning, and both are cheap because the worker is
 * plain JS with a tiny surface:
 *
 *   1. WHAT gets the image lane. Signed-URL media (chat photos, vehicle refs)
 *      must never be cached: the URL churns, so entries are useless AND they
 *      evict the shell. Only same-origin `/images/**` qualifies. Cross-origin
 *      and non-GET must not be intercepted at all.
 *   2. The LRU actually trims. A cache-first lane with a broken trim is a quota
 *      leak that ends in the browser evicting the whole origin.
 *
 * The worker is loaded into a fabricated ServiceWorkerGlobalScope, so this
 * executes the real file rather than asserting on its source text.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_PATH = path.join(process.cwd(), 'public', 'sw-tour-mode.js');

interface FakeCache {
  name: string;
  entries: Map<string, unknown>;
}

/** A ServiceWorkerGlobalScope with just enough of the platform to run. */
function loadWorker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const caches = new Map<string, FakeCache>();
  const fetched: string[] = [];

  const cacheApi = {
    async open(name: string) {
      const store = caches.get(name) ?? { name, entries: new Map<string, unknown>() };
      caches.set(name, store);
      return {
        async match(request: { url: string }) {
          return store.entries.get(request.url) ?? undefined;
        },
        async put(request: { url: string }, response: unknown) {
          store.entries.set(request.url, response);
        },
        async keys() {
          return [...store.entries.keys()].map((url) => ({ url }));
        },
        async delete(request: { url: string }) {
          return store.entries.delete(request.url);
        },
        async addAll() {
          return undefined;
        },
      };
    },
    async keys() {
      return [...caches.keys()];
    },
    async delete(name: string) {
      return caches.delete(name);
    },
  };

  const scope: Record<string, unknown> = {
    self: null,
    location: { origin: 'https://app.atockorea.test' },
    caches: cacheApi,
    async fetch(request: { url: string }) {
      fetched.push(request.url);
      return { ok: true, clone: () => ({ cloned: request.url }), body: request.url };
    },
    addEventListener(type: string, fn: (event: unknown) => void) {
      listeners.set(type, fn);
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    registration: { showNotification: async () => undefined },
    URL,
    console,
  };
  scope.self = scope;

  vm.createContext(scope);
  vm.runInContext(readFileSync(SW_PATH, 'utf8'), scope);

  /** Run the fetch handler and return what it decided to respond with. */
  const runFetch = async (url: string, method = 'GET') => {
    const handler = listeners.get('fetch');
    if (!handler) throw new Error('the worker registered no fetch handler');
    let responded: Promise<unknown> | null = null;
    handler({
      request: { url, method, clone: () => ({ url, method }) },
      respondWith: (p: Promise<unknown>) => {
        responded = p;
      },
      waitUntil: () => undefined,
    });
    return responded === null ? null : await responded;
  };

  return { runFetch, caches, fetched, listeners };
}

const ORIGIN = 'https://app.atockorea.test';

describe('FA-006 — the service worker image lane', () => {
  it('🔴 caches same-origin content images', async () => {
    const w = loadWorker();
    await w.runFetch(`${ORIGIN}/images/poi/seongsan.webp`);

    const imageCache = [...w.caches.values()].find((c) => c.name.includes('img'));
    expect(imageCache).toBeDefined();
    expect([...imageCache!.entries.keys()]).toEqual([`${ORIGIN}/images/poi/seongsan.webp`]);
  });

  it('🔴 serves the second hit from the cache — one network fetch, not two', async () => {
    const w = loadWorker();
    const url = `${ORIGIN}/images/poi/udo.webp`;
    await w.runFetch(url);
    await w.runFetch(url);
    expect(w.fetched.filter((u) => u === url)).toHaveLength(1);
  });

  it('🔴 never caches signed-URL media — the URL churns, so an entry is pure quota loss', async () => {
    const w = loadWorker();
    // Chat photos and vehicle refs come from storage with a token in the query.
    await w.runFetch(`${ORIGIN}/storage/v1/object/sign/tour-room-photos/x.jpg?token=abc`);
    await w.runFetch(`${ORIGIN}/api/tour-rooms/b1/vehicle-photo`);

    const imageCache = [...w.caches.values()].find((c) => c.name.includes('img'));
    expect(imageCache?.entries.size ?? 0).toBe(0);
  });

  it('🔴 does not intercept cross-origin or non-GET requests at all', async () => {
    const w = loadWorker();
    expect(await w.runFetch('https://cdn.example.com/images/x.webp')).toBeNull();
    expect(await w.runFetch(`${ORIGIN}/images/x.webp`, 'POST')).toBeNull();
  });

  it('🔴 the LRU trims — a long tour cannot grow the cache without bound', async () => {
    const w = loadWorker();
    for (let i = 0; i < 30; i += 1) {
      await w.runFetch(`${ORIGIN}/images/poi/stop-${i}.webp`);
    }
    const imageCache = [...w.caches.values()].find((c) => c.name.includes('img'));
    expect(imageCache!.entries.size).toBeLessThanOrEqual(12);
    // And it keeps the NEWEST, which is the one on screen.
    expect([...imageCache!.entries.keys()]).toContain(`${ORIGIN}/images/poi/stop-29.webp`);
  });

  it('registers the lifecycle handlers a worker needs to update itself', async () => {
    const w = loadWorker();
    for (const type of ['install', 'activate', 'fetch']) {
      expect(w.listeners.has(type)).toBe(true);
    }
  });
});
