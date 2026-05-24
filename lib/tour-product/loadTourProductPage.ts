import type { SupabaseClient } from "@supabase/supabase-js";
import type { EastSignatureNatureCoreDetailViewModel } from "@/components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import type { Database } from "@/lib/supabase";
import type { TourProductDetailPayloadV1 } from "@/lib/tour-product/detailPayloadV1";
import { assembleTourProductReviews } from "@/lib/tour-product/assembleTourProductReviews";
import { mergeTourProductSectionUi } from "@/lib/tour-product/tourProductSectionUi";
import { mapItineraryVariantsToRouteVariants } from "@/lib/tour-product/portRouteVariantsAdapter";

type Sb = SupabaseClient<Database>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatKrwAmountLabel(amountMinor: number): string {
  return amountMinor.toLocaleString("en-US");
}

/** anon 클라이언트 + RLS(공개 페이지만) 전제 */
export async function fetchTourProductPageRow(
  supabase: Sb,
  slug: string,
  locale: string,
): Promise<Database["public"]["Tables"]["tour_product_pages"]["Row"] | null> {
  const { data, error } = await supabase
    .from("tour_product_pages")
    .select("*")
    .eq("slug", slug)
    .eq("locale", locale)
    .maybeSingle();

  if (error) {
    console.error("[tour_product_pages]", slug, error.message);
    return null;
  }
  return data;
}

export async function fetchTourProductOffersForPage(
  supabase: Sb,
  pageId: string,
): Promise<Database["public"]["Tables"]["tour_product_offers"]["Row"][]> {
  const { data, error } = await supabase
    .from("tour_product_offers")
    .select("*")
    .eq("tour_product_page_id", pageId)
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (error) {
    console.error("[tour_product_offers]", pageId, error.message);
    return [];
  }
  return data ?? [];
}

function parsePayload(raw: unknown): TourProductDetailPayloadV1 | null {
  if (!isRecord(raw)) return null;
  const v = Number(raw.schema_version);
  /**
   * v17 batch authoring JSONs ship `schema_version: 7`; older seeds may carry
   * 1. Accept any positive integer — the structural shape is what the
   * downstream merge cares about, not the version tag.
   */
  if (!Number.isFinite(v) || v < 1) return null;
  return raw as unknown as TourProductDetailPayloadV1;
}

function cleanImageUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueImageUrls(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const url = cleanImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function numberOrFallback(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function buildMergedHero(
  page: Database["public"]["Tables"]["tour_product_pages"]["Row"],
  payload: TourProductDetailPayloadV1,
): TourProductDetailPayloadV1["hero"] {
  const fallbackHero: TourProductDetailPayloadV1["hero"] = {
    imageUrl: page.hero_image_url ?? "",
    imagePosition: "center 35%",
    tagline: page.subtitle ?? "",
    pills: Array.isArray(page.badges) ? page.badges.filter((p): p is string => typeof p === "string") : [],
    meta: {
      duration: page.duration_label ?? "",
      region: page.region_label ?? "",
      stops: page.stops_count != null ? `${page.stops_count} stops` : "",
      rating: page.rating_avg != null ? Number(page.rating_avg) : 0,
      ratingStars: 4,
    },
  };

  const payloadHero: Record<string, unknown> = isRecord(payload.hero) ? payload.hero : {};
  const payloadMeta: Record<string, unknown> = isRecord(payloadHero.meta) ? payloadHero.meta : {};
  const baseImageUrl = cleanImageUrl(payloadHero.imageUrl) || cleanImageUrl(fallbackHero.imageUrl);
  const imageUrl = cleanImageUrl(page.hero_image_url) || baseImageUrl;
  const payloadImages = Array.isArray(payloadHero.images) ? payloadHero.images : [];

  return {
    imageUrl,
    imagePosition:
      typeof payloadHero.imagePosition === "string" && payloadHero.imagePosition.trim()
        ? payloadHero.imagePosition
        : fallbackHero.imagePosition,
    tagline: typeof payloadHero.tagline === "string" ? payloadHero.tagline : fallbackHero.tagline,
    pills: Array.isArray(payloadHero.pills)
      ? payloadHero.pills.filter((p: unknown): p is string => typeof p === "string")
      : fallbackHero.pills,
    meta: {
      duration:
        typeof payloadMeta.duration === "string" ? payloadMeta.duration : fallbackHero.meta.duration,
      region: typeof payloadMeta.region === "string" ? payloadMeta.region : fallbackHero.meta.region,
      stops: typeof payloadMeta.stops === "string" ? payloadMeta.stops : fallbackHero.meta.stops,
      rating: numberOrFallback(payloadMeta.rating, fallbackHero.meta.rating),
      ratingStars: numberOrFallback(payloadMeta.ratingStars, fallbackHero.meta.ratingStars),
    },
    images: uniqueImageUrls([imageUrl, ...payloadImages]),
  };
}

/**
 * Supabase 행이 있어도 `detail_payload`가 비어 있거나 초기 시드만 있으면 플래그십 레이아웃이 깨집니다.
 * 이때는 `null`을 반환해 각 `/tour-product/[slug]` 페이지가 번들 정적 뷰모델로 폴백하도록 합니다.
 */
export function isDbTourProductViewModelComplete(
  vm: EastSignatureNatureCoreDetailViewModel,
): boolean {
  const heroUrl = typeof vm.hero?.imageUrl === "string" ? vm.hero.imageUrl.trim() : "";
  // Accept absolute (http/https) URLs OR site-relative paths (/images/...).
  // Phase 1 migration stores site-relative paths so the same URLs work on
  // localhost & production; previously only http(s) was accepted which caused
  // every page to silently fall through to the static bundle.
  const heroLooksValid = heroUrl.startsWith("http") || heroUrl.startsWith("/");
  if (!heroLooksValid) return false;
  if (!vm.headlineLine1?.trim()) return false;
  if (!Array.isArray(vm.subnavItems) || vm.subnavItems.length < 3) return false;
  if (!Array.isArray(vm.glanceItems) || vm.glanceItems.length < 3) return false;
  if (!Array.isArray(vm.galleryItems) || vm.galleryItems.length < 1) return false;
  return true;
}

/**
 * DB 행 → Tour*`EastSignatureNatureCoreDetailViewModel` 동일 shape.
 * East 전용 페이지에서만 사용; 다른 상품은 동일 스키마면 재사용 가능.
 */
export function mergeTourProductPageToViewModel(
  page: Database["public"]["Tables"]["tour_product_pages"]["Row"],
  offers: Database["public"]["Tables"]["tour_product_offers"]["Row"][],
  payload: TourProductDetailPayloadV1,
): EastSignatureNatureCoreDetailViewModel {
  const defaultOffer =
    offers.find((o) => o.is_default && o.is_active) ?? offers.find((o) => o.is_active) ?? null;

  const amountMinorNum = defaultOffer ? Number(defaultOffer.amount_minor) : NaN;
  const amountLabel = defaultOffer
    ? defaultOffer.currency === "KRW" && Number.isFinite(amountMinorNum)
      ? formatKrwAmountLabel(amountMinorNum)
      : defaultOffer.currency === "USD" && Number.isFinite(amountMinorNum)
        ? (amountMinorNum / 100).toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : String(defaultOffer.amount_minor)
    : page.price_amount_label ?? "0";

  const hero = buildMergedHero(page, payload);

  const vm = {
    headlineLine1: page.headline_line_1 ?? payload.headlineLine1 ?? "",
    headlineLine2: page.headline_line_2 ?? payload.headlineLine2 ?? "",
    hero,
    price: {
      amountLabel,
      currency: defaultOffer?.currency ?? page.price_currency ?? "KRW",
      per: page.price_per ?? "person",
      ...(payload.price && typeof payload.price === "object"
        ? {
            originalPriceUsd:
              (payload.price as { originalPriceUsd?: number | null }).originalPriceUsd ?? null,
            salePriceUsd:
              (payload.price as { salePriceUsd?: number | null }).salePriceUsd ?? null,
            discountPercent:
              (payload.price as { discountPercent?: number | null }).discountPercent ?? null,
            priceNote:
              (payload.price as { priceNote?: string }).priceNote ?? undefined,
          }
        : {}),
    },
    subnavItems: payload.subnavItems ?? [],
    glanceItems: payload.glanceItems ?? [],
    galleryItems: payload.galleryItems ?? [],
    itineraryStops: payload.itineraryStops ?? [],
    routeFlowStops: payload.routeFlowStops ?? [],
    routePhases: payload.routePhases ?? [],
    routeShapeIntro: payload.routeShapeIntro ?? { title: "", subtitle: "" },
    whyTourWorks: payload.whyTourWorks ?? {},
    practicalAccordionItems: payload.practicalAccordionItems ?? [],
    practicalWeatherStatic: payload.practicalWeatherStatic ?? {
      today: { temp: "", label: "" },
      tomorrow: { temp: "", label: "" },
    },
    seasonalVariations: payload.seasonalVariations ?? [],
    bookingTrustItems: payload.bookingTrustItems ?? [],
    bookingSupportSteps: payload.bookingSupportSteps ?? [],
    staticQuestions: payload.staticQuestions ?? [],
    guestReviews: payload.guestReviews ?? [],
    reviewsSummary: payload.reviewsSummary ?? {
      averageRating: page.rating_avg != null ? Number(page.rating_avg) : 0,
      totalReviews: page.review_count ?? 0,
      ratingDistribution: [],
      highlights: [],
    },
    sectionUi: mergeTourProductSectionUi(payload.sectionUi, page.locale),
    ...(payload.pickup_dropoff != null ? { pickup_dropoff: payload.pickup_dropoff } : {}),
    ...(() => {
      if (Array.isArray(payload.routeVariants) && payload.routeVariants.length > 0) {
        return { routeVariants: payload.routeVariants };
      }
      const adapted = mapItineraryVariantsToRouteVariants(
        (payload as { itinerary_variants?: unknown }).itinerary_variants,
      );
      return adapted ? { routeVariants: adapted } : {};
    })(),
    ...((payload as { pricingTiers?: unknown }).pricingTiers &&
    typeof (payload as { pricingTiers?: unknown }).pricingTiers === "object"
      ? { pricingTiers: (payload as { pricingTiers?: unknown }).pricingTiers }
      : {}),
  };

  /** 정적 이스트 템플릿에서 `typeof vm`이 매우 좁음; DB/JSON 조립은 동일 스키마 런타임 보장 → 단언. */
  return vm as unknown as EastSignatureNatureCoreDetailViewModel;
}

/**
 * `tour_product_pages.slug` 기준으로 상세 뷰모델 로드 (east / southwest 등 동일 스키마).
 */
export async function loadTourProductViewModelBySlugFromSupabase(
  supabase: Sb,
  slug: string,
  locale = "en",
): Promise<EastSignatureNatureCoreDetailViewModel | null> {
  const page = await fetchTourProductPageRow(supabase, slug, locale);
  if (!page) return null;

  const payload = parsePayload(page.detail_payload);
  if (!payload) return null;

  const offers = await fetchTourProductOffersForPage(supabase, page.id);
  let vm = mergeTourProductPageToViewModel(page, offers, payload);

  try {
    const assembled = await assembleTourProductReviews({
      tourId: page.tour_id,
      fallbackHighlights: [...vm.reviewsSummary.highlights],
    });
    if (assembled) {
      vm = {
        ...vm,
        guestReviews: assembled.guestReviews,
        reviewsSummary: assembled.reviewsSummary,
      };
    }
  } catch (e) {
    console.error("[loadTourProductViewModelBySlugFromSupabase] reviews assemble", slug, e);
  }

  if (!isDbTourProductViewModelComplete(vm)) {
    console.warn(
      "[loadTourProductViewModelBySlugFromSupabase] incomplete detail_payload / columns; use static bundle",
      slug,
      locale,
    );
    return null;
  }

  return vm;
}
