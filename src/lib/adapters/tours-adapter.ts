import type {
  BuildTourResponse,
  TourCardViewModel,
  TourDetailViewModel,
  TourType,
  PickupInfo,
  BookingTimelineViewModel,
} from "@/src/types/tours";
import type { JoinVisibleStatus } from "@/src/types/tours";
import { BuildTourResponseSchema } from "../schemas/tours";
import { TourCardViewModelSchema } from "../schemas/tours";
import { TourDetailViewModelSchema } from "../schemas/tours";
import { BookingTimelineSchema } from "../schemas/booking";
import { COPY } from "@/src/design/copy";

export function adaptBuildTourResponse(raw: unknown): BuildTourResponse {
  const parsed = BuildTourResponseSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("[adapter] build-tour parse failed", parsed.error.flatten());

    return {
      searchSummary: {
        destination: "jeju" as const,
        pickupAreaLabel: "Unknown",
        date: "",
        guests: 1,
        styleTags: [],
      },
      recommended: [],
      privateTours: [],
      joinTours: [],
      busTours: [],
    };
  }

  return parsed.data;
}

/** Infer tour type from API title/badges. Server is source of truth; this is fallback for classic list API. */
function inferTourType(item: { title?: string; badges?: string[] }): TourType {
  const title = (item.title ?? "").toLowerCase();
  const badges = (item.badges ?? []).map((b) => String(b).toLowerCase());
  if (
    /private|프라이빗|私人|プライベート|privado/i.test(title) ||
    badges.some((b) => b.includes("private"))
  )
    return "private";
  if (
    /join|small.?group|소그룹|拼团|少人数|grupo pequeño/i.test(title) ||
    badges.some((b) => b.includes("join") || b.includes("small group"))
  )
    return "join";
  return "bus";
}

/** Build PickupInfo from API list item. */
function pickupFromListItem(item: {
  city?: string;
  pickupInfo?: string;
  pickupPoints?: unknown[];
}): PickupInfo {
  const areaLabel =
    (item.pickupInfo && String(item.pickupInfo).trim()) ||
    item.city ||
    "—";
  const count = Array.isArray(item.pickupPoints) ? item.pickupPoints.length : 0;
  return {
    areaLabel,
    surchargeLabel: count > 0 ? COPY.surcharge.short : null,
    surchargeAmount: 0,
    surchargeFinal: false,
    joinAvailable: false,
  };
}

/**
 * Adapt GET /api/tours response to TourCardViewModel[].
 * Validates each item; invalid items are dropped. Type/join state inferred when API does not provide.
 */
export function adaptToursListResponse(raw: unknown): TourCardViewModel[] {
  const data = raw && typeof raw === "object" && "tours" in raw ? (raw as { tours: unknown[] }).tours : Array.isArray(raw) ? raw : [];
  const list = Array.isArray(data) ? data : [];
  const result: TourCardViewModel[] = [];

  for (const item of list) {
    const id = item?.id != null ? String(item.id) : "";
    const title = typeof item?.title === "string" ? item.title : "";
    if (!id && !title) continue;

    const type = inferTourType({
      title: item?.title,
      badges: item?.badges,
    });
    const priceFrom =
      typeof item?.price === "number"
        ? item.price
        : Number(item?.price) || 0;
    const pickup = pickupFromListItem({
      city: item?.city ?? item?.location,
      pickupInfo: item?.pickupInfo,
      pickupPoints: item?.pickupPoints ?? item?.pickup_points,
    });
    const tags = Array.isArray(item?.badges) ? item.badges.map(String) : [];
    if (item?.highlight && typeof item.highlight === "string") tags.push(item.highlight);

    const imageUrl =
      typeof item?.image === "string"
        ? item.image
        : Array.isArray(item?.images) && item.images[0]
          ? (typeof item.images[0] === "string" ? item.images[0] : (item.images[0] as { url?: string })?.url)
          : undefined;
    const view: TourCardViewModel = {
      id,
      title,
      type,
      tags,
      priceFrom,
      currency: "KRW",
      pickup,
      imageUrl: imageUrl ?? undefined,
    };
    const parsed = TourCardViewModelSchema.safeParse(view);
    if (parsed.success) result.push(parsed.data);
  }

  return result;
}

