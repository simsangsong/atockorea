/**
 * A3 — the POI master as an arrival-content tier.
 *
 * The arrival card resolved content as curated → poi_kb → generated and never
 * looked at `match_pois`, even though that table is where the itinerary builder
 * and the tour-product pages get their writing. The live gap this left:
 *
 *   tour_guide_spots (curated)  ...  11 POIs, 6 locales
 *   poi_kb (static fact sheet)  ...  82 POIs, ENGLISH ONLY, no prose at all
 *   match_pois.content_locales  ... 117 en / 114 ko / 77 each ja·es·zh·zh-TW
 *                                    — full descriptions, highlights, tips
 *
 * So a stop outside the 11 curated ones announced itself with opening hours and
 * a restroom note, in English, while a 2,000-character description of the place
 * sat one table away. This reads it.
 *
 * It UPGRADES rather than replaces: poi_kb owns the practical rows
 * (hours / closed / admission / restroom / parking), match_pois owns the story.
 * Merged, a stop gets both. Curated content still wins outright — it was
 * written for exactly this card.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import type {
  SpotArrivalContent,
  SpotContentByLocale,
  ResolvedSpotContent,
} from '@/lib/tour-room/spotContent';
import type { RoomDbClient } from '@/lib/tour-room/access';

/** One locale's entry inside `match_pois.content_locales`. */
interface PoiLocaleEntry {
  name?: string;
  description?: string;
  highlights?: unknown;
  insider_tip?: string;
  best_time?: string;
  [key: string]: unknown;
}

interface MatchPoiRow {
  poi_key: string;
  name_en: string | null;
  description: string | null;
  highlights: unknown;
  images: unknown;
  default_image_url: string | null;
  visit_basics: Record<string, unknown> | null;
  convenience: Record<string, unknown> | null;
  smart_notes: Record<string, unknown> | null;
  content_locales: Record<string, PoiLocaleEntry> | null;
  /** A4 review gate — a locale is served only when this says 'approved'. */
  content_locale_status: Record<string, string> | null;
}

/**
 * A4 — fail-closed by design. Absent status means NOT approved, so content
 * written without a review decision stages invisibly instead of publishing
 * itself. Everything live at migration time was seeded 'approved'.
 */
function isApproved(row: MatchPoiRow, locale: string): boolean {
  return row.content_locale_status?.[locale] === 'approved';
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, limit);
}

function firstImage(row: MatchPoiRow): string | undefined {
  if (typeof row.default_image_url === 'string' && row.default_image_url) return row.default_image_url;
  const images = row.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (typeof image === 'string' && image) return image;
      if (image && typeof image === 'object') {
        const url = (image as { url?: unknown; src?: unknown }).url ?? (image as { src?: unknown }).src;
        if (typeof url === 'string' && url) return url;
      }
    }
  }
  return undefined;
}

/** Build one locale's briefing out of a POI row, or null when it has no prose. */
function briefingFor(row: MatchPoiRow, locale: RoomLocale): { content: SpotArrivalContent; lang: RoomLocale } | null {
  const byLocale = row.content_locales ?? {};
  // A4 — an unapproved locale is invisible: it falls through to English exactly
  // as an untranslated one would, rather than publishing itself.
  const exact = isApproved(row, locale) ? byLocale[locale] : undefined;
  const englishOk = isApproved(row, 'en');
  const entry = exact ?? (englishOk ? byLocale.en : undefined);
  const lang: RoomLocale = exact ? locale : 'en';
  // The row's own columns ARE the English master, so they ride the same gate.
  if (!exact && !englishOk) return null;

  // A locale entry overrides the master.
  const description = (entry?.description ?? (lang === 'en' ? row.description : null) ?? '').trim();
  const highlights = stringList(entry?.highlights ?? (lang === 'en' ? row.highlights : null), 6);
  if (!description && highlights.length === 0) return null;

  const tip = typeof entry?.insider_tip === 'string' ? entry.insider_tip.trim() : '';
  const bestTime = typeof entry?.best_time === 'string' ? entry.best_time.trim() : '';

  const content: SpotArrivalContent = {
    name: entry?.name?.trim() || row.name_en || row.poi_key,
    ...(description ? { description } : {}),
    ...(highlights.length ? { highlights } : {}),
    ...(firstImage(row) ? { image: firstImage(row) } : {}),
    ...(row.visit_basics ? { visitBasics: row.visit_basics as SpotArrivalContent['visitBasics'] } : {}),
    ...(row.convenience ? { convenience: row.convenience as SpotArrivalContent['convenience'] } : {}),
  };

  // smartNotes carries the operator's static notes plus this locale's tip; the
  // tip is the guide-ish line, so it must not be overwritten by the master row.
  const smartNotes = { ...((row.smart_notes as Record<string, unknown>) ?? {}) };
  if (tip) smartNotes.tip = tip;
  if (bestTime && !smartNotes.photo) smartNotes.photo = bestTime;
  if (Object.keys(smartNotes).length > 0) {
    content.smartNotes = smartNotes as SpotArrivalContent['smartNotes'];
  }

  return { content, lang };
}

/**
 * Merge the POI master into an already-resolved per-locale map.
 *
 * `base` is what `resolveSpotContentForLocales` produced (curated, else the
 * poi_kb fact sheet, else nothing). Curated entries are left untouched; every
 * other locale gets the story layered on top of whatever facts it already had.
 *
 * Best-effort by contract — any failure leaves `base` exactly as it was, so an
 * arrival never fails to send because the POI table was slow.
 */
export async function withMatchPoiContent(
  supabase: RoomDbClient,
  poiKey: string | null | undefined,
  locales: readonly string[],
  base: SpotContentByLocale,
): Promise<SpotContentByLocale> {
  if (!poiKey) return base;
  try {
    const { data } = await supabase
      .from('match_pois')
      .select(
        'poi_key, name_en, description, highlights, images, default_image_url, visit_basics, convenience, smart_notes, content_locales, content_locale_status',
      )
      .eq('poi_key', poiKey)
      .maybeSingle();
    const row = data as MatchPoiRow | null;
    if (!row) return base;

    const merged: SpotContentByLocale = { ...base };
    for (const raw of locales) {
      if (!ROOM_LOCALES.includes(raw as RoomLocale)) continue;
      const locale = raw as RoomLocale;
      // Curated content was written for this card — never second-guess it.
      if (merged[locale]?.tier === 'curated') continue;

      const briefing = briefingFor(row, locale);
      if (!briefing) continue;

      const facts = merged[locale]?.content;
      const resolved: ResolvedSpotContent = {
        // Facts first so the story's own fields win where both exist.
        content: { ...(facts ?? {}), ...briefing.content },
        lang: briefing.lang,
        tier: 'match_poi',
      };
      merged[locale] = resolved;
    }
    return merged;
  } catch {
    return base;
  }
}
