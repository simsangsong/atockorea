/**
 * Build schema.org JSON-LD blocks for a tour product detail page.
 *
 * Emits:
 *  - `Product` with `Offer` (price basis + cancellation + priceValidUntil),
 *    `AggregateRating`, and individual `Review` bodies
 *  - `TouristTrip` with `Offer`, ISO-8601 `duration`, and `touristType`
 *  - `FAQPage` (when the product has staticQuestions)
 *  - `BreadcrumbList`
 *
 * The goal is AI-readability: assistants that crawl the rendered page
 * (ChatGPT search, Perplexity, Gemini, Google AI Mode) get the same
 * "judgeable" facts a human sees — real reviews, price basis, refund terms —
 * in a machine-parseable form. Rendered as `<script type="application/ld+json">`
 * from the page-level server component so crawlers see it without JS.
 */

import type { TourProductDetailViewModel } from "@/components/product-tour-static/_shared/tourProductFullPageJsonTypes";
import { getStaticTourProductBySlug } from "@/components/product-tour-static/catalog/staticTourCatalogCards";

/**
 * Every tour's booking flow offers a guide in English, Chinese, or Korean
 * (see LANG_OPTIONS in bookingShared) — a sourced, accurate basis for
 * `inLanguage` rather than guessing per tour.
 */
const GUIDE_LANGUAGES = ["en", "zh", "ko"] as const;

/**
 * Conservative tour-type label from the hero pills + price basis. Returns a
 * label ONLY when the format is explicit (a "private vehicle"/"bus tour"/"small
 * group" cue or per-vehicle pricing); otherwise `undefined` so we omit rather
 * than mislabel. The shared `inferTourCatalogType` heuristic is tuned for DB
 * catalogue rows and over-defaults to "bus" on view-model inputs, so we don't
 * use it here.
 */
function deriveTourTypeLabel(
  pills: readonly string[] | undefined,
  per: string | undefined,
): string | undefined {
  const hay = (pills ?? []).join(" ").toLowerCase();
  const unit = (per ?? "").toLowerCase();
  if (unit === "vehicle" || /private vehicle|private tour|private car|licensed driver/.test(hay)) {
    return "Private tour";
  }
  if (/coach tour|bus tour|large coach|\bcoach\b/.test(hay)) return "Bus tour";
  if (/small.?group/.test(hay)) return "Small-group tour";
  return undefined;
}

type StaticQuestion = { id?: string | number; question: string; answer: string };

type ReviewsSummary = {
  averageRating?: number | null;
  totalReviews?: number | null;
};

type GuestReviewLike = {
  author?: string;
  location?: string;
  date?: string;
  rating?: number;
  title?: string;
  text?: string;
};

type PracticalItemLike = { id?: string; title?: string; content?: readonly string[] };

type WhyTourWorksLike = { bestFor?: readonly string[] };

type ViewModelLike = Pick<
  TourProductDetailViewModel,
  "headlineLine1" | "headlineLine2" | "hero" | "price"
> & {
  staticQuestions?: ReadonlyArray<StaticQuestion> | null;
  reviewsSummary?: ReviewsSummary | null;
  guestReviews?: ReadonlyArray<GuestReviewLike> | null;
  practicalAccordionItems?: ReadonlyArray<PracticalItemLike> | null;
  whyTourWorks?: WhyTourWorksLike | null;
};

function siteOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url && /^https?:\/\//.test(url)) return url.replace(/\/$/, "");
  return "https://atockorea.com";
}

function safeProductName(vm: ViewModelLike): string {
  return [vm.headlineLine1, vm.headlineLine2].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function safePrice(vm: ViewModelLike): { price: string; priceCurrency: string } | null {
  const amount = vm.price?.amountLabel;
  const currency = vm.price?.currency;
  if (!amount || !currency) return null;
  const cleaned = String(amount).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  return { price: cleaned, priceCurrency: String(currency).toUpperCase() };
}

/** A rolling validity ~1 year out so crawlers don't treat the offer as stale. */
function priceValidUntil(): string {
  const d = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Parse a human duration label ("≈ 9 hours", "8.5 hrs", "9시간") to ISO-8601. */
function isoDuration(label: string | undefined): string | null {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hr|hour|시간)/i);
  if (!m) return null;
  const hours = parseFloat(m[1]);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return `PT${whole}H${minutes ? `${minutes}M` : ""}`;
}

/** Pull the cancellation/refund line from the practical accordion, if present. */
function cancellationText(vm: ViewModelLike): string | null {
  const items = vm.practicalAccordionItems ?? [];
  const item = items.find(
    (i) =>
      (i?.id && /cancel|refund/i.test(i.id)) ||
      (i?.title && /cancel|refund|취소|환불/i.test(i.title)),
  );
  const text = item?.content?.filter(Boolean).join(" ").trim();
  return text ? text.slice(0, 300) : null;
}

