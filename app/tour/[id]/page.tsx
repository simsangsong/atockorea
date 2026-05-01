'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  canonicalProductPathForSlug,
  isTourBlockedFromConsumerSurfaces,
} from '@/lib/tour-consumer-visibility';

/**
 * Legacy `/tour/[id]` surface — kept as a bookmark-compatible redirect to the
 * canonical `/tour-product/<slug>` pages. The legacy detail template was removed;
 * the only remaining routes under this segment are `/checkout` and `/confirmation`
 * which drive the Stripe booking flow.
 */
export default function LegacyTourIdRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tourId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  useEffect(() => {
    let cancelled = false;

    async function resolveAndRedirect() {
      if (!tourId) {
        router.replace('/tours/list');
        return;
      }

      try {
        const res = await fetch(`/api/tours/${encodeURIComponent(tourId)}?locale=en`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) router.replace('/tours/list');
          return;
        }
        const body = (await res.json()) as
          | { tour?: { slug?: string | null; id?: string } | null; slug?: string | null }
          | null;
        const slugFromTour = body?.tour && typeof body.tour.slug === 'string' ? body.tour.slug : null;
        const slugFromRoot = typeof body?.slug === 'string' ? body.slug : null;
        const slug = slugFromTour ?? slugFromRoot;

        if (isTourBlockedFromConsumerSurfaces(tourId, slug)) {
          if (!cancelled) router.replace('/tours/list');
          return;
        }

        const canonical = canonicalProductPathForSlug(slug);
        if (!cancelled) {
          router.replace(canonical ?? '/tours/list');
        }
      } catch {
        if (!cancelled) router.replace('/tours/list');
      }
    }

    void resolveAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [tourId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
        aria-label="Redirecting"
        role="status"
      />
    </div>
  );
}
