"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [state, setState] = useState<MediaState | null>(() =>
    initialMediaBySlug && Object.keys(initialMediaBySlug).length > 0
      ? { key: requestKey, media: initialMediaBySlug }
      : null,
  );

  useEffect(() => {
    if (!slugKey) return;

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
