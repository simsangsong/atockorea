/**
 * W2.4 / D5 — the shared LEDGER capsule writer.
 *
 * Extracted from the extras route so BOTH the operator extras route and the
 * guest add-time (extend) route drop the identical 5-locale `extra_ledger`
 * capsule + broadcast (no divergent duplication). The card renders from the
 * newest capsule per extra; the text is the feed fallback + notification body.
 */

import type { RoomDbClient, TourRoom } from '@/lib/tour-room/access';
import { renderExtraCapsule, type ExtraStatus } from '@/lib/tour-room/ledger';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { translateTextForLocales } from '@/lib/openai-server';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

export interface ExtraRow {
  id: string;
  room_id: string;
  booking_id: string;
  item: string;
  amount_krw: number;
  payer: string;
  kind: string;
  status: string;
  settled_via: string | null;
  receipt_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function insertExtraCapsule(
  supabase: RoomDbClient,
  room: TourRoom,
  bookingId: string,
  extra: ExtraRow,
  status: ExtraStatus,
) {
  // T2-2 — translate the operator's typed item so a Korean expense label reads
  // in each guest's language (banner + card). R-6: on failure, verbatim.
  let itemByLocale: Record<string, string> | null = null;
  try {
    itemByLocale = (await translateTextForLocales(extra.item, [...ROOM_LOCALES])).translations;
  } catch (translationError) {
    console.warn('ledger item translation failed, using verbatim:', translationError);
    itemByLocale = null;
  }
  const bundle = renderExtraCapsule(
    status,
    extra.item,
    extra.amount_krw,
    extra.payer === 'driver' ? 'driver' : 'guide',
    itemByLocale,
  );
  const { data: message } = await supabase
    .from('tour_room_messages')
    .insert({
      room_id: room.id,
      booking_id: bookingId,
      sender_role: 'system',
      input_kind: 'text',
      source_text: bundle.source_text,
      source_locale: bundle.source_locale,
      translations: bundle.translations,
      target_locales: Object.keys(bundle.translations),
      metadata: {
        kind: 'extra_ledger',
        extra_id: extra.id,
        item: extra.item,
        ...(itemByLocale ? { item_i18n: itemByLocale } : {}),
        amount_krw: extra.amount_krw,
        extra_kind: extra.kind,
        payer: extra.payer,
        status,
        // T1-3 — the receipt travels on the capsule so the guest card can show
        // it (discount-buy transparency for driver-advanced tickets).
        ...(extra.receipt_photo_url ? { receipt_photo_url: extra.receipt_photo_url } : {}),
      },
    })
    .select()
    .single();
  if (message) await broadcastToRoom(room, 'message', { message });
  return message ?? null;
}
