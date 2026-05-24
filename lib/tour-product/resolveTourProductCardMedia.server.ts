import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import type { TourProductCardMediaMap } from "@/lib/tour-product/cardMediaTypes";

type Sb = SupabaseClient<Database>;

type PageMediaRow = {
  slug?: string | null;
  locale?: string | null;
  thumbnail_url?: string | null;
  hero_image_url?: string | null;
  updated_at?: string | null;
};

type TourFallbackMediaRow = {
  slug?: string | null;
  image_url?: string | null;
  gallery_thumb?: string | null;
};

function cleanUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLocale(value?: string | null): string {
  if (!value) return "en";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "zh-cn") return "zh";
  if (lower === "zh-tw") return "zh-TW";
  if (lower === "ko" || lower === "ja" || lower === "zh" || lower === "es") return lower;
  return trimmed === "en" ? "en" : trimmed;
}

function rowHasMedia(row: PageMediaRow): boolean {
  return Boolean(cleanUrl(row.thumbnail_url) || cleanUrl(row.hero_image_url));
}

function updatedMs(row: PageMediaRow): number {
  const raw = row.updated_at;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function pickLatestMediaRow(
  rows: PageMediaRow[],
  preferredLocale: string,
): PageMediaRow | null {
  const candidates = rows.filter(rowHasMedia);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    const timeDelta = updatedMs(b) - updatedMs(a);
    if (timeDelta !== 0) return timeDelta;
    const aLocale = normalizeLocale(a.locale);
    const bLocale = normalizeLocale(b.locale);
    if (aLocale === preferredLocale && bLocale !== preferredLocale) return -1;
    if (bLocale === preferredLocale && aLocale !== preferredLocale) return 1;
    return aLocale.localeCompare(bLocale);
  })[0] ?? null;
}

export async function loadTourProductCardMediaBySlug(
  supabase: Sb,
  slugs: readonly string[],
  locale = "en",
): Promise<TourProductCardMediaMap> {
  const uniqueSlugs = Array.from(new Set(slugs.map(normalizeSlug).filter(Boolean)));
  if (uniqueSlugs.length === 0) return {};

  const preferredLocale = normalizeLocale(locale);
  const [pageMediaResult, fallbackResult] = await Promise.all([
    supabase
      .from("tour_product_pages")
      .select("slug, locale, thumbnail_url, hero_image_url, updated_at")
      .in("slug", uniqueSlugs),
    supabase
      .from("tours")
      .select("slug, image_url, gallery_thumb:gallery_images->>0")
      .in("slug", uniqueSlugs),
  ]);

  if (pageMediaResult.error) {
    console.warn("[loadTourProductCardMediaBySlug] page media failed", pageMediaResult.error.message);
  }
  if (fallbackResult.error) {
    console.warn("[loadTourProductCardMediaBySlug] fallback media failed", fallbackResult.error.message);
  }

  const pageRowsBySlug = new Map<string, PageMediaRow[]>();
  for (const row of ((pageMediaResult.data ?? []) as PageMediaRow[])) {
    const slug = normalizeSlug(row.slug);
    if (!slug) continue;
    const list = pageRowsBySlug.get(slug) ?? [];
    list.push(row);
    pageRowsBySlug.set(slug, list);
  }

  const fallbackBySlug = new Map<string, string>();
  for (const row of ((fallbackResult.data ?? []) as TourFallbackMediaRow[])) {
    const slug = normalizeSlug(row.slug);
    if (!slug) continue;
    const fallback = cleanUrl(row.image_url) || cleanUrl(row.gallery_thumb);
    if (fallback) fallbackBySlug.set(slug, fallback);
  }

  const out: TourProductCardMediaMap = {};
  for (const slug of uniqueSlugs) {
    const pageRow = pickLatestMediaRow(pageRowsBySlug.get(slug) ?? [], preferredLocale);
    const thumbnailUrl = cleanUrl(pageRow?.thumbnail_url) || null;
    const heroImageUrl = cleanUrl(pageRow?.hero_image_url) || null;
    const fallbackUrl = fallbackBySlug.get(slug) ?? null;
    out[slug] = {
      slug,
      thumbnailUrl,
      heroImageUrl,
      cardImageUrl: thumbnailUrl || heroImageUrl || fallbackUrl,
      sourceLocale: pageRow?.locale ?? null,
      updatedAt: pageRow?.updated_at ?? null,
    };
  }

  return out;
}
