/**
 * DB-backed POI knowledge for the video pipeline (plan §14.3), pure half.
 *
 * poiSource.ts only reads files: the static tour JSONs and data/poi_kb. Those
 * two are the richest sources for pilot POIs, but the catalogue that the app
 * actually serves lives in `match_pois` (+ `generated_spot_content` for stops
 * that never made it into the KB). A batch over "every POI with imagery" has
 * to see them, so this module maps those row shapes onto the same
 * VideoLocalizedPoiContent the file resolver produces.
 *
 * Mappers only — no supabase import, no fetch, no node:*. The fetching lives
 * in poiSource.server.ts.
 */

import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  type VideoLanguageCode,
  videoLanguageProfile,
} from '@/lib/video-automation/languages';
import type { VideoLocalizedPoiContent, VideoPoiSource } from '@/lib/video-automation/types';

/** `match_pois.content_locales` keys (lib/locale.ts) for each video language. */
export const MATCH_POI_LOCALE_BY_LANGUAGE: Record<VideoLanguageCode, string> = {
  en: 'en',
  'zh-Hant': 'zh-TW',
  ja: 'ja',
  es: 'es',
};

/** `generated_spot_content.content_locales` uses ROOM locales (zh-Hant → zh). */
export const ROOM_LOCALE_BY_LANGUAGE: Record<VideoLanguageCode, string> = {
  en: 'en',
  'zh-Hant': 'zh',
  ja: 'ja',
  es: 'es',
};

export interface MatchPoiVideoRow {
  poi_key: string;
  name_en?: string | null;
  name_ko?: string | null;
  names_other_locales?: Record<string, string> | null;
  content_locales?: Record<string, Record<string, unknown>> | null;
  region?: string | null;
  category?: string | null;
  default_image_url?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  description?: string | null;
  highlights?: string[] | null;
  images?: string[] | null;
  why_on_route?: string | null;
  smart_notes?: Record<string, unknown> | null;
  visit_basics?: Record<string, unknown> | null;
  convenience?: Record<string, unknown> | null;
}

export interface GeneratedSpotVideoRow {
  poi_ref: string;
  title?: string | null;
  content_locales?: Record<string, Record<string, unknown>> | null;
  status?: string | null;
}

