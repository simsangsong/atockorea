import type { Locale } from "@/lib/locale";
import siteCopyEn from "@/messages/siteCopy/en.json";
import siteCopyKo from "@/messages/siteCopy/ko.json";
import siteCopyJa from "@/messages/siteCopy/ja.json";
import siteCopyZh from "@/messages/siteCopy/zh.json";
import siteCopyZhTW from "@/messages/siteCopy/zh-TW.json";
import siteCopyEs from "@/messages/siteCopy/es.json";

export type SiteCopy = typeof siteCopyEn;

const byLocale: Record<Locale, SiteCopy> = {
  en: siteCopyEn,
  ko: siteCopyKo,
  ja: siteCopyJa,
  zh: siteCopyZh,
  "zh-TW": siteCopyZhTW,
  es: siteCopyEs,
};

export function getSiteCopyBaseline(locale: Locale): SiteCopy {
  return byLocale[locale] ?? siteCopyEn;
}

/** @deprecated Use getSiteCopyBaseline; kept for any direct imports. */
export function getSiteCopy(locale: Locale): SiteCopy {
  return getSiteCopyBaseline(locale);
}
