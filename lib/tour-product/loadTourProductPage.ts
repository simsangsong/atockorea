import type { SupabaseClient } from "@supabase/supabase-js";
import type { EastSignatureNatureCoreDetailViewModel } from "@/components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import type { Database } from "@/lib/supabase";
import type { TourProductDetailPayloadV1 } from "@/lib/tour-product/detailPayloadV1";
import { assembleTourProductReviews } from "@/lib/tour-product/assembleTourProductReviews";
import { mergeTourProductSectionUi } from "@/lib/tour-product/tourProductSectionUi";

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
  if (v !== 1) return null;
  return raw as unknown as TourProductDetailPayloadV1;
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

  const hero =
    payload.hero ??
    ({
      imageUrl: page.hero_image_url ?? "",
      imagePosition: "center 35%",
      tagline: page.subtitle ?? "",
      pills: page.badges ?? [],
      meta: {
        duration: page.duration_label ?? "",
        region: page.region_label ?? "",
        stops: page.stops_count != null ? `${page.stops_count} stops` : "",
        rating: page.rating_avg != null ? Number(page.rating_avg) : 0,
        ratingStars: 4,
      },
    } as TourProductDetailPayloadV1["hero"]);

  const vm = {
    headlineLine1: page.headline_line_1 ?? payload.headlineLine1 ?? "",
    headlineLine2: page.headline_line_2 ?? payload.headlineLine2 ?? "",
    hero,
    price: {
      amountLabel,
      currency: defaultOffer?.currency ?? page.price_currency ?? "KRW",
      per: page.price_per ?? "person",
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
    sectionUi: mergeTourProductSectionUi(payload.sectionUi),
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

  return vm;
}

export async function loadEastSignatureTourProductViewModelFromSupabase(
  supabase: Sb,
  locale = "en",
): Promise<EastSignatureNatureCoreDetailViewModel | null> {
  return loadTourProductViewModelBySlugFromSupabase(supabase, "east-signature-nature-core", locale);
}
