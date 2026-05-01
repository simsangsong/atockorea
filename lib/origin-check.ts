/**
 * Origin / Referer validation for state-changing API routes.
 *
 * Defence in depth on top of SameSite cookies. Blocks classic CSRF where an
 * attacker page does fetch('https://atockorea.com/api/...', {method:'POST'})
 * with the user's cookies attached.
 *
 * Webhook routes (Stripe / PayPal / Resend) MUST NOT use this — they verify
 * the request via the provider signature instead.
 */
import { NextRequest, NextResponse } from "next/server";

function buildAllowedOrigins(): Set<string> {
  const out = new Set<string>();
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      out.add(new URL(c).origin);
    } catch {
      /* ignore malformed env */
    }
  }
  if (process.env.NODE_ENV !== "production") {
    out.add("http://localhost:3000");
    out.add("http://127.0.0.1:3000");
    out.add("http://0.0.0.0:3000");
  }
  return out;
}

let cachedAllowed: Set<string> | null = null;
function allowedOrigins(): Set<string> {
  if (!cachedAllowed) cachedAllowed = buildAllowedOrigins();
  return cachedAllowed;
}

function isAllowedOriginValue(origin: string): boolean {
  try {
    const o = new URL(origin).origin;
    return allowedOrigins().has(o);
  } catch {
    return false;
  }
}

export type OriginCheckOptions = {
  /**
   * If true, requests carrying a Bearer Authorization header (server-to-server
   * or mobile native clients without an Origin header) are exempt.
   *
   * Default: true. Set to false for endpoints that should be browser-only.
   */
  allowBearerWithoutOrigin?: boolean;
};

export function checkOrigin(
  req: NextRequest,
  opts: OriginCheckOptions = {}
): NextResponse | null {
  const { allowBearerWithoutOrigin = true } = opts;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const auth = req.headers.get("authorization") ?? "";
  const hasBearer = auth.toLowerCase().startsWith("bearer ");

  if (origin) {
    if (isAllowedOriginValue(origin)) return null;
    return NextResponse.json(
      { error: "forbidden", code: "ORIGIN_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  if (referer) {
    if (isAllowedOriginValue(referer)) return null;
    return NextResponse.json(
      { error: "forbidden", code: "REFERER_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  if (allowBearerWithoutOrigin && hasBearer) {
    return null;
  }

  return NextResponse.json(
    { error: "forbidden", code: "ORIGIN_REQUIRED" },
    { status: 403 }
  );
}

/**
 * Convenience wrapper — returns true to continue, false if a 403 was already returned.
 * Usage:
 *   const block = checkOrigin(req); if (block) return block;
 */