/**
 * Adapt GET /api/tours/[id] response to TourDetailViewModel.
 * Uses centralized copy for cancellationPolicy, whoThisIsBestFor, whyThisFitsYou when not from server.
 */
export function adaptTourDetailResponse(raw: unknown): TourDetailViewModel | null {
  const tour =
    raw && typeof raw === "object" && "tour" in raw
      ? (raw as { tour: Record<string, unknown> }).tour
      : raw && typeof raw === "object" && "id" in raw
        ? (raw as Record<string, unknown>)
        : null;
  if (!tour || typeof tour !== "object") return null;

  const id = tour.id != null ? String(tour.id) : "";
  const title = typeof tour.title === "string" ? tour.title : "";
  if (!id) return null;

  const type = inferTourType({
    title: tour.title as string,
    badges: (tour.badges as string[]) ?? [],
  });
  const price = typeof tour.price === "number" ? tour.price : Number(tour.price) || 0;
  const originalPrice =
    tour.originalPrice != null ? Number(tour.originalPrice) : null;
  const city = (tour.city as string) || (tour.location as string) || "Jeju";
  const rawPickupPoints: unknown[] = Array.isArray(tour.pickupPoints) ? tour.pickupPoints : [];
  const pickupPoints = rawPickupPoints.map((p: unknown) => {
    const r = p as Record<string, unknown>;
    return {
      id: String(r?.id ?? ""),
      name: String(r?.name ?? ""),
      address: String(r?.address ?? ""),
      lat: Number(r?.lat ?? 0),
      lng: Number(r?.lng ?? 0),
      pickup_time: r?.pickup_time != null ? String(r.pickup_time) : null,
    };
  }) as TourDetailViewModel["pickupPoints"];
  const areaLabel: string = String(
    (tour.pickupInfo && String(tour.pickupInfo)) ||
    (pickupPoints.length > 0 ? `${pickupPoints.length} pickup point(s)` : city)
  );
  const pickup: PickupInfo = {
    areaLabel,
    surchargeLabel: "Pickup surcharge may apply",
    surchargeAmount: 0,
    surchargeFinal: false,
    joinAvailable: type === "join",
  };

  const itinerary = Array.isArray(tour.itinerary)
    ? (tour.itinerary as Array<{ time?: string; title?: string; description?: string }>).map(
        (i) => ({
          time: i?.time ?? "",
          title: i?.title ?? "",
          description: i?.description,
        })
      )
    : [];
  const images = Array.isArray(tour.images)
    ? (tour.images as Array<{ url?: string; title?: string; description?: string }>).map((img) => ({
        url: img?.url ?? "",
        title: img?.title,
        description: img?.description,
      }))
    : [];

  const view = {
    id,
    title,
    type,
    tagline: tour.tagline as string | undefined,
    city,
    rating: typeof tour.rating === "number" ? tour.rating : Number(tour.rating) || 0,
    reviewCount: Number(tour.reviewCount ?? tour.review_count ?? 0) || 0,
    badges: Array.isArray(tour.badges) ? tour.badges.map(String) : [],
    price,
    originalPrice,
    priceType: (tour.priceType ?? tour.price_type ?? "person") === "group" ? "group" : "person",
    duration: (tour.duration as string) ?? "",
    difficulty: (tour.difficulty as string) ?? undefined,
    groupSize: tour.groupSize as string | undefined,
    highlight: tour.highlight as string | undefined,
    images: images.length > 0 ? images : [{ url: (tour.image_url as string) || (tour.image as string) || "" }],
    itinerary,
    itineraryDetails: Array.isArray(tour.itineraryDetails) ? (tour.itineraryDetails as Array<{ time?: string; activity?: string; description?: string }>).map((d) => ({
      time: d?.time ?? "",
      activity: d?.activity ?? "",
      description: d?.description ?? "",
    })) : undefined,
    overview: (tour.overview as string) ?? (tour.description as string) ?? "",
    pickup,
    pickupPoints,
    inclusions: (Array.isArray(tour.inclusions)
      ? (tour.inclusions as Array<string | { icon?: string; text?: string }>).map((x) =>
          typeof x === "object" && x && "text" in x ? { icon: (x as { icon?: string; text?: string }).icon ?? "✓", text: (x as { text?: string }).text ?? "" } : x
        )
      : []) as TourDetailViewModel["inclusions"],
    exclusions: (Array.isArray(tour.exclusions)
      ? (tour.exclusions as Array<string | { icon?: string; text?: string }>).map((x) =>
          typeof x === "object" && x && "text" in x ? { icon: (x as { icon?: string; text?: string }).icon ?? "✗", text: (x as { text?: string }).text ?? "" } : x
        )
      : []) as TourDetailViewModel["exclusions"],
    faqs: Array.isArray(tour.faqs) ? (tour.faqs as Array<{ question: string; answer: string }>) : undefined,
    highlights: Array.isArray(tour.highlights) ? (tour.highlights as string[]) : undefined,
    whyThisFitsYou: Array.isArray(tour.whyThisFitsYou) ? (tour.whyThisFitsYou as string[]) : getDefaultWhyThisFitsYou(type),
    whoThisIsBestFor: Array.isArray(tour.whoThisIsBestFor) ? (tour.whoThisIsBestFor as string[]) : getDefaultWhoThisIsBestFor(type),
    cancellationPolicy: typeof tour.cancellationPolicy === "string" ? tour.cancellationPolicy : COPY.detail.cancellationPolicyBody,
    joinStatus: tour.joinStatus as JoinVisibleStatus | undefined,
    travelersJoined: typeof tour.travelersJoined === "number" ? tour.travelersJoined : undefined,
    maxTravelers: typeof tour.maxTravelers === "number" ? tour.maxTravelers : undefined,
    childEligibility: Array.isArray(tour.childEligibility) ? (tour.childEligibility as Array<{ id: string; num?: number; num1?: number; num2?: number; num3?: number; text?: string }>) : undefined,
    bookingTimeline: mapServerBookingTimeline(tour.bookingTimeline ?? tour.timeline) ?? undefined,
  } as unknown as TourDetailViewModel;

  const parsed = TourDetailViewModelSchema.safeParse(view);
  if (!parsed.success) {
    console.error("[adapter] tour detail parse failed", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

function getDefaultWhyThisFitsYou(type: TourType): string[] {
  if (type === "private")
    return [COPY.comparison.bullets[4]!, COPY.tourTypes.privatePoints[2]!];
  if (type === "join")
    return [COPY.tourTypes.joinPoints[1]!, COPY.tourTypes.joinPoints[2]!];
  return [COPY.comparison.bullets[1]!, COPY.comparison.bullets[4]!];
}

function getDefaultWhoThisIsBestFor(type: TourType): string[] {
  if (type === "private")
    return [COPY.tourTypes.privatePoints[1]!, COPY.tourTypes.privatePoints[2]!];
  if (type === "join")
    return [COPY.tourTypes.joinPoints[0]!, COPY.tourTypes.joinPoints[2]!];
  return [COPY.detail.whoBus];
}

/**
 * Map server-provided booking timeline to ViewModel. Use this whenever the API returns timeline fields.
 * Validates shape; returns null if missing or invalid. This is the preferred source of timeline data.
 */
export function mapServerBookingTimeline(raw: unknown): BookingTimelineViewModel | null {
  const parsed = BookingTimelineSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, autoCharge: false as const };
}

/**
 * Client-side fallback: compute timeline from selected date using 24h/18h rules.
 * NOT source of truth. Use only when server does not provide bookingTimeline (e.g. GET /api/tours/[id] has no timeline).
 * Prefer server-provided timeline from mapServerBookingTimeline or TourDetailViewModel.bookingTimeline.
 */
export function buildBookingTimelineViewModelClientFallback(selectedDate: Date | null): BookingTimelineViewModel | null {
  if (!selectedDate) return null;
  const now = new Date();
  const tourStart = new Date(selectedDate);
  tourStart.setHours(9, 0, 0, 0);
  const balanceOpensAt = new Date(tourStart);
  balanceOpensAt.setHours(balanceOpensAt.getHours() - 24);
  const balanceDueAt = new Date(tourStart);
  balanceDueAt.setHours(balanceDueAt.getHours() - 18);
  const refundDeadlineAt = new Date(balanceOpensAt);

  return {
    now: now.toISOString(),
    refundDeadlineAt: refundDeadlineAt.toISOString(),
    balanceOpensAt: balanceOpensAt.toISOString(),
    balanceDueAt: balanceDueAt.toISOString(),
    tourStartAt: tourStart.toISOString(),
    autoCharge: false,
  };
}
