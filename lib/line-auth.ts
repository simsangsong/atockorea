/**
 * LINE OAuth hardening helpers (N18).
 *
 * Two confirmed weaknesses in the LINE login route:
 *   1. The `id_token` was trusted after a bare base64 decode (no signature /
 *      audience / expiry check). The email it carries becomes the Supabase
 *      account identity, so an untrusted token could seed an account under a
 *      victim's email. We now verify the token through LINE's own verify
 *      endpoint and only trust the email when the audience matches our channel.
 *   2. A static OAuth `state` ('line_oauth_state') gave no CSRF protection.
 *      We mint a random per-request state, stash it in an httpOnly cookie, and
 *      compare it on the callback.
 */

/** LINE's OpenID token verification endpoint. Validates signature, audience,
 *  and expiry server-side and returns the decoded payload on success. */
export const LINE_VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

/** Cookie that carries the per-request OAuth state for CSRF protection. */
export const LINE_OAUTH_STATE_COOKIE = 'line_oauth_state';

/** Shape of the payload LINE's verify endpoint returns (subset we use). */
export interface LineVerifiedPayload {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Extract the email from a LINE verify-endpoint payload, but only if the token
 * was actually issued for our channel (audience check). Returns null when the
 * audience does not match or no usable email is present — callers then fall
 * back to the synthetic `line_<userId>@line.local` identity, exactly as before
 * verification was added (so a verify failure never breaks login).
 */
export function extractEmailFromVerifiedToken(
  payload: LineVerifiedPayload | null | undefined,
  expectedChannelId: string | undefined,
): string | null {
  if (!payload || !expectedChannelId) return null;
  if (payload.aud !== expectedChannelId) return null;
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  return email.length > 0 ? email.toLowerCase() : null;
}

/**
 * Constant-ish-time-ish equality for the OAuth state value. Both sides must be
 * present and identical. Length mismatch short-circuits (the values are random
 * tokens, not secrets whose length must be hidden).
 */
export function statesMatch(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!received || !expected) return false;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i += 1) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
