import type { HomepageProductCardImages } from "@/lib/homepage-product-card-images.shared";
import { buildCustomJoinTourHref } from "@/lib/home/services/custom-join-href";
import type { HeroDestination } from "@/lib/home/types/hero-planner";

/**
 * Future-facing shape for v2 “best match” / featured tour strip (presentation only).
 * Wire `HomeV2Page` sections to this incrementally; no runtime use yet required.
 */
export type V2HomeBestMatchCardModel = {
  imageSrc: string;
  /** e.g. two lines from i18n or CMS */
  titleLines: string[];
  /** Optional marketing prices — legacy used static copy in v0; keep flexible */
  priceFromLabel?: string;
  strikePriceLabel?: string;
};

/**
 * Maps resolved CMS/API card images into neutral keys for v2 “three ways” style blocks.
 */
export type V2HomeStyleCardImagesModel = {
  smallGroupImageSrc: string;
  privateImageSrc: string;
  busImageSrc: string;
};

export function adaptHomepageProductCardImagesToV2StyleImages(
  images: HomepageProductCardImages,
): V2HomeStyleCardImagesModel {
  return {
    smallGroupImageSrc: images.join,
    privateImageSrc: images.private,
    busImageSrc: images.bus,
  };
}

export function adaptJoinImageAndLinesToV2BestMatch(input: {
  joinImageSrc: string;
  bestMatchLines: string[];
  priceFromLabel?: string;
  strikePriceLabel?: string;
}): V2HomeBestMatchCardModel {
  return {
    imageSrc: input.joinImageSrc,
    titleLines: input.bestMatchLines,
    priceFromLabel: input.priceFromLabel,
    strikePriceLabel: input.strikePriceLabel,
  };
}

/**
 * Planner state bundle for a future v2 hero CTA (same contract as legacy query string).
 */
export type V2HomePlannerCtaModel = {
  customJoinHref: string;
  destination: HeroDestination;
  intentRaw: string;
};

/** Pure mapping for a future v2 hero — same href rules as legacy `HeroPremium`. */
export function buildV2HomePlannerCtaModel(input: {
  destination: HeroDestination;
  intent: string;
  basePath?: string;
}): V2HomePlannerCtaModel {
  return {
    customJoinHref: buildCustomJoinTourHref({
      basePath: input.basePath,
      destination: input.destination,
      intent: input.intent,
    }),
    destination: input.destination,
    intentRaw: input.intent,
  };
}
