/**
 * T1.9 global teardown — remove everything global-setup created.
 *
 * Deleting the tour_rooms row cascades participants / messages / locations /
 * tts-cache (all FK ON DELETE CASCADE); the booking row goes last. Scoped
 * strictly to the seeded booking id + the E2E contact email so a mistyped
 * fixture can never touch real data.
 */
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { E2E_CONTACT_EMAIL, FIXTURES_PATH, type TourRoomE2EFixtures } from './global-setup';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(FIXTURES_PATH)) return;
  const fixtures = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8')) as TourRoomE2EFixtures;

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !fixtures.bookingId) return;

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  await supabase.from('tour_rooms').delete().eq('booking_id', fixtures.bookingId);
  await supabase
    .from('bookings')
    .delete()
    .eq('id', fixtures.bookingId)
    .eq('contact_email', E2E_CONTACT_EMAIL);
  unlinkSync(FIXTURES_PATH);
}
