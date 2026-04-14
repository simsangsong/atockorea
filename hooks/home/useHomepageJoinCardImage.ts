"use client";

import { useEffect, useState } from "react";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";
import { HOMEPAGE_PRODUCT_CARD_IMAGES_API_PATH } from "@/lib/home/services/homepage-product-card-images-api";
import { joinImageUrlFromHomepageProductCardApiPayload } from "@/lib/home/services/homepage-product-card-images-response";

/**
 * Fetches homepage card image API and exposes the **join** image URL for the hero best-match card.
 * Same network + merge rules as legacy `HeroPremium` (full object or `{ join }` only).
 */
export function useHomepageJoinCardImage(
  initialJoinUrl: string = DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join,
): string {
  const [joinImageUrl, setJoinImageUrl] = useState(initialJoinUrl);

  useEffect(() => {
    let cancelled = false;
    fetch(HOMEPAGE_PRODUCT_CARD_IMAGES_API_PATH)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        const url = joinImageUrlFromHomepageProductCardApiPayload(data);
        if (url) setJoinImageUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return joinImageUrl;
}
