/**
 * W6.2 — server-side Web Push to ops-console subscribers.
 *
 * Fire-and-forget by design (same contract as broadcastToRoom): the DB row is
 * the source of truth and the in-app surfaces (sound/blink/badge) already
 * cover a foregrounded console — push exists so a pocketed phone still rings.
 * Dead subscriptions (404/410 from the push service) are pruned inline.
 *
 * Env: NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY /
 * WEB_PUSH_CONTACT. Missing env → silent no-op (feature simply off).
 */

import webpush from 'web-push';
import { createServerClient } from '@/lib/supabase';

export interface OpsPushPayload {
  title: string;
  body: string;
  /** Where a notification click lands (default: the ops console). */
  url?: string;
  /** Collapse key — same tag replaces the previous notification. */
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  );
}

/** Statuses that mean "this subscription is dead — delete it". */
export function isGonePushStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export async function sendOpsPush(
  payload: OpsPushPayload,
  options?: { role?: 'admin' | 'guide' },
): Promise<{ sent: number; pruned: number }> {
  if (!vapidConfigured()) return { sent: 0, pruned: 0 };
  webpush.setVapidDetails(
    process.env.WEB_PUSH_CONTACT || 'mailto:support@atockorea.com',
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY!,
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
  );

  const supabase = createServerClient();
  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('role', options?.role ?? 'admin');
  if (error || !rows?.length) return { sent: 0, pruned: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/admin/tour-ops',
    tag: payload.tag,
  });

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    (rows as SubscriptionRow[]).map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body,
          { TTL: 300, urgency: 'high' },
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (isGonePushStatus(statusCode)) dead.push(row.id);
        else console.warn('[tour-ops] push send failed:', statusCode ?? err);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead);
  }
  if (sent > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('role', options?.role ?? 'admin');
  }
  return { sent, pruned: dead.length };
}
