import { NextResponse } from "next/server";
import { getHomepageProductCardImages } from "@/lib/homepage-product-card-images.server";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";

/**
 * Public: resolved URLs for homepage "Choose your style" cards (join / private / bus).
 * Used by client `ProductCardsPremium` on `/` and `/[locale]` where the page may be a Client Component.
 *
 * Caching: the payload is 3 image URLs admins change rarely (weeks/months).
 * `force-dynamic` was forcing a Supabase round-trip per visitor for ~260 bytes;
 * `s-maxage=600, stale-while-revalidate=3600` lets the CDN serve it from edge
 * cache and refresh hourly in the background. No per-user state.
 */
export async function GET() {
  try {
    const images = await getHomepageProductCardImages();
    return NextResponse.json(images, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES, {
      headers: {
        // Shorter TTL for the fallback path so a real recovery propagates fast.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }
}
