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
  updated_at?: string | null;
};

type TourFallbackMedia = {
  imageUrl: string | null;
  galleryThumb: string | null;
  updatedAt: string | null;
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
  const preferred = candidates.filter((row) => normalizeLocale(row.locale) === preferredLocale);
  if (preferred.length > 0) {
    return preferred.sort((a, b) => updatedMs(b) - updatedMs(a))[0] ?? null;
  }
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
      .select("slug, image_url, gallery_thumb:gallery_images->>0, updated_at")
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

  const fallbackBySlug = new Map<string, TourFallbackMedia>();
  for (const row of ((fallbackResult.data ?? []) as TourFallbackMediaRow[])) {
    const slug = normalizeSlug(row.slug);
    if (!slug) continue;
    const imageUrl = cleanUrl(row.image_url) || null;
    const galleryThumb = cleanUrl(row.gallery_thumb) || null;
    if (imageUrl || galleryThumb) {
      fallbackBySlug.set(slug, {
        imageUrl,
        galleryThumb,
        updatedAt: row.updated_at ?? null,
      });
    }
  }

  const out: TourProductCardMediaMap = {};
  for (const slug of uniqueSlugs) {
    const pageRow = pickLatestMediaRow(pageRowsBySlug.get(slug) ?? [], preferredLocale);
    const tourFallback = fallbackBySlug.get(slug);
    const pageThumbnail = cleanUrl(pageRow?.thumbnail_url) || null;
    const pageHero = cleanUrl(pageRow?.hero_image_url) || null;
    const tourImageUrl = tourFallback?.imageUrl ?? null;
    const galleryFallbackUrl = tourFallback?.galleryThumb ?? null;

    // Priority: tour_product_pages > tours > hero > gallery thumb.
    // `tour_product_pages.thumbnail_url` is what the admin v2 editor writes,
    // so it MUST win. The previous order (tours.image_url first) silently
    // pinned the card to the legacy mirror and ignored every admin save
    // whenever tours.image_url was non-null — that's the "옛날 썸네일"
    // bug confirmed against 15+ drifted rows on 2026-05-25.
    const thumbnailUrl = pageThumbnail || tourImageUrl || null;
    const heroImageUrl = pageHero;
    const cardImageUrl = pageThumbnail || tourImageUrl || pageHero || galleryFallbackUrl;
    const winningSource = pageThumbnail
      ? (pageRow?.locale ?? null)
      : tourImageUrl
        ? "tours"
        : null;
    const winningUpdatedAt = pageThumbnail
      ? (pageRow?.updated_at ?? null)
      : tourImageUrl
        ? (tourFallback?.updatedAt ?? null)
        : null;

    out[slug] = {
      slug,
      thumbnailUrl,
      heroImageUrl,
      cardImageUrl,
      sourceLocale: winningSource,
      updatedAt: winningUpdatedAt,
    };
  }

  return out;
}
