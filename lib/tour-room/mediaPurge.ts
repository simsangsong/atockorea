/**
 * Room media purge — the storage half of "delete the room".
 *
 * 🔴 Why this exists: `sim-tour-day.ts --cleanup` deleted bookings, and
 * `tour_rooms` cascades from there, so every row went away and the script
 * printed `leftover: 0`. The OBJECTS did not go away. Twelve of them were still
 * sitting in `tour-room-photos` under `att/<roomId>/` for six rooms that no
 * longer existed — a cleanup that reports success while leaving orphans behind
 * is the failure that seeder rewrite was supposed to end, and it had a second
 * half nobody had noticed.
 *
 * ⚠ `storage.objects` cannot be deleted with SQL — a `storage.protect_delete()`
 * trigger refuses it ("Use the Storage API instead"). So this goes through the
 * Storage API, which also means the room's objects have to be LISTED before the
 * room row is deleted: after the cascade there is nothing left to say which
 * paths were that room's.
 */

import { ROOM_AUDIO_BUCKET, ROOM_PHOTOS_BUCKET } from '@/lib/tour-room/roomMedia';

export interface PurgeStorageClient {
  storage: {
    from(bucket: string): {
      list(
        prefix: string,
        options?: { limit?: number; offset?: number },
      ): Promise<{ data: Array<{ name: string }> | null; error: unknown }>;
      remove(paths: string[]): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

/** Object prefixes a room owns, per bucket. */
export function roomMediaPrefixes(roomId: string): Array<{ bucket: string; prefix: string }> {
  return [
    { bucket: ROOM_PHOTOS_BUCKET, prefix: `att/${roomId}` },
    { bucket: ROOM_PHOTOS_BUCKET, prefix: `vision/${roomId}` },
    { bucket: ROOM_AUDIO_BUCKET, prefix: `tour-room-tts/${roomId}` },
  ];
}

/** List every object under a prefix, paging past the API's 100-item default. */
export async function listAllUnder(
  supabase: PurgeStorageClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error || !data || data.length === 0) break;
    for (const entry of data) out.push(`${prefix}/${entry.name}`);
    if (data.length < PAGE) break;
  }
  return out;
}

export interface PurgeResult {
  /** Paths removed, per bucket. */
  removed: Record<string, string[]>;
  total: number;
}

/**
 * Remove every stored object belonging to the given rooms.
 *
 * `dryRun` lists without deleting — the default for the standalone script,
 * because "which twelve objects" is a question worth answering before the
 * answer becomes unavailable.
 */
export async function purgeRoomMedia(
  supabase: PurgeStorageClient,
  roomIds: readonly string[],
  options: { dryRun?: boolean } = {},
): Promise<PurgeResult> {
  const removed: Record<string, string[]> = {};
  let total = 0;

  const byBucket = new Map<string, string[]>();
  for (const roomId of roomIds) {
    for (const { bucket, prefix } of roomMediaPrefixes(roomId)) {
      const paths = await listAllUnder(supabase, bucket, prefix);
      if (paths.length === 0) continue;
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), ...paths]);
    }
  }

  for (const [bucket, paths] of byBucket) {
    removed[bucket] = paths;
    total += paths.length;
    if (options.dryRun) continue;
    // The Storage API caps a remove() batch; chunk rather than trusting it.
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    }
  }

  return { removed, total };
}
