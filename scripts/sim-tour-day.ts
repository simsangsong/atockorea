/**
 * Simulation seeder for the full-feature manual QA pass (ops-center audit).
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
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { signCustomerRoomToken, signGuideRoomToken } from '../lib/tour-room/token';
import { kstToday } from '../lib/tour-room/time';

const SIM_EMAIL = 'sim-tour-mode@atockorea.test';
const SIM_ADMIN_EMAIL = 'sim-tour-ops-admin@atockorea.test';
const OUT = path.join(__dirname, '.sim-fixtures.json');

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !serviceKey || !anonKey) throw new Error('missing supabase env');
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (process.argv.includes('--cleanup')) {
    const fixtures = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
    const { data: bookings } = await service.from('bookings').select('id').eq('contact_email', SIM_EMAIL);
    for (const b of bookings ?? []) {
      const { data: rooms } = await service.from('tour_rooms').select('id').eq('booking_id', b.id);
      for (const r of rooms ?? []) {
        for (const t of ['tour_room_messages', 'tour_room_participants', 'tour_room_locations']) {
          await service.from(t).delete().eq('room_id', r.id);
        }
        await service.from('tour_rooms').delete().eq('id', r.id);
      }
      await service.from('tour_room_invites').delete().eq('booking_id', b.id);
      await service.from('bookings').delete().eq('id', b.id);
    }
    if (fixtures?.adminUserId) {
      await service.from('push_subscriptions').delete().eq('user_id', fixtures.adminUserId);
      await service.from('user_profiles').delete().eq('id', fixtures.adminUserId);
      await service.auth.admin.deleteUser(fixtures.adminUserId).catch(() => undefined);
    }
    console.log('sim cleanup done:', (bookings ?? []).length, 'bookings removed');
    return;
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
