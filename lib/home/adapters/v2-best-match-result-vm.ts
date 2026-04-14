import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_CUSTOM_JOIN_HREF,
  HOME_CTA_FEATURED_JOIN_TOUR_HREF,
} from "@/lib/home/home-cta-routes";

/** Static meta row — same as v0 `BestMatchPreview` example card (not from API). */
export const V2_BEST_MATCH_STATIC_META = {
  rating: "4.9",
  reviews: "234",
  duration: "8h",
  groupMax: "Max 7",
} as const;

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
 * Maps i18n + fixed routes into props for the v0-style best-match card.
 * Same tour target and footer links as legacy `HeroBestMatchArticle` (no recommendation API).
 */
export function buildV2BestMatchResultViewModel(t: (key: string) => string): V2BestMatchResultViewModel {
  const priceCaption = t("premium.productCards.joinPrice");
  const strike = "$78";
  const display = "$58";
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
    strikePriceLabel: strike,
    displayPriceLabel: display,
    priceCaption,
    tourDetailHref: HOME_CTA_FEATURED_JOIN_TOUR_HREF,
    customJoinHref: HOME_CTA_CUSTOM_JOIN_HREF,
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
