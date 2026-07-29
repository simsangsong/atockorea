import { SitePageShell } from '@/src/components/layout/SitePageShell';

/**
 * Route-level loading boundary for /cart. The page is a static client shell,
 * so this mostly covers un-prefetched bottom-nav / header taps — it paints the
 * framed spinner instantly instead of freezing on the previous page while the
 * (tiny) RSC payload streams. Mirrors the page's own `loading` branch so there
 * is no visual jump when hydration takes over the client-side cart fetch.
 */
export default function CartLoading() {
  return (
    <SitePageShell>
      <main className="relative isolate container mx-auto px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(72vh,440px)] bg-gradient-to-b from-slate-50/95 via-white/55 to-transparent"
          aria-hidden
        />
        <div className="py-12 text-center" role="status" aria-live="polite">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </main>
    </SitePageShell>
  );
}
