/**
 * Charter duration codes → what the guest reads.
 *
 * 🔴 Why this file exists. `pricingTiers.durations` is BOTH the lookup key
 * (`tier.prices[duration]`) and, until now, the on-screen label. A translation
 * pass did the obvious thing and translated the label — so `durations` became
 * ["4시간","10시간"] while `prices` stayed keyed "4h"/"10h", every lookup
 * returned `undefined`, and the rate card rendered "—" in every cell on
 * ko/ja/zh/zh-TW. `seoul-suburbs-private-chartered-car-10hr` and
 * `seoul-dmz-private-3rd-tunnel-suspension-bridge` both shipped that way.
 *
 * Restoring the data alone would have left the trap armed: the next translator
 * would translate it again, correctly by their lights. So the code stays a
 * code, and the label is derived here. `lib/i18n/pipeline/segments.ts` already
 * marks `pricingTiers` FORBIDDEN — this makes obeying that rule cost nothing,
 * because an English code is no longer what the guest would see.
 */

/** A duration the guest may pick, as stored: "5h".."10h", or "flat". */
export type ChargeDurationCode = string;

const HOURS: Record<string, (n: string) => string> = {
  ko: (n) => `${n}시간`,
  ja: (n) => `${n}時間`,
  zh: (n) => `${n}小时`,
  "zh-TW": (n) => `${n}小時`,
  es: (n) => `${n} h`,
  de: (n) => `${n} Std.`,
  fr: (n) => `${n} h`,
  it: (n) => `${n} ore`,
  ru: (n) => `${n} ч`,
  en: (n) => `${n}h`,
};

const FLAT: Record<string, string> = {
  ko: "균일가",
  ja: "一律料金",
  zh: "统一价",
  "zh-TW": "統一價",
  es: "Tarifa fija",
  de: "Pauschalpreis",
  fr: "Forfait",
  it: "Tariffa fissa",
  ru: "Единая цена",
  en: "Flat rate",
};

const DURATION_HEADING: Record<string, string> = {
  ko: "이용 시간",
  ja: "ご利用時間",
  zh: "用车时长",
  "zh-TW": "用車時數",
  es: "Duración",
  de: "Dauer",
  fr: "Durée",
  it: "Durata",
  ru: "Длительность",
  en: "Duration",
};

/**
 * Render a stored duration code in the page's language.
 *
 * An unrecognised code is returned verbatim rather than blanked: a new tier
 * shape should look odd on screen, not disappear from the picker.
 */
export function formatChargeDuration(code: ChargeDurationCode, locale?: string): string {
  const loc = locale && locale in HOURS ? locale : "en";
  const hours = /^(\d+)\s*h$/i.exec(code);
  if (hours) return HOURS[loc]!(hours[1]!);
  if (code === "flat") return FLAT[loc] ?? FLAT.en!;
  return code;
}

/** The "Duration" heading above the picker — was hardcoded English. */
export function chargeDurationHeading(locale?: string): string {
  return (locale && DURATION_HEADING[locale]) || DURATION_HEADING.en!;
}
