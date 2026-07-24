/**
 * Server-only approved safety-video fetch (plan §5.6, §7 Phase 4).
 *
 * Mirrors poiVideos.server.ts exactly — same table, same approval gate — so the
 * safety film reuses the shipped review queue (`/admin/poi-videos`) instead of
 * growing a parallel one. The discriminator is `poi_videos.kind='safety'`
 * (migration 20260725120000), with the sentinel poi_key + language 'mul'
 * because the render is silent and language-neutral.
 *
 * Best-effort: a miss or a query failure returns null and the safety card ships
 * as text only. There is deliberately no placeholder player.
 */

import {
  SAFETY_SUBTITLE_TRACKS,
  SAFETY_VIDEO_LANGUAGE,
  SAFETY_VIDEO_POI_KEY,
  type SafetyVideoCardMeta,
} from '@/lib/tour-room/safetyVideo';

/** Minimal client shape — routes pass createServerClient() directly. */
export interface SafetyVideoDbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

interface SafetyVideoRow {
  video_url?: string;
  poster_url?: string | null;
  duration_seconds?: number | string | null;
}

/**
 * The newest approved safety render, folded into the card metadata. Returns
 * null while nobody has produced/approved one (the expected state today).
 */
export async function fetchSafetyVideoCard(
  supabase: SafetyVideoDbClient,
): Promise<SafetyVideoCardMeta | null> {
  try {
    const { data } = await supabase
      .from('poi_videos')
      .select('video_url, poster_url, duration_seconds, version')
      .eq('kind', 'safety')
      .eq('poi_key', SAFETY_VIDEO_POI_KEY)
      .eq('language', SAFETY_VIDEO_LANGUAGE)
      .eq('status', 'approved')
      .order('version', { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? (data[0] as SafetyVideoRow | undefined) : undefined;
    if (!row?.video_url) return null;
    const raw = typeof row.duration_seconds === 'string' ? Number(row.duration_seconds) : row.duration_seconds;
    return {
      video_url: row.video_url,
      poster_url: row.poster_url ?? null,
      duration_seconds: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
      tracks: [...SAFETY_SUBTITLE_TRACKS],
    };
  } catch {
    return null;
  }
}
