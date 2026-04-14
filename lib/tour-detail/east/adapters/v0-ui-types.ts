/**
 * Plain data shapes for the v0 East detail visual layer (`components/tour-detail/east/v2/source/...`).
 * Components are not wired to these props yet; adapters prepare migration without changing v0 files.
 */

export type V0EastHeroMetaModel = {
  durationLabel?: string;
  regionLabel?: string;
  stopCount?: number;
  rating?: number;
  reviewCount?: number;
};

/** Feeds a future prop-driven `HeroSection` (title, imagery, pills, meta bar). */
export type V0EastHeroAdapterModel = {
  backgroundImageUrl: string;
  title: string;
  subtitle: string;
  /** Third pill in v0 (“East Jeju”); legacy uses pickup area or city when available. */
  regionPill: string;
  /** Up to two glass pills under subtitle (v0 shows max 2). */
  badgePills: string[];
  meta: V0EastHeroMetaModel;
};

/** Feeds a future prop-driven sticky booking bar (desktop + mobile price row). */
export type V0EastStickyBookingBarModel = {
  /** e.g. “From” — still localized in UI layer */
  pricePrefixKey: 'tour.stickyPriceFrom';
  displayMode: 'east_anchor_krw' | 'east_anchor_usd' | 'db_krw' | 'db_usd';
  /** Integer KRW for east-anchor path when displayMode is east_anchor_krw */
  eastAnchorKrwRounded?: number;
  eastAnchorUsd?: number;
  /** DB / availability unit path */
  unitKrw?: number;
  usdFromUnitKrwRounded?: number;
  /** Pre-formatted with site `formatPrice` when displayMode is db_krw */
  formattedUnitKrw?: string;
  /** Person vs group — i18n suffix in UI */
  priceType: 'person' | 'group';
};

export type V0EastItineraryStopModel = {
  number: number;
  time: string;
  duration: string;
  name: string;
  category: string;
  description: string;
  image: string;
  highlights: string[];
  whyOnRoute: string;
  timeUsed: string[];
  visitBasics: {
    hours: string;
    closed: string;
    admission: string;
    walking: string;
  };
  convenience: {
    restroom: string;
    parking: string;
  };
  smartNotes: {
    photo: string;
    facilities: string;
    tip: string;
  };
};

export type V0EastFaqItemModel = {
  question: string;
  answer: string;
  decisionRank?: number;
};
