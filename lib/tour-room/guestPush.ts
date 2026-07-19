/**
 * W4.1 / P-D7 — Web Push to a booking's devices.
 *
 * Guests (role 'customer') opt in for exactly two critical kinds: rally
 * (meeting/free-time target) and delay. Drivers (role 'driver') opt in for
 * one: a guest sent a message while the driver is out in a nav app — push
 * restraint is the feature.
 *
 * Same contract as sendOpsPush: fire-and-forget, VAPID env missing → silent
 * no-op, dead subscriptions (404/410) pruned inline.
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

const DRIVER_TITLE = '🚐 손님 메시지';

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

function setVapid(): void {
  webpush.setVapidDetails(
    process.env.WEB_PUSH_CONTACT || 'mailto:support@atockorea.com',
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!,
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
  );
}

/** Deliver one JSON payload to a set of subscription rows; prune dead ones. */
async function deliver(
  supabase: RoomDbClient,
  rows: SubscriptionRow[],
  payload: string,
): Promise<{ sent: number; pruned: number }> {
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          { TTL: 600, urgency: 'high' },
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (isGonePushStatus(statusCode)) dead.push(row.id);
        else console.warn('[tour-room] push failed:', statusCode ?? err);
      }
    }),
  );
  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead);
  }
  return { sent, pruned: dead.length };
}

async function fetchSubscriptions(
  supabase: RoomDbClient,
  role: 'customer' | 'driver' | 'guide',
  bookingId: string,
): Promise<SubscriptionRow[]> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('role', role)
    .eq('booking_id', bookingId);
  return (data as SubscriptionRow[]) ?? [];
}

export async function sendGuestRoomPush(
  supabase: RoomDbClient,
  booking: { id: string; preferred_language?: string | null },
  input: { translations: Record<string, string>; tag?: string },
): Promise<{ sent: number; pruned: number }> {
  if (!vapidConfigured()) return { sent: 0, pruned: 0 };
  try {
    const rows = await fetchSubscriptions(supabase, 'customer', booking.id);
    if (!rows.length) return { sent: 0, pruned: 0 };
    setVapid();
    const locale = normalizeRoomLocale(booking.preferred_language);
    const payload = JSON.stringify({
      title: TITLE[locale] ?? TITLE.en,
      body: input.translations[locale] ?? input.translations.en ?? '',
      url: `/tour-mode/room/${booking.id}`,
      tag: input.tag,
    });
    return await deliver(supabase, rows, payload);
  } catch (error) {
    console.warn('[tour-room] guest push error:', error);
    return { sent: 0, pruned: 0 };
  }
}

/**
 * Ring the operator's device when a guest message lands (they may be out in a
 * nav app). Body stays generic — the message content is not put on the lock
 * screen; tapping opens the console where the Korean TTS plays.
 *
 * Phase 2 (unified cockpit): a booking's cockpit is run by EITHER a pure driver
 * OR a guide who is driving today, so both roles' subscriptions are notified,
 * each landing on its own console. In private mode only one is subscribed per
 * booking, so this is at most one extra empty lookup.
 */
export async function sendDriverRoomPush(
  supabase: RoomDbClient,
  bookingId: string,
  input: { body: string; tag?: string },
): Promise<{ sent: number; pruned: number }> {
  if (!vapidConfigured()) return { sent: 0, pruned: 0 };
  try {
    const targets: Array<{ role: 'driver' | 'guide'; url: string }> = [
      { role: 'driver', url: '/tour-mode/driver' },
      { role: 'guide', url: '/tour-mode/guide' },
    ];
    let sent = 0;
    let pruned = 0;
    for (const target of targets) {
      const rows = await fetchSubscriptions(supabase, target.role, bookingId);
      if (!rows.length) continue;
      setVapid();
      const payload = JSON.stringify({
        title: DRIVER_TITLE,
        body: input.body,
        url: target.url,
        tag: input.tag,
      });
      const result = await deliver(supabase, rows, payload);
      sent += result.sent;
      pruned += result.pruned;
    }
    return { sent, pruned };
  } catch (error) {
    console.warn('[tour-room] driver push error:', error);
    return { sent: 0, pruned: 0 };
  }
}
