import {
  getStaticTourProductBySlug,
  hrefStaticTourProductDetail,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import {
  getFeaturedJoinTourProduct,
  getProductPriceLabels,
} from "@/lib/home/featured-join-tour-offer";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_FEATURED_JOIN_TOUR_HREF,
  HOME_CTA_MATCHING_HREF,
} from "@/lib/home/home-cta-routes";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { TourMatchApiResponse } from "@/lib/tour-match-v2/api-types";

function priceVmFromProduct(p: ReturnType<typeof getStaticTourProductBySlug> | undefined): {
  strikePriceLabel: string;
  displayPriceLabel: string;
} {
  if (!p) {
    const fb = getFeaturedJoinTourProduct();
    const { listLabel, compareAtLabel } = getProductPriceLabels(fb);
    return {
      strikePriceLabel: compareAtLabel ?? "",
      displayPriceLabel: listLabel,
    };
  }
  const { listLabel, compareAtLabel } = getProductPriceLabels(p);
  return {
    strikePriceLabel: compareAtLabel ?? "",
    displayPriceLabel: listLabel,
  };
}

export type V2BestMatchResultViewModel = {
  badgeLabel: string;
  titleLine1: string;
  titleLine2: string;
  chipLabels: [string, string, string];
  /** Single paragraph under chips (v0 layout). */
  matchSummary: string;
  /** Strikethrough price label (v0 marketing). */
  strikePriceLabel: string;
  /** Main price label (v0 marketing). */
  displayPriceLabel: string;
  priceCaption: string;
  tourDetailHref: string;
  customJoinHref: string;
  browseToursHref: string;
  bestMatchCta: string;
  matchResultRecommendLine: string;
  matchResultBackCta: string;
  seeOtherToursCta: string;
  alsoConsiderLabel: string;
  alsoConsiderPrivate: string;
  alsoConsiderBus: string;
};

/**
 * Uses `/api/tour-product/match` result + static catalog for card copy and deep link.
 * Prefers `matchExplanation` (post-winner LLM) over legacy intent summary.
 */
