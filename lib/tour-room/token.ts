/**
 * Signed invite tokens for Tour Mode rooms (master plan §B D-2, §O-1, §O-3).
 *
 * A token IS the room key: clicking an invite link must open the room with no
 * login, signup, or site shell in between. Two scopes exist:
 *
 *   - customer → one booking:   { scope: 'booking',   bookingId }
 *   - guide    → one tour day:  { scope: 'tour-date', tourId, tourDate }
 *
 * Guide tokens are deliberately NOT per-booking (§O-3): the guide console and
 * the fan-out broadcast API authorize on (tourId, tourDate), and a single
 * booking's cancellation must never kill the guide's link.
 *
 * Format: base64url(JSON payload) + "." + hex(HMAC-SHA256) — same primitive as
 * lib/agent/quoteToken.ts. The payload is not encrypted (it carries nothing
 * secret); the signature is what matters. Revocation is out of band: the
 * sha256 hash of the full token is recorded in tour_room_invites and checked
 * server-side (see hashToken / lib/tour-room/access.ts).
 *
 * Rotation (§O-13): verification accepts TOUR_ROOM_TOKEN_SECRET and, when set,
 * TOUR_ROOM_TOKEN_SECRET_PREV — rotating the secret does not kill links that
 * are already in travellers' inboxes.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const TOUR_ROOM_TOKEN_DEV_SECRET = 'atoc-tour-room-dev-secret';

/** Extra validity past the KST end of the tour date (§B D-2). */
const POST_TOUR_GRACE_SECONDS = 24 * 60 * 60;
/** KST is UTC+9, no DST. */
const KST_OFFSET_SECONDS = 9 * 60 * 60;

export interface CustomerRoomTokenPayload {
  scope: 'booking';
  role: 'customer';
  bookingId: string;
  displayName: string;
  iat: number;
  exp: number;
}

export interface GuideRoomTokenPayload {
  scope: 'tour-date';
  role: 'guide';
  tourId: string;
  /** YYYY-MM-DD (KST tour day). */
  tourDate: string;
  displayName: string;
  iat: number;
  exp: number;
}

/** P-D15 (private mode W3) — the driver's tour-date key, like the guide's. */
export interface DriverRoomTokenPayload {
  scope: 'tour-date';
  role: 'driver';
  tourId: string;
  /** YYYY-MM-DD (KST tour day). */
  tourDate: string;
  displayName: string;
  iat: number;
  exp: number;
}

export type RoomTokenPayload = CustomerRoomTokenPayload | GuideRoomTokenPayload | DriverRoomTokenPayload;

function primarySecret(): string {
  const secret = process.env.TOUR_ROOM_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    // Keep working (links must not 500) but make the misconfiguration loud.
    console.warn('[tour-room] TOUR_ROOM_TOKEN_SECRET is not set in production — using dev fallback secret');
  }
  return TOUR_ROOM_TOKEN_DEV_SECRET;
}

function verificationSecrets(): string[] {
  const secrets = [primarySecret()];
  const prev = process.env.TOUR_ROOM_TOKEN_SECRET_PREV;
  if (prev && !secrets.includes(prev)) secrets.push(prev);
  return secrets;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Unix seconds when a token anchored to `tourDate` expires:
 * end of that day in KST (23:59:59) + 24h grace.
 */
export function roomTokenExpiryForTourDate(tourDate: string): number {
  if (!isValidYmd(tourDate)) {
    throw new Error(`Invalid tour date for room token: ${tourDate}`);
  }
  const [y, m, d] = tourDate.split('-').map(Number);
  const endOfDayKstMs = Date.UTC(y, m - 1, d, 23, 59, 59) - KST_OFFSET_SECONDS * 1000;
  return Math.floor(endOfDayKstMs / 1000) + POST_TOUR_GRACE_SECONDS;
}

export function signCustomerRoomToken(input: {
  bookingId: string;
  displayName: string;
  tourDate: string;
}): { token: string; payload: CustomerRoomTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: CustomerRoomTokenPayload = {
    scope: 'booking',
    role: 'customer',
    bookingId: input.bookingId,
    displayName: input.displayName,
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  return { token: encode(payload), payload };
}

export function signGuideRoomToken(input: {
  tourId: string;
  tourDate: string;
  displayName: string;
}): { token: string; payload: GuideRoomTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: GuideRoomTokenPayload = {
    scope: 'tour-date',
    role: 'guide',
    tourId: input.tourId,
    tourDate: input.tourDate,
    displayName: input.displayName,
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  return { token: encode(payload), payload };
}

export function signDriverRoomToken(input: {
  tourId: string;
  tourDate: string;
  displayName?: string;
}): { token: string; payload: DriverRoomTokenPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: DriverRoomTokenPayload = {
    scope: 'tour-date',
    role: 'driver',
    tourId: input.tourId,
    tourDate: input.tourDate,
    displayName: input.displayName?.trim() || 'Driver',
    iat,
    exp: roomTokenExpiryForTourDate(input.tourDate),
  };
  return { token: encode(payload), payload };
}

function encode(payload: RoomTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, primarySecret())}`;
}

function signatureMatches(body: string, sig: string): boolean {
  for (const secret of verificationSecrets()) {
    const expected = sign(body, secret);
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function isCustomerPayload(payload: Record<string, unknown>): payload is CustomerRoomTokenPayload & Record<string, unknown> {
  return (
    payload.scope === 'booking' &&
    payload.role === 'customer' &&
    typeof payload.bookingId === 'string' &&
    payload.bookingId.length > 0
  );
}

function isGuidePayload(payload: Record<string, unknown>): payload is GuideRoomTokenPayload & Record<string, unknown> {
  return (
    payload.scope === 'tour-date' &&
    payload.role === 'guide' &&
    typeof payload.tourId === 'string' &&
    payload.tourId.length > 0 &&
    typeof payload.tourDate === 'string' &&
    isValidYmd(payload.tourDate)
  );
}

function isDriverPayload(payload: Record<string, unknown>): payload is DriverRoomTokenPayload & Record<string, unknown> {
  return (
    payload.scope === 'tour-date' &&
    payload.role === 'driver' &&
    typeof payload.tourId === 'string' &&
    payload.tourId.length > 0 &&
    typeof payload.tourDate === 'string' &&
    isValidYmd(payload.tourDate)
  );
}

/**
 * Verify a room token: signature (current or previous secret), shape, and
 * expiry. Returns the payload or null. Revocation (tour_room_invites) is a
 * separate server-side check — callers that need it should also consult the
 * invite ledger via hashToken().
 */
export function verifyRoomToken(token: unknown): RoomTokenPayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  if (!signatureMatches(body, sig)) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.displayName !== 'string') return null;

  if (isCustomerPayload(payload)) return payload;
  if (isGuidePayload(payload)) return payload;
  if (isDriverPayload(payload)) return payload;
  return null;
}

/** sha256 hex of the full token — what tour_room_invites.token_hash stores. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
