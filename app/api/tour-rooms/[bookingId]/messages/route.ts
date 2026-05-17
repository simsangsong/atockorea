import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { transcribeAudioFile, translateTextForLocales } from '@/lib/openai-server';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGET_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'];

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function parseLocales(value: unknown, fallback = DEFAULT_TARGET_LOCALES): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

async function getBookingForRoom(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, tour_id, merchant_id, tour_date, contact_name, contact_email, contact_phone, preferred_language')
    .eq('id', bookingId)
    .single();
  if (error || !data) return null;
  return data;
}

function isMerchantGuideForBooking(
  user: Awaited<ReturnType<typeof getAuthUser>>,
  booking: { merchant_id?: string | null },
): boolean {
  return Boolean(user?.role === 'merchant' && user.merchantId && booking.merchant_id === user.merchantId);
}

function defaultTargetLocalesFor(
  senderRole: string,
  booking: { preferred_language?: string | null },
): string[] {
  const customerPreferred = booking.preferred_language?.trim();
  if (senderRole === 'guide' && customerPreferred) return [customerPreferred];
  return DEFAULT_TARGET_LOCALES;
}

async function ensureRoom(
  supabase: ReturnType<typeof createServerClient>,
  booking: { id: string; tour_id?: string | null; tour_date?: string | null },
) {
  const { data, error } = await supabase
    .from('tour_rooms')
    .upsert(
      {
        booking_id: booking.id,
        tour_id: booking.tour_id ?? null,
        tour_date: booking.tour_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const user = await getAuthUser(req);
    const booking = await getBookingForRoom(supabase, bookingId);
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    if (
      !user ||
      (user.role !== 'admin' && user.id !== booking.user_id && !isMerchantGuideForBooking(user, booking))
    ) {
      return NextResponse.json({ error: 'Access denied for this tour room' }, { status: 403 });
    }

    const room = await ensureRoom(supabase, booking);
    const { data, error } = await supabase
      .from('tour_room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ room, messages: data ?? [] });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const user = await getAuthUser(req);
    const booking = await getBookingForRoom(supabase, bookingId);
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    let text = '';
    let inputKind: 'text' | 'audio' = 'text';
    let senderRole: 'customer' | 'guide' | 'admin' | 'system' = user?.role === 'admin'
      ? 'admin'
      : isMerchantGuideForBooking(user, booking)
        ? 'guide'
        : 'customer';
    let targetLocales = defaultTargetLocalesFor(senderRole, booking);
    let guestEmail = '';
    let guestName = '';
    let messageMetadata: Record<string, unknown> = {};

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const audio = form.get('audio');
      if (!(audio instanceof File)) {
        return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
      }
      const transcribed = await transcribeAudioFile(audio, {
        prompt: String(form.get('sttPrompt') || ''),
      });
      text = transcribed.text;
      inputKind = 'audio';
      messageMetadata = {
        stt: {
          provider: transcribed.provider,
          model: transcribed.model,
          fallback_used: transcribed.fallback_used,
          fallback_reason_codes: transcribed.fallback_reason_codes,
          quality: transcribed.quality,
        },
      };
      senderRole = String(form.get('senderRole') || senderRole) as typeof senderRole;
      targetLocales = parseLocales(form.get('targetLocales'), defaultTargetLocalesFor(senderRole, booking));
      guestEmail = String(form.get('contactEmail') || '');
      guestName = String(form.get('contactName') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      text = typeof body.text === 'string' ? body.text.trim() : '';
      senderRole = typeof body.senderRole === 'string' ? body.senderRole : senderRole;
      targetLocales = parseLocales(body.targetLocales, defaultTargetLocalesFor(senderRole, booking));
      guestEmail = String(body.contactEmail || '');
      guestName = String(body.contactName || '');
    }

    if (!text) {
      return NextResponse.json({ error: 'text or audio transcription is required' }, { status: 400 });
    }

    const isOwner = Boolean(user?.id && user.id === booking.user_id);
    const isAdmin = user?.role === 'admin';
    const isMerchantGuide = isMerchantGuideForBooking(user, booking);
    const guestMatches =
      normalized(booking.contact_email) === normalized(guestEmail) &&
      (!guestName || normalized(booking.contact_name) === normalized(guestName));

    if (!isOwner && !isAdmin && !isMerchantGuide && !guestMatches) {
      return NextResponse.json({ error: 'Access denied for this tour room' }, { status: 403 });
    }

    if (senderRole === 'guide' && !isMerchantGuide && !isAdmin) {
      return NextResponse.json({ error: 'Only assigned guides can send guide messages' }, { status: 403 });
    }

    if (!['customer', 'guide', 'admin', 'system'].includes(senderRole)) {
      return NextResponse.json({ error: 'Invalid senderRole' }, { status: 400 });
    }

    const room = await ensureRoom(supabase, booking);
    const translation = await translateTextForLocales(text, targetLocales);
    const { data: message, error } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: user?.id ?? null,
        sender_role: senderRole,
        input_kind: inputKind,
        source_text: text,
        source_locale: translation.source_locale,
        translations: translation.translations,
        target_locales: targetLocales,
        metadata: messageMetadata,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ room, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
