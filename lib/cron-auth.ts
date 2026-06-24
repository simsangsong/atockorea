/**
 * Shared Vercel Cron authentication.
 *
 * Vercel Cron invokes endpoints with a GET request and, when `CRON_SECRET` is
 * set in the project env, attaches `Authorization: Bearer <CRON_SECRET>`. We
 * also accept a legacy `X-Cron-Secret: <CRON_SECRET>` header for manual/internal
 * triggers.
 *
 * There is deliberately NO query-string fallback — secrets placed in query
 * strings leak via access logs and the `Referer` header, which would let anyone
 * replay the trigger (W-3).
 *
 * `checkCronAuth` distinguishes "secret unconfigured" (fail-closed → 503) from
 * "wrong/absent token" (→ 401) so callers can keep that response contract while
 * sharing one tested implementation.
 */

export type CronAuthResult = 'authorized' | 'unconfigured' | 'forbidden';

/** Resolve the configured cron secret (primary or Vercel-provided fallback). */
export function readCronSecret(): string | undefined {
  return process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
}

/**
 * Extract the bearer/header token from request headers. Returns `undefined`
 * when neither header carries a usable token.
 */
export function extractCronToken(
  authorization: string | null | undefined,
  xCronSecret: string | null | undefined,
): string | undefined {
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }
  return xCronSecret ?? undefined;
}

/**
 * Validate cron credentials. Pass `secret` explicitly in tests; defaults to the
 * configured env secret in production.
 */
export function checkCronAuth(
  headers: { authorization?: string | null; xCronSecret?: string | null },
  secret: string | undefined = readCronSecret(),
): CronAuthResult {
  if (!secret) return 'unconfigured';
  const token = extractCronToken(headers.authorization, headers.xCronSecret);
  return token === secret ? 'authorized' : 'forbidden';
}
