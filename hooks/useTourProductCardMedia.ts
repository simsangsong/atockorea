"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";

const EMPTY_MEDIA: TourProductCardMediaMap = {};

type MediaState = {
  key: string;
  media: TourProductCardMediaMap;
};

function normalizeSlugs(slugs: readonly string[]): string[] {
  return Array.from(
    new Set(
      slugs
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ).sort();
}

/**
 * Read tour card media (admin v2 overrides) for a set of slugs.
 *
 * `initialMediaBySlug` lets a server component pre-resolve the admin
 * thumbnails for the SAME (slugs, locale) pair and pass them down, so the
 * very first client render already shows the freshest URL — no
 * "stale-static-catalog-flips-to-admin-saved" flash on the home
 * Most-Loved rail or `/tours/list` shelves. Without it the hook starts
 * empty, fetches on mount, and the swap is visible.
 */
export function useTourProductCardMedia(
  slugs: readonly string[],
  locale: string,
  initialMediaBySlug?: TourProductCardMediaMap,
): TourProductCardMediaMap {
  const normalizedSlugs = useMemo(() => normalizeSlugs(slugs), [slugs]);
  const slugKey = normalizedSlugs.join(",");
  const requestKey = `${locale}|${slugKey}`;
  const seeded = initialMediaBySlug != null && Object.keys(initialMediaBySlug).length > 0;
  const [state, setState] = useState<MediaState | null>(() =>
    seeded ? { key: requestKey, media: initialMediaBySlug as TourProductCardMediaMap } : null,
  );
  // K1: the server pre-resolved media for this exact (slugs, locale) key via the
  // SAME loader the API route uses, so the on-mount no-store fetch would return
  // byte-identical data — skip it once. The guard is consumed so any later key
  // change (scroll pagination / locale switch) still fetches fresh.
  const skipKeyRef = useRef<string | null>(seeded ? requestKey : null);

  useEffect(() => {
    if (!slugKey) return;
    if (skipKeyRef.current === requestKey) {
      skipKeyRef.current = null;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      locale,
      slugs: slugKey,
    });

    fetch(`/api/tour-product-card-media?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        const bySlug = data.bySlug && typeof data.bySlug === "object" ? data.bySlug : {};
        setState({ key: requestKey, media: bySlug as TourProductCardMediaMap });
      })
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [locale, requestKey, slugKey]);

  return state?.key === requestKey ? state.media : EMPTY_MEDIA;
}

export function getCardImageFromAdminMedia(
  slug: string,
  fallbackImage: string,
  mediaBySlug: TourProductCardMediaMap,
): string {
  return mediaBySlug[slug]?.cardImageUrl || fallbackImage;
}
