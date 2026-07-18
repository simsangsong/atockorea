import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Ops Freedom (사용자 요청 2026-07-18) — manual booking entry for reservations
 * that never touched our checkout: OTA channels (GetYourGuide / Viator /
 * Klook), phone/카톡 direct sales, and test rooms.
 *
 * Creating a real `bookings` row is deliberately the mechanism: every
 * downstream machine (room creation, invite links, D-1 auto-dispatch, driver
 * console, day plans, LEDGER, admin alerts) keys off bookings and works
 * unchanged. Payment crons are structurally safe: capture requires
 * `payment_intent_id NOT NULL` and re-auth requires
 * `card_collection_method='setup_intent_then_hold'` — a manual row matches
 * neither, so Stripe never touches OTA money (settled on their platform).
 *
 * GET  → active tours (id/title/city) for the picker.
 * POST → insert the booking (status 'confirmed' so dispatch/rooms treat it
 *        like any paid tour) + fire the admin 'created' alert with the
 *        channel as the source.
 */

const CHANNELS = ['gyg', 'viator', 'klook', 'direct', 'test', 'other'] as const;
type Channel = (typeof CHANNELS)[number];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const { data: tours, error } = await supabase
      .from('tours')
      .select('id, title, city')
      .eq('is_active', true)
      .order('city', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ tours: tours ?? [] });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('GET /api/admin/tour-ops/manual-booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const supabase = createServerClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const tourId = typeof body.tourId === 'string' && body.tourId.trim() ? body.tourId.trim() : null;
    const tourDate = typeof body.tourDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.tourDate) ? body.tourDate : null;
    const tourTime =
      typeof body.tourTime === 'string' && /^\d{2}:\d{2}$/.test(body.tourTime) ? `${body.tourTime}:00` : null;
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim().slice(0, 120) : '';
    const contactEmail =
      typeof body.contactEmail === 'string' && body.contactEmail.includes('@')
        ? body.contactEmail.trim().slice(0, 254)
        : null;
    const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim().slice(0, 40) || null : null;
    const guestsRaw = typeof body.numberOfGuests === 'string' ? Number(body.numberOfGuests) : body.numberOfGuests;
    const numberOfGuests =
      typeof guestsRaw === 'number' && Number.isFinite(guestsRaw) ? Math.min(40, Math.max(1, Math.round(guestsRaw))) : 1;
    const preferredLanguage =
      typeof body.preferredLanguage === 'string' && body.preferredLanguage.trim()
        ? body.preferredLanguage.trim().slice(0, 10)
        : 'en';
    const channel = (CHANNELS as readonly string[]).includes(body.channel as string)
      ? (body.channel as Channel)
      : 'other';
    const externalRef = typeof body.externalRef === 'string' ? body.externalRef.trim().slice(0, 60) || null : null;
    const priceRaw = typeof body.totalPrice === 'string' ? Number(body.totalPrice) : body.totalPrice;
    const totalPrice =
      typeof priceRaw === 'number' && Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw) : 0;

    if (!tourId || !tourDate || !contactName) {
      return NextResponse.json({ error: 'tourId, tourDate (YYYY-MM-DD), contactName are required' }, { status: 400 });
    }

    const { data: tour } = await supabase
      .from('tours')
      .select('id, title, merchant_id, price_currency')
      .eq('id', tourId)
      .maybeSingle();
    if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        tour_id: tour.id,
        merchant_id: (tour as { merchant_id?: string | null }).merchant_id ?? null,
        tour_date: tourDate,
        booking_date: tourDate,
        tour_time: tourTime,
        number_of_guests: numberOfGuests,
        unit_price: 0,
        total_price: totalPrice,
        final_price: totalPrice,
        status: 'confirmed', // rooms + D-1 dispatch treat it like any paid booking
        source: channel,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        preferred_language: preferredLanguage,
        special_requests: JSON.stringify({
          channel,
          external_ref: externalRef,
          manual_entry: true,
          created_by_admin: admin.id,
        }),
      })
      .select()
      .single();
    if (insertError) throw insertError;

    // Same always-on admin alert as the checkout rails — the channel shows as
    // the 예약 경로 so the team can tell OTA/test entries apart at a glance.
    void (async () => {
      try {
        const { sendAdminBookingAlert } = await import('@/lib/email-templates/admin-booking-alert');
        await sendAdminBookingAlert({
          stage: 'created',
          bookingId: booking.id,
          bookingReference: (booking as { booking_reference?: string | null }).booking_reference ?? externalRef,
          tourTitle: tour.title ?? 'Booking',
          tourDate,
          numberOfGuests,
          totalPrice,
          currency: (tour as { price_currency?: string | null }).price_currency ?? 'KRW',
          customerName: contactName,
          customerEmail: contactEmail,
          customerPhone: contactPhone,
          preferredLanguage,
          source: channel === 'test' ? 'TEST (수동)' : `${channel.toUpperCase()} (수동 등록)`,
        });
      } catch (alertError) {
        console.error('Manual-booking admin alert failed:', alertError);
      }
    })();

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message.includes('Forbidden'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('POST /api/admin/tour-ops/manual-booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
