import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, ErrorResponses } from "@/lib/error-handler";
import {
  DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
  isAllowedHomepageImageUrl,
  type HomepageProductCardImages,
} from "@/lib/homepage-product-card-images.shared";

export const dynamic = "force-dynamic";

type Body = Partial<Record<keyof HomepageProductCardImages, string | null | undefined>>;

const COLUMN_BY_KEY: Record<keyof HomepageProductCardImages, string> = {
  join: "homepage_product_card_join_image_url",
  private: "homepage_product_card_private_image_url",
  bus: "homepage_product_card_bus_image_url",
};

/**
 * GET /api/admin/homepage-product-card-images
 * Admin: raw stored values (null = use default) + defaults for UI.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "homepage_product_card_join_image_url, homepage_product_card_private_image_url, homepage_product_card_bus_image_url, updated_at",
      )
      .eq("id", "default")
      .maybeSingle<{
        homepage_product_card_join_image_url: string | null;
        homepage_product_card_private_image_url: string | null;
        homepage_product_card_bus_image_url: string | null;
        updated_at: string;
      }>();

    if (error) {
      console.error("[admin homepage-product-card-images GET]", error);
      return NextResponse.json(
        { success: false, error: "Failed to load homepage product card images" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        join: data?.homepage_product_card_join_image_url ?? null,
        private: data?.homepage_product_card_private_image_url ?? null,
        bus: data?.homepage_product_card_bus_image_url ?? null,
        updatedAt: data?.updated_at ?? null,
      },
      defaults: DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}

/**
 * PUT /api/admin/homepage-product-card-images
 * Body: { join?: string, private?: string, bus?: string } — empty string clears to default (null in DB).
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);
    const supabase = createServerClient();
    const body = (await request.json()) as Body;

    const keys: (keyof HomepageProductCardImages)[] = ["join", "private", "bus"];
    const update: Record<string, string | null> = {};

    for (const key of keys) {
      if (body[key] === undefined) continue;
      const raw = body[key];
      const col = COLUMN_BY_KEY[key];
      if (raw === null || raw === "") {
        update[col] = null;
        continue;
      }
      const s = String(raw).trim();
      if (!isAllowedHomepageImageUrl(s)) {
        return NextResponse.json(
          { success: false, error: `Invalid URL for ${key}: use a path starting with / or http(s) URL` },
          { status: 400 },
        );
      }
      update[col] = s.length > 0 ? s : null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: "No fields to update", data: {} });
    }

    const { error } = await supabase.from("site_settings").upsert(
      {
        id: "default",
        ...update,
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[admin homepage-product-card-images PUT]", error);
      return NextResponse.json(
        { success: false, error: "Failed to save homepage product card images" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Homepage product card images updated",
      data: update,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === "Unauthorized" || String(err.message).includes("Forbidden")) {
      return ErrorResponses.forbidden("Admin access required");
    }
    return handleApiError(error);
  }
}
