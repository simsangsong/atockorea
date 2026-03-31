import type { Locale } from "@/lib/locale";
import type { WeatherAdvisoryKind } from "@/lib/weather/advisory-templates";

/** Tour detail weather strip: situation-specific copy (rain / wind / both). Editable in DB. */
export type WeatherTourAdvisoryCopy = { title: string; body: string };

export type WeatherTourAdvisoriesConfig = Partial<
  Record<Locale, Partial<Record<WeatherAdvisoryKind, WeatherTourAdvisoryCopy>>>
>;

/** Stored in site_settings.cms_content_overrides */
export type CmsContentOverrides = {
  messages?: Partial<Record<Locale, Record<string, unknown>>>;
  siteCopy?: Partial<Record<Locale, Record<string, unknown>>>;
  /** Flat map: e.g. hero.feature -> URL */
  sectionImages?: Record<string, string>;
  /** `/api/weather/forecast` merges with code fallbacks when Open-Meteo triggers rain/wind. */
  weatherTourAdvisories?: WeatherTourAdvisoriesConfig;
};

/** Full export / import payload (effective copy for translators) */
export type CmsExportPayload = {
  version: number;
  exportedAt: string;
  messages: Record<string, unknown>;
  siteCopy: Record<string, unknown>;
  sectionImages: Record<string, string>;
};
