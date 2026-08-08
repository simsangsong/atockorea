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
import {
  ensureBookingReference,
  generateInviteShortCode,
  shortLinkUrl,
} from '@/lib/tour-room/entryCode';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { isPrivateTour } from '@/lib/tour-room/tourKind';
import type { RoomDbClient } from '@/lib/tour-room/access';
import {
  ROOM_PHOTOS_BUCKET,
  ROOM_QR_SIGNED_TTL_SEC,
  dispatchQrPath,
  ensureRoomPhotosBucket,
  signRoomMedia,
  type RoomMediaStorageClient,
} from '@/lib/tour-room/roomMedia';

const QR_BUCKET = ROOM_PHOTOS_BUCKET;

export interface DispatchDbClient extends RoomDbClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
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

/**
 * Render the guide's room link as a QR and return a URL a mail client can load.
 *
 * 🔴 This is the `qr/` path split the storage work is built around. The bucket
 * is private, so `getPublicUrl` no longer resolves — but a QR lives in an
 * INVITE EMAIL, fetched with no session, potentially months later. So `qr/`
 * gets a long-lived signed URL (120 days) while `att/` gets six hours. Same
 * bucket, two policies, split by path. Doing this at bucket granularity would
 * have forced either a broken image in every archived invite or a public bucket
 * holding an object that encodes a guide capability link.
 *
 * The path also gained a UUID: it used to be `{tourId}-{tourDate}-{Date.now()}`,
 * every component of which is a known value or a millisecond inside a known
 * day.
 */
async function uploadGuideQr(
  supabase: DispatchDbClient,
  tourId: string,
  tourDate: string,
  url: string,
): Promise<string | null> {
  try {
    const png = await QRCode.toBuffer(url, { width: 420, margin: 1 });
    await ensureRoomPhotosBucket(supabase as unknown as RoomMediaStorageClient);
    const path = dispatchQrPath(tourId, tourDate);
    const { error } = await supabase.storage
      .from(QR_BUCKET)
      .upload(path, png, { contentType: 'image/png', upsert: true });
    if (error) return null;
    return signRoomMedia(
      supabase as unknown as RoomMediaStorageClient,
      QR_BUCKET,
      path,
      ROOM_QR_SIGNED_TTL_SEC,
    );
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

  // Tour title for the mails, plus the price_type kind discriminator (D2: the
  // /plan pre-selection CTA is a PRIVATE-tour capability only).
  let tourTitle = 'Your Korea tour';
  let tourPriceType: string | null = null;
  try {
    const { data: tour } = await supabase
      .from('tours')
      .select('title, price_type')
      .eq('id', booking.tour_id)
      .single();
    if (tour?.title) tourTitle = tour.title as string;
    tourPriceType = (tour as { price_type?: string | null } | null)?.price_type ?? null;
  } catch {
    /* title is cosmetic */
  }
  const tourIsPrivate = isPrivateTour(tourPriceType);

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
    // entry-code plan §C-2: 메일에 실리는 것은 345자 토큰 URL 이 아니라 짧은
    // 별칭(/r/{code})이다. 별칭은 이 원장 행에 붙어 살므로, 재발송의
    // 폐기-후-재발급(위 revokeScope)이 그대로 "옛 짧은 링크의 죽음"이 된다.
    // 클릭 시 토큰 발급은 /api/tour-mode/entry 가 한다.
    const shortCode = generateInviteShortCode();
    await recordInvite(supabase, {
      booking_id: booking.id,
      role: 'customer',
      token_hash: hashToken(token),
      short_code: shortCode,
      display_name: booking.contact_name || 'Guest',
      sent_to: booking.contact_email,
      sent_via: 'email',
      expires_at: new Date(payload.exp * 1000).toISOString(),
      created_by: options?.createdBy ?? null,
    });
    // 상설 코드(A2C-…)는 메일 본문에 병기 — 링크를 잃어도 /room 에서 입장한다.
    const entryCode = await ensureBookingReference(supabase, booking.id);
    const locale = normalizeRoomLocale(booking.preferred_language) as InviteLocale;
    const roomUrl = shortLinkUrl(base, shortCode);
    // D2: only private (vehicle-charter) tours get the plan pre-selection CTA;
    // join tours run a fixed itinerary, so we pass no planUrl and the template
    // omits the CTA block entirely.
    const planUrl = tourIsPrivate ? shortLinkUrl(base, shortCode, 'plan') : undefined;
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
      entryCode,
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
      const guideShortCode = generateInviteShortCode();
      await recordInvite(supabase, {
        tour_id: booking.tour_id,
        tour_date: booking.tour_date,
        role: 'guide',
        token_hash: hashToken(token),
        short_code: guideShortCode,
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
      // 짧은 별칭으로 보낸다 — QR 밀도도 낮아져 현장 스캔이 쉬워진다.
      const guideUrl = shortLinkUrl(base, guideShortCode);
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
