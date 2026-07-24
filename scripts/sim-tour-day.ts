/**
 * Simulation seeder for the full-feature manual QA pass (ops-center audit).
 *
 * Audit plan A0.1 — every booking this writes carries `sim_tag`, so the rows
 * stay visible to rooms, seating, check-in and the manifest (that is the point
 * of a simulation) while staying out of the two places where they do damage:
 * aggregates (§11.E daily report, §K B1 stats, §K B2 capacity) and money
 * (Stripe capture cron, ops_entity_ledger). `lib/ops/sim/simScope.ts` is the
 * single place that decides what counts as simulated.
 *
 * The seeder refuses to run without ALLOW_SIM_SEED=1. It writes to the live
 * database, and "I did not mean to run that" should cost a typo, not a
 * cleanup.
 *
 * Seeds ONE clearly-labelled tour-day scenario in the live DB (same approach
 * as e2e/global-setup — everything labelled sim-tour-mode@atockorea.test and
 * removable with --cleanup):
 *   - 2 bookings on today's date (two rooms for the multi-room ops view)
 *   - customer + guide invite tokens (same secret ladder as the server)
 *   - a throwaway admin user (sim-tour-ops-admin@) + a signed-in session
 *     printed so the browser can adopt it via localStorage injection
 *
 * Run:   npx tsx scripts/sim-tour-day.ts            → writes scripts/.sim-fixtures.json
 *        npx tsx scripts/sim-tour-day.ts --cleanup  → removes everything it created
 */
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { signCustomerRoomToken, signGuideRoomToken } from '../lib/tour-room/token';
import { kstToday } from '../lib/tour-room/time';

const SIM_EMAIL = 'sim-tour-mode@atockorea.test';
const SIM_ADMIN_EMAIL = 'sim-tour-ops-admin@atockorea.test';
const SIM_TAG = 'sim';
const OUT = path.join(__dirname, '.sim-fixtures.json');

/**
 * Children of `bookings` whose FK is ON DELETE SET NULL — deleting the booking
 * does NOT remove them, it orphans them. They have to go first, while
 * booking_id still says which rows were simulated.
 *
 * ops_entity_ledger is the one that matters: it is the corporate ledger behind
 * the three-way reconciliation in §6, and an orphaned simulated revenue row
 * there cannot be identified afterwards, let alone removed safely.
 */
