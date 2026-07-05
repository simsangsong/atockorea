import { ToursListPageBody } from "./toursListPageBody";

/**
 * Canonical ENGLISH catalogue page — a static ISR shell (same T1 pattern as
 * `/tour-product/[slug]`). Visitors with a non-en `NEXT_LOCALE` cookie are
 * 307'd by the middleware to `/{locale}/tours/list`, so this page never varies
 * by cookie and stays CDN-cacheable (it used to read `cookies()`, which forced
 * per-request dynamic SSR — every bottom-nav tap was a CDN MISS). Deep-link
 * filters (`?destination=…`) are consumed client-side only (window.location
 * parse in ToursListClient — NOT `useSearchParams()`, which would suspend the
 * prerender into a fallback-only shell).
 *
 * Admin thumbnail saves revalidate this path immediately; the hourly TTL is
 * just a safety net.
 */
export const revalidate = 3600;

export default function ToursListPage() {
  return <ToursListPageBody locale="en" />;
}
