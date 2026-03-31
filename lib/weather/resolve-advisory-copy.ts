import type { Locale } from "@/lib/locale"
import type { CmsContentOverrides } from "@/lib/cms-content.types"
import { WEATHER_ADVISORY_COPY, type WeatherAdvisoryKind } from "@/lib/weather/advisory-templates"

export type WeatherAdvisoryBlock = {
  kind: WeatherAdvisoryKind
  title: string
  body: string
}

function trimText(s: string | undefined): string {
  return typeof s === "string" ? s.trim() : ""
}

/**
 * DB `cms_content_overrides.weatherTourAdvisories[locale][kind]` overrides repo fallbacks.
 * Locale chain: requested → `en`.
 */
export function resolveAdvisoryBlocksFromDb(
  kinds: WeatherAdvisoryKind[],
  overrides: CmsContentOverrides,
  locale: Locale
): WeatherAdvisoryBlock[] {
  const cfg = overrides.weatherTourAdvisories
  const pick = (loc: Locale) => cfg?.[loc] ?? undefined
  const primary = pick(locale)
  const fallbackLoc = pick("en")

  return kinds.map((kind) => {
    const fb = WEATHER_ADVISORY_COPY[kind]
    const row = primary?.[kind] ?? fallbackLoc?.[kind]
    const title = trimText(row?.title)
    const body = trimText(row?.body)
    return {
      kind,
      title: title || fb.title,
      body: body || fb.body,
    }
  })
}