/** The columns poiSource.server.ts selects — kept next to the mapper. */
export const MATCH_POI_VIDEO_COLUMNS =
  'poi_key, name_en, name_ko, names_other_locales, content_locales, region, category, ' +
  'default_image_url, lat, lng, description, highlights, images, why_on_route, ' +
  'smart_notes, visit_basics, convenience';

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function stringList(value: unknown, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, cap);
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const clean = text(raw);
    if (clean) out[key] = clean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function numeric(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * One language's content from a `match_pois` row: the per-locale block when it
 * exists, otherwise the row's own (English-sourced) columns. Returns null when
 * nothing narratable is present — an empty shell would only produce a script
 * that says the POI's name twice.
 */
export function localizedFromMatchPoi(
  row: MatchPoiVideoRow,
  language: VideoLanguageCode,
): VideoLocalizedPoiContent | null {
  const locale = MATCH_POI_LOCALE_BY_LANGUAGE[language];
  const block = row.content_locales?.[locale];
  const localizedName =
    text(block?.name) || text(row.names_other_locales?.[locale]) || text(row.name_en) || row.poi_key;

  const description = text(block?.description ?? row.description ?? '');
  const whyOnRoute = text(block?.why_on_route ?? row.why_on_route ?? '');
  const highlights = block?.highlights ? stringList(block.highlights, 8) : stringList(row.highlights, 8);
  const smartNotes = stringRecord(block?.smart_notes ?? row.smart_notes);
  const visitBasics = stringRecord(block?.visit_basics ?? row.visit_basics);
  const convenience = stringRecord(block?.convenience ?? row.convenience);
  const images = block?.images ? stringList(block.images, 24) : stringList(row.images, 24);
  const image = text(block?.image) || text(row.default_image_url) || images[0] || '';

  const hasNarratable =
    Boolean(description || whyOnRoute) || highlights.length > 0 || Boolean(smartNotes);
  if (!hasNarratable) return null;

  return {
    language,
    sourceLocale: block ? locale : 'en',
    name: localizedName,
    category: text(row.category),
    description: description || whyOnRoute,
    image: image || undefined,
    images: images.length > 0 ? images : undefined,
    highlights,
    visitBasics,
    convenience,
    smartNotes,
    sourceFactIds: [`db:match_pois:${row.poi_key}`, ...(block ? [`db:match_pois:${row.poi_key}:${locale}`] : [])],
    sourcePath: `db:match_pois/${row.poi_key}`,
  };
}

/** One language's content from a ready `generated_spot_content` row. */
export function localizedFromGeneratedSpot(
  row: GeneratedSpotVideoRow,
  language: VideoLanguageCode,
): VideoLocalizedPoiContent | null {
  if ((row.status ?? 'ready') !== 'ready') return null;
  const block = row.content_locales?.[ROOM_LOCALE_BY_LANGUAGE[language]] ?? row.content_locales?.en;
  if (!block) return null;
  const description = text(block.description);
  const highlights = stringList(block.highlights, 8);
  if (!description && highlights.length === 0) return null;
  return {
    language,
    sourceLocale: videoLanguageProfile(language).sourceLocale,
    name: text(block.name) || text(row.title) || row.poi_ref,
    description,
    highlights,
    visitBasics: stringRecord(block.visitBasics),
    convenience: stringRecord(block.convenience),
    smartNotes: stringRecord(block.smartNotes),
    sourceFactIds: [`db:generated_spot_content:${row.poi_ref}`],
    sourcePath: `db:generated_spot_content/${row.poi_ref}`,
  };
}

/**
 * Fold DB content into a file-resolved source (or stand alone when the POI has
 * no static tour JSON). File content wins per language — it is human-authored
 * and carries the imageCredits the licence gate reads; DB content only fills
 * languages the files do not cover.
 */
export function mergePoiSources(
  base: VideoPoiSource | null,
  extra: VideoPoiSource | null,
): VideoPoiSource | null {
  if (!base) return extra;
  if (!extra) return base;
  const localized: VideoPoiSource['localized'] = { ...extra.localized };
  for (const [language, content] of Object.entries(base.localized)) {
    if (content) localized[language as VideoLanguageCode] = content;
  }
  return {
    ...base,
    region: base.region ?? extra.region ?? null,
    coordinates: base.coordinates ?? extra.coordinates ?? null,
    localized,
    sourcePaths: [...new Set([...base.sourcePaths, ...extra.sourcePaths])],
  };
}

/** A standalone source built from DB rows only. Null when no language filled. */
export function sourceFromDbRows(input: {
  poiKey: string;
  matchPoi?: MatchPoiVideoRow | null;
  generated?: GeneratedSpotVideoRow | null;
  languages?: VideoLanguageCode[];
}): VideoPoiSource | null {
  const languages = input.languages ?? [...DEFAULT_VIDEO_LANGUAGE_CODES];
  const localized: VideoPoiSource['localized'] = {};
  const sourcePaths = new Set<string>();

  for (const language of languages) {
    const fromMatch = input.matchPoi ? localizedFromMatchPoi(input.matchPoi, language) : null;
    const fromGenerated = input.generated ? localizedFromGeneratedSpot(input.generated, language) : null;
    const content = fromMatch ?? fromGenerated;
    if (!content) continue;
    localized[language] = content;
    if (content.sourcePath) sourcePaths.add(content.sourcePath);
  }
  if (Object.keys(localized).length === 0) return null;

  const lat = numeric(input.matchPoi?.lat);
  const lng = numeric(input.matchPoi?.lng);
  return {
    poiId: input.poiKey,
    canonicalName:
      localized.en?.name ?? Object.values(localized)[0]?.name ?? text(input.matchPoi?.name_en) ?? input.poiKey,
    region: text(input.matchPoi?.region) || null,
    coordinates: lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null,
    tourSlug: null,
    localized,
    sourcePaths: [...sourcePaths],
  };
}
