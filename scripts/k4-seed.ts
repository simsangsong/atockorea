/**
 * K4v2 Phase 2 — seed the 20 rooms a full-feature coverage run needs.
 *
 *   ALLOW_SIM_SEED=1 npx tsx scripts/k4-seed.ts
 *   npx tsx scripts/sim-tour-day.ts --cleanup     ← drains these too
 *
 * 🔴 Deliberately NOT a second cleanup path. Every row here carries the same
 * `sim_tag` and contact email as `sim-tour-day.ts`, so the existing drain
 * command removes them and there is exactly one place that knows how to undo a
 * simulation. A harness that seeds through one door and cleans through another
 * is how orphans survive a "cleanup done" message.
 *
 * ## Why 11 private / 9 join
 *
 * The owner's instruction was "private and join mixed, in the live booking
 * ratio". Measured on live `bookings` joined to `tours` (excluding sim rows),
 * 2026-07-31: **private 7, join 6** — 53.8% private. Scaled to 20 that is 11/9.
 *
 * `tours.price_type = 'vehicle'` is the authoritative discriminator
 * (`lib/tour-room/tourKind.ts`); everything else is a join tour. That matters
 * for coverage, not just realism: `POST /extend` rejects non-private bookings
 * with 400 `private_only`, and the planner only shows its editor for a charter.
 * A run seeded entirely from one kind would report those routes as broken.
 *
 * ## What this does NOT do
 *
 * No payment rows, no ledger entries, no aggregates — `sim_tag` keeps these out
 * of money and reporting (A0.1). They are still real rows in the live database.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import {
  signCustomerRoomToken,
  signDriverRoomToken,
  signGuideRoomToken,
} from '../lib/tour-room/token';
import { kstToday } from '../lib/tour-room/time';
import { K4_ROOMS } from '../lib/audit/k4Coverage';
import { SESSION_SIM_TAG } from './simSessionTag';

loadEnvConfig(process.cwd());

/** Same tag + address as sim-tour-day.ts, so its --cleanup owns these rows. */
/**
 * 🔴 `sim-tour-day.ts` 와 **같은 태그**여야 한 드레인이 둘 다 지운다(위 §의 전제).
 * 이제 그 값이 세션(=워크트리)별로 갈린다 — 이유는 `simSessionTag.ts`.
 * 두 시더가 같은 워크트리에서 도는 한 값은 동일하다.
 */
const SIM_TAG = SESSION_SIM_TAG;
const SIM_EMAIL = 'sim-tour-mode@atockorea.test';
const OUT = path.join('scripts', '.k4-fixtures.json');

/** Measured live ratio (private 7 : join 6) scaled to K4_ROOMS. */
const PRIVATE_ROOMS = Math.round((7 / 13) * K4_ROOMS); // 11

/** Locales the rooms join in — spread so translation targets are not all one. */
const LOCALES = ['en', 'ko', 'ja', 'zh', 'fr', 'de', 'es', 'it', 'ru', 'zh-TW'] as const;

export interface K4Room {
  room: number;
  bookingId: string;
  tourId: string;
  kind: 'private' | 'join';
  locale: string;
  guests: number;
  guestToken: string;
}

async function main(): Promise<void> {
  if (process.env.ALLOW_SIM_SEED !== '1') {
    console.error(
      [
        'refusing to seed: set ALLOW_SIM_SEED=1.',
        `This writes ${K4_ROOMS} bookings into the live database. They carry sim_tag and stay`,
        'out of aggregates and money, but they are still real rows.',
        'Remove them with: npx tsx scripts/sim-tour-day.ts --cleanup',
      ].join('\n'),
    );
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: tours, error: tourError } = await db
    .from('tours')
    .select('id, title, price_type')
    .not('price_type', 'is', null);
  if (tourError) throw tourError;

  const privateTours = (tours ?? []).filter((t) => t.price_type === 'vehicle');
  const joinTours = (tours ?? []).filter((t) => t.price_type !== 'vehicle');
  if (privateTours.length === 0 || joinTours.length === 0) {
    // Refusing beats seeding 20 rooms of one kind and reporting `extend` broken.
    console.error(
      `need both kinds of tour to seed a representative run — ` +
        `private=${privateTours.length} join=${joinTours.length}`,
    );
    process.exit(2);
  }

  const tourDate = kstToday();
  const rooms: K4Room[] = [];

  for (let i = 0; i < K4_ROOMS; i++) {
    const kind: 'private' | 'join' = i < PRIVATE_ROOMS ? 'private' : 'join';
    const pool = kind === 'private' ? privateTours : joinTours;
    const tour = pool[i % pool.length];
    const locale = LOCALES[i % LOCALES.length];
    const guests = kind === 'private' ? 2 + (i % 3) : 1 + (i % 4);
    const name = `K4 Room ${String(i + 1).padStart(2, '0')}`;

    const { data, error } = await db
      .from('bookings')
      .insert({
        tour_id: tour.id,
        tour_date: tourDate,
        number_of_guests: guests,
        unit_price: 0,
        total_price: 0,
        final_price: 0,
        status: 'confirmed',
        contact_name: name,
        contact_email: SIM_EMAIL,
        contact_phone: '+82-10-0000-0000',
        preferred_language: locale,
        sim_tag: SIM_TAG,
      })
      .select('id')
      .single();
    if (error) throw error;

    rooms.push({
      room: i + 1,
      bookingId: data.id as string,
      tourId: tour.id as string,
      kind,
      locale,
      guests,
      guestToken: signCustomerRoomToken({
        bookingId: data.id as string,
        displayName: name,
        tourDate,
      }).token,
    });
  }

  /**
   * Staff tokens are scoped to (tourId, tourDate), not to a booking — one per
   * distinct tour the rooms landed on, so the guide and driver routes can be
   * driven against whichever room the ledger assigned them to.
   */
  const staffTokens: Record<string, { guide: string; driver: string }> = {};
  for (const tourId of [...new Set(rooms.map((r) => r.tourId))]) {
    staffTokens[tourId] = {
      guide: signGuideRoomToken({ tourId, tourDate, displayName: 'K4 Guide' }).token,
      driver: signDriverRoomToken({ tourId, tourDate, displayName: 'K4 Driver' }).token,
    };
  }

  const fixtures = { tourDate, rooms, staffTokens, seededAt: new Date().toISOString() };
  writeFileSync(OUT, `${JSON.stringify(fixtures, null, 2)}\n`, 'utf8');

  const privateCount = rooms.filter((r) => r.kind === 'private').length;
  console.log(
    `seeded ${rooms.length} rooms on ${tourDate} — ` +
      `${privateCount} private / ${rooms.length - privateCount} join, ` +
      `${Object.keys(staffTokens).length} tour(s)`,
  );
  console.log(`fixtures → ${OUT}`);
  console.log('cleanup  → npx tsx scripts/sim-tour-day.ts --cleanup');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
