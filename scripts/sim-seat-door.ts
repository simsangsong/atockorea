/**
 * sim-seat-door — put the seeded room into the one state where the seat picker
 * is reachable, so `qa-seat-door-walk.mjs` can actually open the door.
 *
 * 🔴 Why this script exists.
 *
 * `qa-seat-door-walk.mjs` shipped with its setup written as prose in a comment
 * ("push the sim booking to tomorrow and insert one ops_room_vehicles row").
 * Nobody ran it: the harness exits 2 on missing preconditions, and an exit 2
 * that nobody reads is indistinguishable from a feature that works. Live DB
 * agrees — `ops_seat_assignments` holds **0 rows** and `ops_vehicles` holds
 * **0 active vehicles** [measured 2026-08-03]. The seat picker has never been
 * used in production.
 *
 * A precondition that lives in a comment is not a precondition. This makes it
 * runnable, so the door gets walked instead of described.
 *
 * ## Two harnesses, two different tour dates
 *
 * These cannot both be satisfied by one fixture, which is why the setup was
 * left manual:
 *
 *   qa-door-fixes-walk  needs tour_date = TODAY     (arrival cards fire on the day)
 *   qa-seat-door-walk   needs tour_date = TOMORROW  (C-11: guest seat writes
 *                                                    close at 00:00 KST on the day)
 *
 * So run them in that order, flipping the fixture in between:
 *
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3181 node scripts/qa-door-fixes-walk.mjs
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-seat-door.ts
 *   WALK_BASE=http://localhost:3181 node scripts/qa-seat-door-walk.mjs
 *
 * To restore the day-of state, re-run `sim-tour-day.ts`. Cleanup is unchanged:
 * `sim-tour-day.ts --cleanup` deletes the bookings and these rows cascade with
 * them — this script deliberately adds no new drain path, because a second
 * drain path is how orphans survive a "cleanup done" message.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

const FIXTURES = path.join(__dirname, '.sim-fixtures.json');

function tomorrowKst(): string {
  // KST is UTC+9 with no DST, so a fixed offset is exact here.
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstTomorrow = new Date(kstNow.getTime() + 24 * 60 * 60 * 1000);
  return kstTomorrow.toISOString().slice(0, 10);
}

async function main() {
  if (!process.env.ALLOW_SIM_SEED) {
    console.error(
      'refusing to run without ALLOW_SIM_SEED=1 — this writes to the live database.',
    );
    process.exit(2);
  }
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error('missing supabase env');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (!existsSync(FIXTURES)) {
    console.error('🔴 no scripts/.sim-fixtures.json — run sim-tour-day.ts first.');
    process.exit(2);
  }
  const fx = JSON.parse(readFileSync(FIXTURES, 'utf8')) as {
    booking1: string;
    room1Url: string;
  };

  // The room the walk actually opens (it goes to fx.room1Url).
  const { data: room } = await service
    .from('tour_rooms')
    .select('id, tour_id, tour_date')
    .eq('booking_id', fx.booking1)
    .maybeSingle();
  if (!room) {
    console.error('🔴 no tour_room for booking1 — run sim-populate.ts first.');
    process.exit(2);
  }
  const roomId = (room as { id: string }).id;

  // ① The tour must be in the future, or the server closes guest writes (C-11).
  const target = tomorrowKst();
  await service.from('bookings').update({ tour_date: target }).eq('id', fx.booking1);
  await service.from('tour_rooms').update({ tour_date: target }).eq('id', roomId);

  // ② A vehicle whose layout is real. `loadRoomVehicles` drops any vehicle with
  //    a null layout, so a row without one buys nothing.
  const { data: layouts } = await service
    .from('ops_vehicle_layouts')
    .select('id, model, total_seats, layout_json')
    .not('layout_json', 'is', null)
    .order('total_seats', { ascending: false })
    .limit(1);
  const layout = (layouts ?? [])[0] as
    | { id: string; model: string; total_seats: number }
    | undefined;
  if (!layout) {
    console.error('🔴 no ops_vehicle_layouts row carries a layout_json — cannot seat anyone.');
    process.exit(2);
  }

  // Idempotent: re-running must not stack vehicles onto the same room, or the
  // board shows one bus per run and the picker picks the wrong one.
  const { data: existing } = await service
    .from('ops_room_vehicles')
    .select('id')
    .eq('room_id', roomId);
  if ((existing ?? []).length > 0) {
    await service.from('ops_room_vehicles').delete().eq('room_id', roomId);
  }

  const { data: inserted, error } = await service
    .from('ops_room_vehicles')
    .insert({
      room_id: roomId,
      layout_id: layout.id,
      plate_number: '12가 3456',
      driver_name: '시뮬 기사',
    })
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('🔴 insert ops_room_vehicles failed:', error.message);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        roomId,
        tourDate: target,
        roomVehicleId: (inserted as { id: string } | null)?.id ?? null,
        layout: { id: layout.id, model: layout.model, seats: layout.total_seats },
        note: 'seat picker should now be reachable; restore the day-of state with sim-tour-day.ts',
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
