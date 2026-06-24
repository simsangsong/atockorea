import { randomBytes } from 'crypto';

/**
 * Cryptographically-strong temporary password for merchant accounts
 * (W3.4 / S-F2). Replaces `Math.random()` (predictable, not a CSPRNG).
 *
 * 18 url-safe random characters (~107 bits of entropy) plus a fixed
 * `!Aa1` suffix that guarantees the upper/lower/digit/symbol complexity
 * Supabase Auth requires. The password is delivered to the merchant by email
 * and must be changed on first login.
 */
export function generateTempPassword(): string {
  const core = randomBytes(18).toString('base64url').slice(0, 18);
  return `${core}!Aa1`;
}
