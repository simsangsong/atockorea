/**
 * W4.1 / P-D7 — Web Push to a booking's guest devices (role 'customer',
 * booking-scoped rows in push_subscriptions).
 *
 * Guests opt in from the room for exactly two critical kinds: rally
 * (meeting/free-time target) and delay. Everything else stays in-app —
 * push restraint is the feature.
 *
 * Same contract as sendOpsPush: fire-and-forget, VAPID env missing → silent
 * no-op, dead subscriptions (404/410) pruned inline. The body is localized
 * to the booking's preferred room locale from the capsule's translations.
 */

import webpush from 'web-push';
import { isGonePushStatus } from '@/lib/tour-ops/push';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomDbClient } from '@/lib/tour-room/access';

const TITLE: Record<string, string> = {
  en: 'AtoC Korea — your tour',
  ko: 'AtoC Korea — 내 투어',
  ja: 'AtoC Korea — ツアー',
  es: 'AtoC Korea — tu tour',
  zh: 'AtoC Korea — 我的行程',
};

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  );
}

export async function sendGuestRoomPush(
  supabase: RoomDbClient,
  booking: { id: string; preferred_language?: string | null },
  input: { translations: Record<string, string>; tag?: string },
): Promise<{ sent: number; pruned: number }> {
  if (!vapidConfigured()) return { sent: 0, pruned: 0 };
  try {
    const { data: rows } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('role', 'customer')
      .eq('booking_id', booking.id);
    if (!rows?.length) return { sent: 0, pruned: 0 };

    webpush.setVapidDetails(
      process.env.WEB_PUSH_CONTACT || 'mailto:support@atockorea.com',
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!,
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
    );
    const locale = normalizeRoomLocale(booking.preferred_language);
    const body = JSON.stringify({
      title: TITLE[locale] ?? TITLE.en,
      body: input.translations[locale] ?? input.translations.en ?? '',
      url: `/tour-mode/room/${booking.id}`,
      tag: input.tag,
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      (rows as SubscriptionRow[]).map(async (row) => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
            { TTL: 600, urgency: 'high' },
          );
          sent += 1;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (isGonePushStatus(statusCode)) dead.push(row.id);
          else console.warn('[tour-room] guest push failed:', statusCode ?? err);
        }
      }),
    );
    if (dead.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', dead);
    }
    return { sent, pruned: dead.length };
  } catch (error) {
    console.warn('[tour-room] guest push error:', error);
    return { sent: 0, pruned: 0 };
  }
}
