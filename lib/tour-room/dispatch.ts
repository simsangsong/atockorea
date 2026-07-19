/**
 * T5.1 — invite dispatch: mint tokens, record the invites ledger, email the
 * links (customer per booking, guide per tour-date, §O-3), and the
 * cancellation hook (§O-1 ⑧).
 *
 * Resend rule: dispatching again revokes every previous unrevoked invite in
 * the same scope FIRST (customer → this booking; guide → this tour-date),
 * so a leaked link dies the moment a replacement ships.
 *
 * The guide QR is uploaded as a hosted PNG (Gmail strips data: URIs).
 */

import QRCode from 'qrcode';
import { sendEmail } from '@/lib/email';
import {
  buildCustomerRoomInviteHtml,
  buildGuideRoomInviteHtml,
  type InviteLocale,
} from '@/lib/email-templates/tour-room';
import {
  hashToken,
  signCustomerRoomToken,
  signGuideRoomToken,
} from '@/lib/tour-room/token';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import type { RoomDbClient } from '@/lib/tour-room/access';

const QR_BUCKET = process.env.SUPABASE_TOUR_ROOM_PHOTOS_BUCKET || 'tour-room-photos';

export interface DispatchDbClient extends RoomDbClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

export interface DispatchTarget {
  id: string;
  tour_id: string | null;
  merchant_id: string | null;
  tour_date: string | null;
  tour_time?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  preferred_language: string | null;
}

export interface DispatchSideResult {
  sent: boolean;
  email?: string | null;
  error?: string;
}

