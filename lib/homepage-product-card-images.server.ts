import "server-only";

import { createServerClient } from "@/lib/supabase";
import {
  DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
  type HomepageProductCardImages,
} from "@/lib/homepage-product-card-images.shared";

type SiteSettingsRow = {
  homepage_product_card_join_image_url: string | null;
  homepage_product_card_private_image_url: string | null;
  homepage_product_card_bus_image_url: string | null;
};

function pickUrl(stored: string | null | undefined, fallback: string): string {
  const t = typeof stored === "string" ? stored.trim() : "";
  return t.length > 0 ? t : fallback;
}

/**
 * Resolved image URLs for homepage "Choose your style" product cards.
 * Call from Server Components / route handlers only (service role).
 */
export async function getHomepageProductCardImages(): Promise<HomepageProductCardImages> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "homepage_product_card_join_image_url, homepage_product_card_private_image_url, homepage_product_card_bus_image_url",
      )
      .eq("id", "default")
      .maybeSingle<SiteSettingsRow>();

    if (error || !data) {
      return { ...DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES };
    }

    return {
      join: pickUrl(data.homepage_product_card_join_image_url, DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join),
      private: pickUrl(
        data.homepage_product_card_private_image_url,
        DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.private,
      ),
      bus: pickUrl(data.homepage_product_card_bus_image_url, DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.bus),
    };
  } catch {
    return { ...DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES };
  }
}
