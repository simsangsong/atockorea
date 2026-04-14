"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
  type HomepageProductCardImages,
} from "@/lib/homepage-product-card-images.shared";
import { HOMEPAGE_PRODUCT_CARD_IMAGES_API_PATH } from "@/lib/home/services/homepage-product-card-images-api";
import { isResolvedHomepageProductCardImages } from "@/lib/home/services/homepage-product-card-images-response";

/**
 * Fetches resolved join/private/bus image URLs for legacy `ProductCardsPremium`.
 * Same behavior as before: only replaces state when the API returns a full triple.
 */
export function useHomepageProductCardImages(
  initial: HomepageProductCardImages = DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
): HomepageProductCardImages {
  const [images, setImages] = useState<HomepageProductCardImages>(initial);

  useEffect(() => {
    let cancelled = false;
    fetch(HOMEPAGE_PRODUCT_CARD_IMAGES_API_PATH)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !isResolvedHomepageProductCardImages(data)) return;
        setImages(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return images;
}
