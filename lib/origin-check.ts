/**
 * Origin / Referer validation for state-changing API routes.
 *
 * Defence in depth on top of SameSite cookies. Blocks classic CSRF where an
 * attacker page does fetch('https://atockorea.com/api/...', {method:'POST'})
 * with the user's cookies attached.
 *
 * Webhook routes (Stripe / Resend) MUST NOT use this — they verify
 * the request via the provider signature instead.
 */
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_PRODUCTION_ORIGINS = [
  "https://atockorea.com",
  "https://www.atockorea.com",
];

function hasScheme(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function addWwwVariant(out: Set<string>, origin: string): void {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname.includes(":") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return;
    }

    if (hostname.startsWith("www.")) {
      url.hostname = hostname.slice(4);
      out.add(url.origin);
      return;
    }

    if (hostname.split(".").length === 2) {
      url.hostname = `www.${hostname}`;
      out.add(url.origin);
    }
  } catch {
    /* ignore malformed env */
  }
}

function addOriginCandidates(
  out: Set<string>,
  value: string | undefined,
  includeWwwVariant = true
): void {
  if (!value) return;

  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    try {
      const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
      const origin = new URL(candidate).origin;
      out.add(origin);
      if (includeWwwVariant) addWwwVariant(out, origin);
    } catch {
      /* ignore malformed env */
    }
  }
}

function buildAllowedOrigins(): Set<string> {
  const out = new Set<string>();
  const candidates = [
    process.env.ALLOWED_ORIGINS,
    process.env.CSRF_ALLOWED_ORIGINS,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    ...DEFAULT_PRODUCTION_ORIGINS,
  ];
  for (const c of candidates) {
    addOriginCandidates(out, c);
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

function requestOrigins(req: NextRequest): Set<string> {
  const out = new Set<string>();

  addOriginCandidates(out, req.url, false);

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.split(",")[0]?.trim();

  if (host) {
    let protocol = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (!protocol) {
      try {
        protocol = new URL(req.url).protocol.replace(/:$/, "");
      } catch {
        protocol = "https";
      }
    }

    addOriginCandidates(out, `${protocol}://${host}`, false);
  }

  return out;
}

function isAllowedOriginValue(origin: string, req: NextRequest): boolean {
  try {
    const o = new URL(origin).origin;
    return allowedOrigins().has(o) || requestOrigins(req).has(o);
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
    if (isAllowedOriginValue(origin, req)) return null;
    return NextResponse.json(
      { error: "forbidden", code: "ORIGIN_NOT_ALLOWED" },
      { status: 403 }
    );
  }

  if (referer) {
    if (isAllowedOriginValue(referer, req)) return null;
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
