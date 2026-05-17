import { Flower2, Leaf, Snowflake, Sprout, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Date-driven seasonal hook for the home hero.
 *
 * Korea has the strongest seasonal travel rhythm of any East-Asia
 * destination — cherry blossom (Mar-Apr), late spring (May), summer
 * (Jun-Aug), autumn foliage (Sep-Nov), winter (Dec-Feb). Surfacing the
 * current season on the hero gives the visitor an immediate "this is
 * relevant now" signal — a small but consistent conversion lift in
 * OTA marketing benchmarks (~15-25% on first-fold engagement).
 *
 * Map kept month-based (not day-based) so the labels feel like a
 * monthly editorial decision rather than a daily rotation.
 */

export type SeasonKey =
  | "springBlossom"
  | "lateSpring"
  | "summer"
  | "autumn"
  | "winter";

export type SeasonConfig = {
  key: SeasonKey;
  /** i18n key under `premium.v2.season.*` for the chip display label. */
  labelKey: string;
  /** i18n key under `premium.v2.season.*` for the short phrase injected
   *  into the matcher intent textarea when the chip is clicked (Phase C.1).
   *  Kept distinct from `labelKey` because the display label may be longer
   *  ("Autumn foliage · Peak season") than the phrase to inject
   *  ("autumn foliage"). */
  phraseKey: string;
  Icon: LucideIcon;
};

// Korea-local season framing (not the US/EU calendar one). May reads as
// early summer to Koreans — temps often hit 25°C+, festival season
// ramps, cherry blossom is long gone. `lateSpring` config kept defined
// below for future day-level granularity (e.g., late April) but no
// month currently maps to it.
const SEASON_BY_MONTH: Record<number, SeasonKey> = {
  0: "winter", // Jan
  1: "winter", // Feb
  2: "springBlossom", // Mar
  3: "springBlossom", // Apr
  4: "summer", // May — Korean local: early summer
  5: "summer", // Jun
  6: "summer", // Jul
  7: "summer", // Aug
  8: "autumn", // Sep
  9: "autumn", // Oct
  10: "autumn", // Nov
  11: "winter", // Dec
};

const SEASON_CONFIG: Record<SeasonKey, SeasonConfig> = {
  springBlossom: {
    key: "springBlossom",
    labelKey: "premium.v2.season.springBlossom",
    phraseKey: "premium.v2.season.springBlossomPhrase",
    Icon: Flower2,
  },
  lateSpring: {
    key: "lateSpring",
    labelKey: "premium.v2.season.lateSpring",
    phraseKey: "premium.v2.season.lateSpringPhrase",
    Icon: Sprout,
  },
  summer: {
    key: "summer",
    labelKey: "premium.v2.season.summer",
    phraseKey: "premium.v2.season.summerPhrase",
    Icon: Sun,
  },
  autumn: {
    key: "autumn",
    labelKey: "premium.v2.season.autumn",
    phraseKey: "premium.v2.season.autumnPhrase",
    Icon: Leaf,
  },
  winter: {
    key: "winter",
    labelKey: "premium.v2.season.winter",
    phraseKey: "premium.v2.season.winterPhrase",
    Icon: Snowflake,
  },
};

export function getCurrentSeason(date: Date = new Date()): SeasonConfig {
  return SEASON_CONFIG[SEASON_BY_MONTH[date.getMonth()]];
}