const SET_NULL_CHILDREN: Array<{ table: string; column: string }> = [
  { table: 'ops_entity_ledger', column: 'booking_id' },
  { table: 'ops_email_parse_logs', column: 'booking_id' },
  { table: 'ops_guide_assignments', column: 'booking_id' },
  { table: 'emails', column: 'booking_id' },
  { table: 'reviews', column: 'booking_id' },
  { table: 'promo_code_usage', column: 'booking_id' },
  { table: 'received_emails', column: 'related_booking_id' },
  { table: 'coupon_grants', column: 'locked_booking_id' },
  // NO ACTION — this one blocks the delete outright rather than orphaning.
  { table: 'coupon_redemptions', column: 'booking_id' },
];

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !serviceKey || !anonKey) throw new Error('missing supabase env');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (process.argv.includes('--cleanup')) {
    const fixtures = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    // Tag first, legacy address second: rows seeded before sim_tag existed are
    // still identifiable by the address the seeder has always used.
    const { data: tagged } = await service.from('bookings').select('id').eq('sim_tag', SIM_TAG);
    const { data: byEmail } = await service
      .from('bookings')
      .select('id')
      .in('contact_email', [SIM_EMAIL, SIM_ADMIN_EMAIL]);
    const ids = [...new Set([...(tagged ?? []), ...(byEmail ?? [])].map((b) => b.id as string))];

    // 1. SET NULL / NO ACTION children, while booking_id still identifies them.
    if (ids.length > 0) {
      for (const { table, column } of SET_NULL_CHILDREN) {
        const { error } = await service.from(table).delete().in(column, ids);
        // A table missing from this environment is not a failure — the parse
        // stack and the finance tables ship in separate deployments.
        if (error && !/does not exist|schema cache/i.test(error.message)) {
          console.warn('cleanup: ' + table + '.' + column + ' -> ' + error.message);
        }
      }
    }

    // 2. The booking itself. Everything else hangs off ON DELETE CASCADE
    //    (tour_rooms -> messages/participants/locations/events/extras/pins,
    //    ops_seat_assignments, ops_room_vehicles, ops_no_show_evidence,
    //    tour_room_invites, push_subscriptions, tour_day_plans).
    if (ids.length > 0) {
      const { error } = await service.from('bookings').delete().in('id', ids);
      if (error) throw error;
    }

    if (fixtures?.adminUserId) {
      await service.from('push_subscriptions').delete().eq('user_id', fixtures.adminUserId);
      await service.from('user_profiles').delete().eq('id', fixtures.adminUserId);
      await service.auth.admin.deleteUser(fixtures.adminUserId).catch(() => undefined);
    }

    // 3. Prove it. A cleanup that reports success while leaving orphans behind
    //    is exactly the failure this rewrite exists to end.
    const { count: leftover } = await service
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('sim_tag', SIM_TAG);
    console.log('sim cleanup done:', ids.length, 'bookings removed, leftover:', leftover ?? 0);
    if (existsSync(OUT)) {
      try {
        unlinkSync(OUT);
        console.log('fixtures file removed (it holds signed tokens)');
      } catch {
        /* best effort */
      }
    }
    return;
  }

  // Seeding (unlike cleanup) writes to the live database. Make that a decision.
  if (process.env.ALLOW_SIM_SEED !== '1') {
    throw new Error(
      [
        'refusing to seed: set ALLOW_SIM_SEED=1.',
        'This writes bookings into the live database. They carry sim_tag and stay out of',
        'aggregates and money, but they are still real rows — remove them with --cleanup.',
      ].join('\n'),
    );
  }

  const { data: tours } = await service.from('tours').select('id, title').limit(2);
  if (!tours || tours.length === 0) throw new Error('no tours');
  const tourDate = kstToday();

  const mk = async (name: string, lang: string, guests: number, tourId: string) => {
    const { data, error } = await service
      .from('bookings')
      .insert({
        tour_id: tourId,
        tour_date: tourDate,
        number_of_guests: guests,
        unit_price: 0,
        total_price: 0,
        final_price: 0,
        status: 'confirmed',
        contact_name: name,
        contact_email: SIM_EMAIL,
        contact_phone: '+82-10-0000-0000',
        preferred_language: lang,
        // A0.1 — the whole isolation contract rides on this one field.
        sim_tag: SIM_TAG,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const tourA = tours[0].id;
  const tourB = (tours[1] ?? tours[0]).id;
  const booking1 = await mk('Sim Alex', 'en', 2, tourA);
  const booking2 = await mk('Sim Yuki', 'ja', 4, tourB);

  const token1 = signCustomerRoomToken({ bookingId: booking1, displayName: 'Sim Alex', tourDate }).token;
  const token2 = signCustomerRoomToken({ bookingId: booking2, displayName: 'Sim Yuki', tourDate }).token;
  const guideToken = signGuideRoomToken({ tourId: tourA, tourDate, displayName: 'Sim Guide' }).token;

  // throwaway admin + session
  const password = `Sim!${Math.random().toString(36).slice(2, 12)}Aa1`;
  let adminUserId: string;
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: SIM_ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError) {
    // already exists from a previous run — reset password
    const { data: list } = await service.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === SIM_ADMIN_EMAIL);
    if (!existing) throw createError;
    adminUserId = existing.id;
    await service.auth.admin.updateUserById(adminUserId, { password });
  } else {
    adminUserId = created.user!.id;
  }
  await service.from('user_profiles').upsert({ id: adminUserId, full_name: 'Sim Ops Admin', role: 'admin' });

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: SIM_ADMIN_EMAIL,
    password,
  });
  if (signInError || !signIn.session) throw signInError ?? new Error('sign-in failed');

  const projectRef = new URL(url).hostname.split('.')[0];
  const fixtures = {
    tourDate,
    booking1,
    booking2,
    room1Url: `/tour-mode/room/${booking1}?rt=${encodeURIComponent(token1)}`,
    room2Url: `/tour-mode/room/${booking2}?rt=${encodeURIComponent(token2)}`,
    guideUrl: `/tour-mode/guide?rt=${encodeURIComponent(guideToken)}`,
    adminUserId,
    supabaseStorageKey: `sb-${projectRef}-auth-token`,
    adminSession: signIn.session,
  };
  writeFileSync(OUT, JSON.stringify(fixtures, null, 2));
  console.log(JSON.stringify({ tourDate, booking1, booking2, adminUserId, storageKey: fixtures.supabaseStorageKey }, null, 2));
  console.log('fixtures →', OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
