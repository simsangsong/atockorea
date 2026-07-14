/**
 * T1.9 global setup — seed one E2E tour-room booking in the live database.
 *
 * Uses the service-role key from .env.local (same credentials the dev server
 * itself runs with). Everything created here is labelled with the E2E contact
 * email and removed again by global-teardown; the seeded booking references an
 * existing tour row read-only (needed for the guide token's tour-date scope).
 *
 * Tokens are signed with lib/tour-room/token — the same secret ladder the
 * server verifies with (TOUR_ROOM_TOKEN_SECRET or the dev fallback), so no
 * extra env is required.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { signCustomerRoomToken, signGuideRoomToken } from '../lib/tour-room/token';
import { kstToday } from '../lib/tour-room/time';

export const E2E_CONTACT_EMAIL = 'e2e-tour-mode@atockorea.test';
export const FIXTURES_PATH = path.join(__dirname, '.fixtures.json');

export interface TourRoomE2EFixtures {
  bookingId: string;
  tourId: string;
  tourDate: string;
  guideToken: string;
  customerToken: string;
}

export default async function globalSetup(): Promise<void> {
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('E2E setup needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local)');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Any real tour satisfies the FK + the guide token's (tourId, tourDate) scope.
  const { data: tour, error: tourError } = await supabase
    .from('tours')
    .select('id, title')
    .limit(1)
    .single();
  if (tourError || !tour) throw new Error(`E2E setup: no tour available (${tourError?.message})`);

  const tourDate = kstToday(); // today ⇒ roomLifecycle() === 'live' ⇒ composer enabled

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tour_id: tour.id,
      tour_date: tourDate,
      number_of_guests: 2,
      unit_price: 0,
      total_price: 0,
      final_price: 0,
      status: 'confirmed',
      contact_name: 'E2E Tour Mode',
      contact_email: E2E_CONTACT_EMAIL,
      preferred_language: 'en',
    })
    .select('id')
    .single();
  if (bookingError || !booking) throw new Error(`E2E setup: booking insert failed (${bookingError?.message})`);

  const { token: customerToken } = signCustomerRoomToken({
    bookingId: booking.id,
    displayName: 'E2E Traveller',
    tourDate,
  });
  const { token: guideToken } = signGuideRoomToken({
    tourId: tour.id,
    tourDate,
    displayName: 'E2E Guide',
  });

  const fixtures: TourRoomE2EFixtures = {
    bookingId: booking.id,
    tourId: tour.id,
    tourDate,
    guideToken,
    customerToken,
  };
  mkdirSync(path.dirname(FIXTURES_PATH), { recursive: true });
  writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));
}
