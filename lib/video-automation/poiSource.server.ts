/**
 * POI resolution for the video pipeline, server half (plan §14.3).
 *
 * Order of preference, richest first:
 *   1. static tour JSON  — human-authored stop copy + imageCredits (licence gate)
 *   2. data/poi_kb        — the curated fact sheet
 *   3. match_pois         — the served catalogue (content_locales per language)
 *   4. generated_spot_content — the AI tier, only for stops the KB never covered
 *
 * 1–2 come from poiSource.ts (files); 3–4 are fetched here and folded in by
 * mergePoiSources. A miss on the DB side is never fatal — the file source alone
 * is a complete input, and vice versa.
 */

import {
  DEFAULT_VIDEO_LANGUAGE_CODES,
  type VideoLanguageCode,
} from '@/lib/video-automation/languages';
import {
  MATCH_POI_VIDEO_COLUMNS,
  mergePoiSources,
  sourceFromDbRows,
  type GeneratedSpotVideoRow,
  type MatchPoiVideoRow,
} from '@/lib/video-automation/poiDbSource';
import { resolvePoiSource } from '@/lib/video-automation/poiSource';
import type { VideoPoiSource } from '@/lib/video-automation/types';

/** Minimal client shape — scripts pass createServerClient() directly. */
export interface VideoSourceDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface ResolveVideoSourceOptions {
  poi: string;
  tour?: string;
  languages?: VideoLanguageCode[];
  /** Skip the DB legs entirely (offline / file-only runs). */
  filesOnly?: boolean;
}

export async function fetchMatchPoiRow(
  supabase: VideoSourceDbClient,
  poiKey: string,
): Promise<MatchPoiVideoRow | null> {
  try {
    const { data } = await supabase
      .from('match_pois')
      .select(MATCH_POI_VIDEO_COLUMNS)
      .eq('poi_key', poiKey)
      .maybeSingle();
    return (data as MatchPoiVideoRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Any ready generated block for this POI. The table is booking-scoped, so the
 * newest ready row for `poi:<key>` is used — the copy describes the place, not
 * the booking.
 */
export async function fetchGeneratedSpotRow(
  supabase: VideoSourceDbClient,
  poiKey: string,
): Promise<GeneratedSpotVideoRow | null> {
  try {
    const { data } = await supabase
      .from('generated_spot_content')
      .select('poi_ref, title, content_locales, status')
      .eq('poi_ref', `poi:${poiKey}`)
      .eq('status', 'ready')
      .order('updated_at', { ascending: false })
      .limit(1);
    const rows = (data ?? []) as GeneratedSpotVideoRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Full resolution across files + DB. Throws only when NO source knows the POI —
 * that is a genuine "nothing to say about this place", not a transient failure.
 */
export async function resolveVideoPoiSource(
  root: string,
  supabase: VideoSourceDbClient | null,
  options: ResolveVideoSourceOptions,
): Promise<VideoPoiSource> {
  const languages = options.languages ?? [...DEFAULT_VIDEO_LANGUAGE_CODES];

  let fileSource: VideoPoiSource | null = null;
  try {
    fileSource = resolvePoiSource(root, { poi: options.poi, tour: options.tour, languages });
  } catch {
    fileSource = null;
  }

  let dbSource: VideoPoiSource | null = null;
  if (supabase && !options.filesOnly) {
    const [matchPoi, generated] = await Promise.all([
      fetchMatchPoiRow(supabase, options.poi),
      fetchGeneratedSpotRow(supabase, options.poi),
    ]);
    dbSource = sourceFromDbRows({ poiKey: options.poi, matchPoi, generated, languages });
  }

  const merged = mergePoiSources(fileSource, dbSource);
  if (!merged) {
    throw new Error(
      `POI not found in static tour JSON, poi_kb, match_pois, or generated_spot_content: ${options.poi}`,
    );
  }
  return merged;
}