export function buildV2BestMatchResultViewModelFromApi(
  api: TourMatchApiResponse,
  t: (key: string) => string,
  locale: TourProductPageLocale = "en",
): V2BestMatchResultViewModel {
  if (api.matchOutcome === "no_match" || !api.winner) {
    const isTypeOnly = api.noMatchReason === "no_exact_type_match";
    const prices = priceVmFromProduct(getFeaturedJoinTourProduct(locale));
    return {
      badgeLabel: t("premium.hero.matchNoResultBadge"),
      titleLine1: t("premium.hero.matchNoResultTitleLine1"),
      titleLine2: t("premium.hero.matchNoResultTitleLine2"),
      chipLabels: [
        t("premium.productCards.joinChip1"),
        t("premium.productCards.joinChip2"),
        t("premium.productCards.joinChip3"),
      ],
      matchSummary: isTypeOnly ? t("premium.hero.matchNoExactTypeSummary") : t("premium.hero.matchAllExcludedSummary"),
      strikePriceLabel: prices.strikePriceLabel,
      displayPriceLabel: prices.displayPriceLabel,
      priceCaption: t("premium.productCards.joinPrice"),
      tourDetailHref: HOME_CTA_BROWSE_TOURS_HREF,
      customJoinHref: HOME_CTA_MATCHING_HREF,
      browseToursHref: HOME_CTA_BROWSE_TOURS_HREF,
      bestMatchCta: t("premium.hero.seeOtherToursCta"),
      matchResultRecommendLine: t("premium.hero.matchNoResultRecommendLine"),
      matchResultBackCta: t("premium.hero.matchResultBackCta"),
      seeOtherToursCta: t("premium.hero.seeOtherToursCta"),
      alsoConsiderLabel: t("premium.hero.alsoConsiderLabel"),
      alsoConsiderPrivate: t("premium.hero.alsoConsiderPrivate"),
      alsoConsiderBus: t("premium.hero.alsoConsiderBus"),
    };
  }

  const slug = api.winner.product_id;
  const product = getStaticTourProductBySlug(slug, locale);
  const title = product?.title ?? slug;
  const words = title.split(/\s+/).filter(Boolean);
  const half = Math.min(4, Math.ceil(words.length / 2));
  const titleLine1 = words.slice(0, half).join(" ") || title;
  const titleLine2 = words.slice(half).join(" ");

  const priceCaption = t("premium.productCards.joinPrice");
  const summary =
    api.matchExplanation?.trim() ||
    api.intent.summary_one_line?.trim() ||
    `${t("premium.hero.bestMatchLine1")} — ${t("premium.hero.bestMatchLine2")}`;

  const badges = product?.badges ? [...product.badges] : [];
  const chipLabels: [string, string, string] = [
    badges[0] ?? t("premium.productCards.joinChip1"),
    badges[1] ?? t("premium.productCards.joinChip2"),
    badges[2] ?? t("premium.productCards.joinChip3"),
  ];

  const pForPrice = product ?? getFeaturedJoinTourProduct(locale);
  const { strikePriceLabel, displayPriceLabel } = priceVmFromProduct(pForPrice);

  return {
    badgeLabel: t("premium.hero.bestMatchBadge"),
    titleLine1,
    titleLine2,
    chipLabels,
    matchSummary: summary,
    strikePriceLabel,
    displayPriceLabel,
    priceCaption,
    tourDetailHref: hrefStaticTourProductDetail(slug),
    customJoinHref: HOME_CTA_MATCHING_HREF,
    browseToursHref: HOME_CTA_BROWSE_TOURS_HREF,
    bestMatchCta: t("premium.hero.bestMatchCta"),
    matchResultRecommendLine: t("premium.hero.matchResultRecommendLine"),
    matchResultBackCta: t("premium.hero.matchResultBackCta"),
    seeOtherToursCta: t("premium.hero.seeOtherToursCta"),
    alsoConsiderLabel: t("premium.hero.alsoConsiderLabel"),
    alsoConsiderPrivate: t("premium.hero.alsoConsiderPrivate"),
    alsoConsiderBus: t("premium.hero.alsoConsiderBus"),
  };
}

export function buildV2BestMatchResultViewModel(
  t: (key: string) => string,
  locale: TourProductPageLocale = "en",
): V2BestMatchResultViewModel {
  const priceCaption = t("premium.productCards.joinPrice");
  const { strikePriceLabel, displayPriceLabel } = priceVmFromProduct(getFeaturedJoinTourProduct(locale));
  return {
    badgeLabel: t("premium.hero.bestMatchBadge"),
    titleLine1: t("premium.hero.bestMatchTitleLine1"),
    titleLine2: t("premium.hero.bestMatchTitleLine2"),
    chipLabels: [
      t("premium.productCards.joinChip1"),
      t("premium.productCards.joinChip2"),
      t("premium.productCards.joinChip3"),
    ],
    matchSummary: `${t("premium.hero.bestMatchLine1")} — ${t("premium.hero.bestMatchLine2")}`,
    strikePriceLabel,
    displayPriceLabel,
    priceCaption,
    tourDetailHref: HOME_CTA_FEATURED_JOIN_TOUR_HREF,
    customJoinHref: HOME_CTA_MATCHING_HREF,
    browseToursHref: HOME_CTA_BROWSE_TOURS_HREF,
    bestMatchCta: t("premium.hero.bestMatchCta"),
    matchResultRecommendLine: t("premium.hero.matchResultRecommendLine"),
    matchResultBackCta: t("premium.hero.matchResultBackCta"),
    seeOtherToursCta: t("premium.hero.seeOtherToursCta"),
    alsoConsiderLabel: t("premium.hero.alsoConsiderLabel"),
    alsoConsiderPrivate: t("premium.hero.alsoConsiderPrivate"),
    alsoConsiderBus: t("premium.hero.alsoConsiderBus"),
  };
}
