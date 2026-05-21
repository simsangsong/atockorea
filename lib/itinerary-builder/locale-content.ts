import type { Locale } from "@/lib/locale";
import type { MatchPoiRow, PoiLocalizedContent } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function getStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(getString).filter(Boolean) as string[];
  return out.length > 0 ? out : null;
}

function getObject(v: unknown): Record<string, unknown> | null {
  return isRecord(v) && Object.keys(v).length > 0 ? v : null;
}

export function normalizeBuilderLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  if (raw === "zh-CN") return "zh";
  if (raw === "en" || raw === "ko" || raw === "ja" || raw === "zh" || raw === "zh-TW" || raw === "es") {
    return raw;
  }
  return null;
}

function contentForLocale(poi: MatchPoiRow, locale: Locale): PoiLocalizedContent | null {
  const raw = poi.content_locales?.[locale];
  return isRecord(raw) ? raw : null;
}

export function localizePoiRow(poi: MatchPoiRow, locale: Locale): MatchPoiRow {
  const content = contentForLocale(poi, locale);
  if (!content || locale === "en") return poi;

  const localizedName =
    getString(content.name) ||
    (locale === "ko" ? poi.name_ko : getString(poi.names_other_locales?.[locale])) ||
    poi.name_en;

  return {
    ...poi,
    name_en: localizedName,
    name_ko: poi.name_ko && poi.name_ko !== localizedName ? poi.name_ko : null,
    category: getString(content.category) ?? poi.category,
    description: getString(content.description) ?? poi.description,
    highlights: getStringArray(content.highlights) ?? poi.highlights,
    why_on_route: getString(content.why_on_route) ?? poi.why_on_route,
    smart_notes: getObject(content.smart_notes) ?? poi.smart_notes,
    visit_basics: getObject(content.visit_basics) ?? poi.visit_basics,
    convenience: getObject(content.convenience) ?? poi.convenience,
  };
}
