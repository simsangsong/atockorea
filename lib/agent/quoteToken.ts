/**
 * Signed quote tokens for the AI-agent channel (`/api/agent/v1/*`).
 *
 * An agent calls `POST /api/agent/v1/quote` to get a price it can show the
 * traveller, then passes the returned `quote_token` back to
 * `POST /api/agent/v1/book`. The token is an HMAC-signed snapshot of the
 * priced inputs, so the booking step can prove the agent is transacting on a
 * price *we* issued — not one the model hallucinated — and that it hasn't
 * expired. This is the trust primitive of the agent channel: deterministic,
 * verifiable, replay-bounded.
 *
 * Format:  base64url(JSON payload) + "." + hex(HMAC-SHA256)
 * The payload is plain JSON (not encrypted) — it carries nothing secret, only
 * the slug / date / party size / price we already showed the agent. The
 * signature is the part that matters.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes — long enough for a human to confirm.

export interface QuotePayload {
  /** Catalogue product slug being quoted. */
  slug: string;
  /** Tour date the quote is anchored to (YYYY-MM-DD). */
  date: string;
  /** Party size the quote was computed for. */
  guests: number;
  /** Per-unit price we showed the agent (USD). */
  unitPriceUsd: number;
  /** Estimated total (USD) — final amount is reconfirmed at hosted checkout. */
  estimatedTotalUsd: number;
  /** Unix seconds when this token was issued. */
  iat: number;
  /** Unix seconds when this token expires. */
  exp: number;
}

function secret(): string {
  return (
    process.env.AGENT_QUOTE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    // Dev-only fallback so local/preview works without extra config. Set
    // AGENT_QUOTE_SECRET in production for a stable, rotation-controlled key.
    "atoc-agent-channel-dev-secret"
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("hex");
}

/** Issue a signed quote token for the given priced inputs. */
export function signQuote(
  input: Omit<QuotePayload, "iat" | "exp">,
): { token: string; payload: QuotePayload } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: QuotePayload = { ...input, iat, exp: iat + TOKEN_TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, payload };
}

/**
 * Verify a quote token. Returns the payload when the signature is valid and
 * the token has not expired, otherwise `null`. Constant-time signature
 * comparison guards against timing oracles.
 */
export function verifyQuote(token: unknown): QuotePayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.lastIndexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = sign(body);
  let ok = false;
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    ok = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return null;
  }
  if (!ok) return null;

  let payload: QuotePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

export const AGENT_QUOTE_TTL_SECONDS = TOKEN_TTL_SECONDS;
