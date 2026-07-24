import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { translateTextForLocales } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor, type RoomBooking } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { requestGate } from '@/lib/durable-rate-limit';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

// §D A4.1 — 로케일 목록은 ROOM_LOCALES 하나뿐이다. 여기 다시 적으면
// 로케일이 하나 늘어나는 날 이 파일만 조용히 5개로 남는다.
const DEFAULT_TARGET_LOCALES: string[] = [...ROOM_LOCALES];

/**
 * R-6 completion — translation repair.
 *
 * A message published during a translation-provider outage ships the original
 * immediately with `metadata.translation_status='pending'` and empty
 * translations (never block the message). This endpoint is the missing consumer
 * of that flag: any authorized viewer whose device reconnects asks the server to
 * re-translate the row once; on success the repaired row rebroadcasts to the
 * whole room, so the Korean-only driver stops seeing raw foreign text (and its
 * garbled TTS) and guests stop seeing raw Korean. Idempotent and rate-gated per
 * message so N concurrent viewers cost at most one real translation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string; messageId: string }> },
) {
  try {
    const { bookingId, messageId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const room = await ensureRoom(supabase, resolved.booking as RoomBooking);

    const { data: message } = await supabase
      .from('tour_room_messages')
      .select('*')
      .eq('id', messageId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (!message) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const meta = (message.metadata ?? {}) as Record<string, unknown>;
    const sourceText = String(message.source_text ?? '').trim();

    // Idempotent: only a pending message with real text is repairable. Anything
    // already translated (or a caption-less attachment) returns unchanged with
    // no LLM call — safe to call from every viewer.
    if (meta.translation_status !== 'pending' || !sourceText) {
      return NextResponse.json({ message, repaired: false });
    }

    // One real repair per message per short window; concurrent viewers all ask,
    // the first through the gate does the work and rebroadcasts to the rest.
    const gate = await requestGate({
      namespace: 'tour_room_retranslate',
      key: `message:${messageId}`,
      perMinute: 4,
      perHour: 40,
    });
    if (!gate.allowed) {
      return NextResponse.json({ message, repaired: false });
    }

    const targets =
      Array.isArray(message.target_locales) && message.target_locales.length > 0
        ? (message.target_locales as string[])
        : DEFAULT_TARGET_LOCALES;

    let translation;
    try {
      translation = await translateTextForLocales(sourceText, targets);
    } catch (translationError) {
      // Still down — leave it pending; the next reconnected viewer retries.
      console.warn('tour-room retranslate failed, still pending:', translationError);
      return NextResponse.json({ message, repaired: false });
    }

    const nextMeta: Record<string, unknown> = { ...meta };
    delete nextMeta.translation_status;

    const { data: updated, error } = await supabase
      .from('tour_room_messages')
      .update({
        source_locale: translation.source_locale,
        translations: translation.translations,
        metadata: nextMeta,
      })
      .eq('id', messageId)
      .eq('room_id', room.id)
      .select()
      .single();
    if (error) throw error;

    // Push the repaired row so every device (driver + guests) swaps the raw
    // original for the translated bubble; TTS then speaks the right language.
    await broadcastToRoom(room, 'message', { message: updated });

    return NextResponse.json({ message: updated, repaired: true });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/messages/[messageId]/retranslate error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
