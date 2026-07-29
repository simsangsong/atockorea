/**
 * Delete room-media objects whose room no longer exists.
 *
 * Why a script and not the migration: `storage.protect_delete()` refuses a SQL
 * DELETE on `storage.objects` ("Use the Storage API instead"), so orphan
 * cleanup has to go through the Storage API with the service role.
 *
 * Dry run by default. `--apply` deletes.
 *
 *   npx tsx scripts/purge-orphan-room-media.ts
 *   npx tsx scripts/purge-orphan-room-media.ts --apply
 *
 * ⚠ Exits 2 when it cannot authenticate. A purge script that reports "0
 * orphans" because it never connected is indistinguishable from a clean bucket,
 * and this repo has been bitten by exactly that shape before.
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { ROOM_AUDIO_BUCKET, ROOM_PHOTOS_BUCKET } from '../lib/tour-room/roomMedia';
import { purgeRoomMedia, type PurgeStorageClient } from '../lib/tour-room/mediaPurge';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const apply = process.argv.includes('--apply');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: probe, error: probeError } = await service.from('tour_rooms').select('id').limit(1);
  if (probeError || !probe) {
    console.error('cannot read tour_rooms — refusing to report 0 orphans:', probeError?.message);
    process.exit(2);
  }

  // Every room id referenced by an object path, in both buckets.
  const referenced = new Set<string>();
  for (const [bucket, prefixes] of [
    [ROOM_PHOTOS_BUCKET, ['att', 'vision']],
    [ROOM_AUDIO_BUCKET, ['tour-room-tts']],
  ] as const) {
    for (const prefix of prefixes) {
      const { data } = await service.storage.from(bucket).list(prefix, { limit: 1000 });
      for (const entry of data ?? []) {
        // `list(prefix)` returns the room folders themselves at this level.
        if (entry.name) referenced.add(entry.name);
      }
    }
  }

  if (referenced.size === 0) {
    console.log('no room-media objects at all — nothing to purge');
    return;
  }

  const { data: liveRooms } = await service
    .from('tour_rooms')
    .select('id')
    .in('id', [...referenced]);
  const live = new Set((liveRooms ?? []).map((r) => String(r.id)));
  const orphans = [...referenced].filter((id) => !live.has(id));

  console.log(
    `rooms referenced by storage: ${referenced.size} · still live: ${live.size} · orphaned: ${orphans.length}`,
  );
  if (orphans.length === 0) return;

  const result = await purgeRoomMedia(service as unknown as PurgeStorageClient, orphans, {
    dryRun: !apply,
  });
  for (const [bucket, paths] of Object.entries(result.removed)) {
    console.log(`  ${bucket}: ${paths.length}`);
    for (const p of paths) console.log(`    ${apply ? 'removed' : 'would remove'} ${p}`);
  }
  console.log(apply ? `purged ${result.total} objects` : `dry run — ${result.total} objects (pass --apply)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
