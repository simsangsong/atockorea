"use client";

/**
 * W2.3 — single shared scroll-spy IntersectionObserver.
 *
 * TourTabsNav (section pills) and the DayFlow thumbnail scrubber (per-stop
 * activity) both subscribe here, so the page keeps exactly ONE observer no
 * matter how many consumers register (§R W2.3 DoD: observer count +0). The
 * root margin matches the sticky-nav "active band" the TabsNav observer used.
 */

const SCROLL_OFFSET_PX = 108;

type SpyCallback = (el: Element) => void;

let observer: IntersectionObserver | null = null;
const subscribers = new Map<Element, SpyCallback>();

function ensureObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            subscribers.get(entry.target)?.(entry.target);
          }
        }
      },
      { rootMargin: `-${SCROLL_OFFSET_PX}px 0px -75% 0px`, threshold: 0 },
    );
  }
  return observer;
}

/** Observe `el`; `cb` fires when it enters the active band. Returns unsubscribe. */
export function observeSpyTarget(el: Element, cb: SpyCallback): () => void {
  const obs = ensureObserver();
  subscribers.set(el, cb);
  obs.observe(el);
  return () => {
    subscribers.delete(el);
    obs.unobserve(el);
    if (subscribers.size === 0) {
      obs.disconnect();
      observer = null;
    }
  };
}

export { SCROLL_OFFSET_PX };
