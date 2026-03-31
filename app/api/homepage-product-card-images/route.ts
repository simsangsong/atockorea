import { NextResponse } from "next/server";
import { getHomepageProductCardImages } from "@/lib/homepage-product-card-images.server";
import { DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES } from "@/lib/homepage-product-card-images.shared";

export const dynamic = "force-dynamic";

/**
 * Public: resolved URLs for homepage "Choose your style" cards (join / private / bus).
 * Used by client `ProductCardsPremium` on `/` and `/[locale]` where the page may be a Client Component.
 */
export async function GET() {
  try {
    const images = await getHomepageProductCardImages();
    return NextResponse.json(images);
  } catch {
    return NextResponse.json(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES);
  }
}
