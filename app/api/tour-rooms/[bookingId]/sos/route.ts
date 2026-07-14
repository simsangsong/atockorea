import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { sendEmail } from '@/lib/email';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { renderSpotEventTranslations } from '@/lib/tour-room/spotContent';

export const dynamic = 'force-dynamic';

/**
 * T7.3 — SOS: a traveller's one-tap emergency signal.
 *
 * Inserts a pinned-priority room message (zero-LLM 5-locale template) with a
 * one-shot location attach when the client got consent for it (§O — even a
 * location-sharing-OFF traveller sends THIS one fix so the guide/ops can
 * navigate to them), broadcasts to the room (guide sees it instantly), and
 * emails the ops notification list. The ops console pins any room whose feed
 * carries an unresolved metadata.kind='sos' (T7.1 aggregation).
 */

function adminRecipients(): string[] {
  const raw = process.env.ADMIN_BOOKING_NOTIFICATION_EMAILS || 'simsangsong@gmail.com,support@atockorea.com';
  return raw.split(',').map((email) => email.trim()).filter(Boolean);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.kind !== 'session') {
      return NextResponse.json({ error: 'A joined room session is required' }, { status: 403 });
    }

    // Anti-spam only — generous enough for real repeat presses.
    const gate = await requestGate({
      namespace: 'tour_room_sos',
      key: `participant:${actor.sessionPayload.participantId}`,
      perMinute: 2,
      perHour: 10,
    });
    if (!gate.allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const hasLocation =
      Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';

    const room = await ensureRoom(supabase, booking);
    const bundle = renderSpotEventTranslations('sos', {});
    const sourceText = note ? `${bundle.source_text}\n"${note}"` : bundle.source_text;

    const { data: message, error } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: actor.role,
        input_kind: 'text',
        source_text: sourceText,
        source_locale: bundle.source_locale,
        translations: bundle.translations,
        target_locales: Object.keys(bundle.translations),
        metadata: {
          kind: 'sos',
          sender_name: actor.displayName,
          note: note || null,
          ...(hasLocation ? { latitude, longitude, location_one_shot: true } : {}),
        },
      })
      .select()
      .single();
    if (error) throw error;

    await broadcastToRoom(room, 'message', { message });

    // Ops notification mail — best-effort, never blocks the SOS itself.
    const mapsLink = hasLocation ? `https://maps.google.com/?q=${latitude},${longitude}` : null;
    void sendEmail({
      to: adminRecipients(),
      subject: `🆘 SOS — ${actor.displayName} (booking ${booking.id.slice(0, 8)})`,
      html: `<p><b>${actor.displayName}</b> triggered SOS in tour room <code>${booking.id}</code> (${booking.tour_date ?? ''}).</p>
${note ? `<p>Note: ${note}</p>` : ''}
${mapsLink ? `<p>One-shot location: <a href="${mapsLink}">${mapsLink}</a></p>` : '<p>No location attached.</p>'}
<p>Ops console: ${(process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '')}/admin/tour-ops</p>`,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/sos error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
