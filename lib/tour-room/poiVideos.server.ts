/**
 * Server-only approved-video fetch (video W3 / join-tour J4).
 *
 * Mirrors facilityPins.server.ts: kept out of the client-imported poiVideos.ts
 * so no Supabase code reaches the browser bundle, and best-effort — a miss or
 * a query failure just omits the video card from the arrival metadata.
 *
 * Approval gate (VP-D10): only `status='approved'` rows serve. The upload
 * script lands everything as pending_review; the /admin/poi-videos queue is
 * the only path to approved.
 */

import {
  VIDEO_LANGUAGE_TO_ROOM_LOCALE,
  type ArrivalVideoCardMeta,
} from '@/lib/tour-room/poiVideos';

/** Minimal client shape — routes pass createServerClient() directly. */
export interface VideoDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

interface VideoRow {
  language?: string;
  version?: number;
  video_url?: string;
  poster_url?: string | null;
  duration_seconds?: number | string | null;
}

/**
 * The newest approved render per language for a POI, folded into one metadata
 * card. Returns null when nothing is approved (the arrival card simply has no
 * video block — honest absence, no placeholder).
 */
export async function fetchArrivalVideoCard(
  supabase: VideoDbClient,
  poiKey: string | null | undefined,
): Promise<ArrivalVideoCardMeta | null> {
  if (!poiKey) return null;
  try {
    const { data } = await supabase
      .from('poi_videos')
      .select('language, version, video_url, poster_url, duration_seconds')
      .eq('poi_key', poiKey)
      .eq('status', 'approved')
      .order('version', { ascending: false });
    if (!Array.isArray(data) || data.length === 0) return null;

    const urls: ArrivalVideoCardMeta['urls'] = {};
    let poster: string | null = null;
    let duration: number | null = null;
    for (const row of data as VideoRow[]) {
      const locale = row.language ? VIDEO_LANGUAGE_TO_ROOM_LOCALE[row.language] : undefined;
      if (!locale || !row.video_url || urls[locale]) continue; // rows are newest-first per language
      urls[locale] = row.video_url;
      if (!poster && row.poster_url) poster = row.poster_url;
      const seconds = typeof row.duration_seconds === 'string' ? Number(row.duration_seconds) : row.duration_seconds;
      if (duration === null && typeof seconds === 'number' && Number.isFinite(seconds)) duration = seconds;
    }
    if (Object.keys(urls).length === 0) return null;
    return { poster_url: poster, duration_seconds: duration, urls };
  } catch {
    return null;
  }
}