function buildOffer(
  vm: ViewModelLike,
  url: string,
  price: { price: string; priceCurrency: string },
): Record<string, unknown> {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    price: price.price,
    priceCurrency: price.priceCurrency,
    availability: "https://schema.org/InStock",
    url,
    priceValidUntil: priceValidUntil(),
  };
  const per = vm.price?.per?.trim();
  if (per) {
    offer.priceSpecification = {
      "@type": "UnitPriceSpecification",
      price: price.price,
      priceCurrency: price.priceCurrency,
      referenceQuantity: { "@type": "QuantitativeValue", unitText: per },
    };
  }
  const cancel = cancellationText(vm);
  // Non-canonical but high-value for AI readers: refund terms next to the price.
  if (cancel) offer.cancellationPolicy = cancel;
  return offer;
}

function buildReviews(vm: ViewModelLike): Record<string, unknown>[] {
  return (vm.guestReviews ?? [])
    .filter((r) => r?.text && r.text.trim())
    .slice(0, 12)
    .map((r) => {
      const review: Record<string, unknown> = {
        "@type": "Review",
        author: { "@type": "Person", name: r.author?.trim() || "Guest" },
        reviewBody: r.text!.trim(),
      };
      if (r.title?.trim()) review.name = r.title.trim();
      if (r.date && /\d{4}/.test(r.date)) review.datePublished = r.date;
      if (typeof r.rating === "number" && r.rating > 0) {
        review.reviewRating = {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        };
      }
      return review;
    });
}

export function buildTourProductJsonLd(vm: ViewModelLike, slug: string): unknown[] {
  const url = `${siteOrigin()}/tour-product/${slug}`;
  const name = safeProductName(vm);
  const blocks: unknown[] = [];
  const price = safePrice(vm);
  const offer = price ? buildOffer(vm, url, price) : null;

  // Derived (not authored) facts, only when accurate: tour-type label from the
  // explicit pill/price cue (omitted when ambiguous); max group size from the
  // catalogue registry (omitted when the slug isn't in it). No fabrication.
  const tourTypeLabel = deriveTourTypeLabel(vm.hero?.pills, vm.price?.per);
  const maxGroupSize = getStaticTourProductBySlug(slug)?.maxGroupSize;

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    image: vm.hero?.imageUrl ? [vm.hero.imageUrl] : undefined,
    description: vm.hero?.tagline ?? undefined,
    brand: { "@type": "Brand", name: "AtoC Korea" },
  };
  if (tourTypeLabel) product.category = tourTypeLabel;

  if (offer) product.offers = offer;

  const summary = vm.reviewsSummary;
  if (summary && (summary.totalReviews ?? 0) > 0 && (summary.averageRating ?? 0) > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(summary.averageRating),
      reviewCount: Number(summary.totalReviews),
      bestRating: 5,
      worstRating: 1,
    };
  }

  const reviews = buildReviews(vm);
  if (reviews.length > 0) product.review = reviews;

  blocks.push(product);

  // TouristTrip — the travel-native schema.org type. LLMs and agent crawlers
  // that understand trips (not just generic Products) get a cleaner read of
  // what this is, who runs it, the offer, how long it runs, and who it suits.
  const trip: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name,
    url,
    description: vm.hero?.tagline ?? undefined,
    image: vm.hero?.imageUrl ? [vm.hero.imageUrl] : undefined,
    provider: {
      "@type": "Organization",
      name: "AtoC Korea",
      url: siteOrigin(),
    },
    inLanguage: [...GUIDE_LANGUAGES],
  };
  const duration = isoDuration(vm.hero?.meta?.duration);
  if (duration) trip.duration = duration;
  const bestFor = (vm.whyTourWorks?.bestFor ?? []).filter(Boolean);
  if (bestFor.length > 0) trip.touristType = bestFor;
  if (typeof maxGroupSize === "number" && maxGroupSize > 0) {
    trip.maximumAttendeeCapacity = maxGroupSize;
  }
  if (offer) trip.offers = offer;
  blocks.push(trip);

  const faqs = (vm.staticQuestions ?? []).filter((q) => q?.question && q?.answer);
  if (faqs.length > 0) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((q) => ({
        "@type": "Question",
        name: q.question,
        acceptedAnswer: { "@type": "Answer", text: q.answer },
      })),
    });
  }

  // BreadcrumbList — gives crawlers the category hierarchy (Home › Tours › this).
  blocks.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteOrigin() },
      { "@type": "ListItem", position: 2, name: "Tours", item: `${siteOrigin()}/tours/list` },
      { "@type": "ListItem", position: 3, name, item: url },
    ],
  });

  return blocks;
}

export function tourProductJsonLdScripts(vm: ViewModelLike, slug: string): string[] {
  return buildTourProductJsonLd(vm, slug).map((block) => JSON.stringify(block));
}