export interface DispatchResult {
  customer: DispatchSideResult;
  guide: DispatchSideResult;
  revokedCount: number;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

async function revokeScope(
  supabase: RoomDbClient,
  scope: { bookingId?: string; tourId?: string; tourDate?: string },
): Promise<number> {
  try {
    let query = supabase
      .from('tour_room_invites')
      .update({ revoked_at: new Date().toISOString() })
      .is('revoked_at', null);
    if (scope.bookingId) query = query.eq('booking_id', scope.bookingId).eq('role', 'customer');
    else query = query.eq('tour_id', scope.tourId).eq('tour_date', scope.tourDate).eq('role', 'guide');
    const { data } = await query.select('id');
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

async function recordInvite(
  supabase: RoomDbClient,
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('tour_room_invites').insert(row);
  if (error) throw error;
}

async function uploadGuideQr(
  supabase: DispatchDbClient,
  tourId: string,
  tourDate: string,
  url: string,
): Promise<string | null> {
  try {
    const png = await QRCode.toBuffer(url, { width: 420, margin: 1 });
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((bucket) => bucket.name === QR_BUCKET)) {
      await supabase.storage.createBucket(QR_BUCKET, { public: true });
    }
    // Path derives from the mint time so a re-dispatch gets a fresh QR.
    const path = `qr/${tourId}-${tourDate}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from(QR_BUCKET)
      .upload(path, png, { contentType: 'image/png', upsert: true });
    if (error) return null;
    return supabase.storage.from(QR_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null; // QR is a nice-to-have; the mail still carries the link
  }
}

/**
 * Dispatch (or re-dispatch) the room invites for one booking.
 * Customer mail always; guide mail when the booking has a merchant with a
 * contact email and `includeGuide` isn't disabled.
 */
export async function dispatchRoomInvites(
  supabase: DispatchDbClient,
  booking: DispatchTarget,
  options?: { createdBy?: string | null; includeGuide?: boolean },
): Promise<DispatchResult> {
  if (!booking.tour_date) {
    return {
      customer: { sent: false, error: 'booking has no tour_date' },
      guide: { sent: false, error: 'booking has no tour_date' },
      revokedCount: 0,
    };
  }

  const base = appUrl();
  let revokedCount = 0;

  // Tour title for the mails.
  let tourTitle = 'Your Korea tour';
  try {
    const { data: tour } = await supabase.from('tours').select('title').eq('id', booking.tour_id).single();
    if (tour?.title) tourTitle = tour.title as string;
  } catch {
    /* title is cosmetic */
  }

  // Pickup line (cosmetic).
  let pickupName: string | null = null;
  let pickupTime: string | null = null;
  try {
    const { data: withPickup } = await supabase
      .from('bookings')
      .select('pickup_points ( name, pickup_time )')
      .eq('id', booking.id)
      .maybeSingle();
    const point = Array.isArray(withPickup?.pickup_points)
      ? withPickup?.pickup_points[0]
      : withPickup?.pickup_points;
    pickupName = (point as { name?: string } | null)?.name ?? null;
    pickupTime = (point as { pickup_time?: string } | null)?.pickup_time ?? null;
  } catch {
    /* optional */
  }

  // ---- customer ----
  const customer: DispatchSideResult = { sent: false, email: booking.contact_email };
  if (!booking.contact_email) {
    customer.error = 'booking has no contact email';
  } else {
    revokedCount += await revokeScope(supabase, { bookingId: booking.id });
    const { token, payload } = signCustomerRoomToken({
      bookingId: booking.id,
      displayName: booking.contact_name || 'Guest',
      tourDate: booking.tour_date,
    });
    await recordInvite(supabase, {
      booking_id: booking.id,
      role: 'customer',
      token_hash: hashToken(token),
      display_name: booking.contact_name || 'Guest',
      sent_to: booking.contact_email,
      sent_via: 'email',
      expires_at: new Date(payload.exp * 1000).toISOString(),
      created_by: options?.createdBy ?? null,
    });
    const locale = normalizeRoomLocale(booking.preferred_language) as InviteLocale;
    const roomUrl = `${base}/tour-mode/room/${booking.id}?rt=${encodeURIComponent(token)}`;
    const planUrl = `${base}/tour-mode/plan/${booking.id}?rt=${encodeURIComponent(token)}`;
    const mail = buildCustomerRoomInviteHtml({
      locale,
      customerName: booking.contact_name || 'Traveller',
      tourTitle,
      tourDate: booking.tour_date,
      tourTime: booking.tour_time ?? null,
      pickupName,
      pickupTime,
      roomUrl,
      planUrl,
    });
    const sent = await sendEmail({ to: booking.contact_email, subject: mail.subject, html: mail.html });
    customer.sent = sent.success;
    if (!sent.success) customer.error = sent.error;
  }

  // ---- guide (tour-date scope, §O-3) ----
  const guide: DispatchSideResult = { sent: false };
  if (options?.includeGuide === false) {
    guide.error = 'skipped';
  } else if (!booking.tour_id || !booking.merchant_id) {
    guide.error = 'booking has no tour/merchant';
  } else {
    let guideEmail: string | null = null;
    try {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('contact_email')
        .eq('id', booking.merchant_id)
        .single();
      guideEmail = (merchant?.contact_email as string | null) ?? null;
    } catch {
      /* handled below */
    }
    guide.email = guideEmail;
    if (!guideEmail) {
      guide.error = 'merchant has no contact email';
    } else {
      revokedCount += await revokeScope(supabase, { tourId: booking.tour_id, tourDate: booking.tour_date });
      const { token, payload } = signGuideRoomToken({
        tourId: booking.tour_id,
        tourDate: booking.tour_date,
        displayName: 'Guide',
      });
      await recordInvite(supabase, {
        tour_id: booking.tour_id,
        tour_date: booking.tour_date,
        role: 'guide',
        token_hash: hashToken(token),
        display_name: 'Guide',
        sent_to: guideEmail,
        sent_via: 'email',
        expires_at: new Date(payload.exp * 1000).toISOString(),
        created_by: options?.createdBy ?? null,
      });
      // The unified operator console (dispatch across the day's rooms + per-room
      // drive mode) lives at /tour-mode/guide; the tour-date token opens the
      // whole day there. This is the ONE operator link — a separate hired driver
      // gets a distinct PIN link only when needed (ops dashboard).
      const guideUrl = `${base}/tour-mode/guide?rt=${encodeURIComponent(token)}`;
      let roomCount = 1;
      try {
        const { data: siblings } = await supabase
          .from('bookings')
          .select('id')
          .eq('tour_id', booking.tour_id)
          .eq('tour_date', booking.tour_date);
        roomCount = Array.isArray(siblings) ? siblings.length : 1;
      } catch {
        /* cosmetic */
      }
      const qrImageUrl = await uploadGuideQr(supabase, booking.tour_id, booking.tour_date, guideUrl);
      const mail = buildGuideRoomInviteHtml({
        tourTitle,
        tourDate: booking.tour_date,
        roomCount,
        guideUrl,
        qrImageUrl,
      });
      const sent = await sendEmail({ to: guideEmail, subject: mail.subject, html: mail.html });
      guide.sent = sent.success;
      if (!sent.success) guide.error = sent.error;
    }
  }

  return { customer, guide, revokedCount };
}

/** True when the booking already holds a live (unrevoked) customer invite. */
export async function hasActiveCustomerInvite(
  supabase: RoomDbClient,
  bookingId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('tour_room_invites')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('role', 'customer')
      .is('revoked_at', null)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * §O-1 ⑧ — cancellation hook: kill the booking's customer links and close
 * its room (the closed status also rotates the Broadcast channel topic,
 * R-23). Guide invites are tour-date-scoped and shared — left alive.
 * Best-effort by contract: never throws into the cancellation flow.
 */
export async function revokeRoomForCancelledBooking(
  supabase: RoomDbClient,
  bookingId: string,
): Promise<void> {
  try {
    await revokeScope(supabase, { bookingId });
    await supabase
      .from('tour_rooms')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('booking_id', bookingId);
  } catch (error) {
    console.warn(`[tour-room] cancellation revoke failed for booking ${bookingId}:`, error);
  }
}
