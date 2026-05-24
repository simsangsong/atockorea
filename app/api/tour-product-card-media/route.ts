import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { loadTourProductCardMediaBySlug } from "@/lib/tour-product/resolveTourProductCardMedia.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseSlugs(value: string | null): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ).slice(0, 160);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slugs = parseSlugs(url.searchParams.get("slugs"));
  const locale = url.searchParams.get("locale") || "en";

  if (slugs.length === 0) {
    return NextResponse.json(
      { media: [], bySlug: {} },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const supabase = createServerClient();
    const bySlug = await loadTourProductCardMediaBySlug(supabase, slugs, locale);
    return NextResponse.json(
      { media: Object.values(bySlug), bySlug },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[GET /api/tour-product-card-media]", error);
    return NextResponse.json(
      { media: [], bySlug: {} },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
