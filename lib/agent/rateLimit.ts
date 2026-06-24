/**
 * Lightweight per-client rate limiter for the agent channel.
 *
 * In-memory, fixed-window. No infra dependency. NOTE: serverless instances
 * don't share memory, so the effective limit is per-instance — this is a
 * courtesy throttle / abuse speed-bump, not a hard global quota. A real global
 * limiter (Upstash/Redis) is a later upgrade; the call sites here won't change.
 *
 * API-key tiers: a client presenting a key listed in `AGENT_API_KEYS`
 * (comma-separated `label:key` pairs, or bare keys) gets the higher limit and
 * is identified by label in logs/persistence.
 */

const WINDOW_MS = 60_000;
const ANON_LIMIT = 60; // requests / minute / instance for keyless clients
const KEYED_LIMIT = 600; // for clients with a valid API key

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

function parseApiKeys(): Map<string, string> {
  // Map<key, label>
  const out = new Map<string, string>();
  const raw = process.env.AGENT_API_KEYS;
  if (!raw) return out;
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(":");
    if (idx > 0) out.set(part.slice(idx + 1).trim(), part.slice(0, idx).trim());
    else out.set(part, "keyed");
  }
  return out;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateDecision {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  apiKeyLabel: string | null;
}

export function rateLimit(req: Request): RateDecision {
  const keys = parseApiKeys();
  const presented = req.headers.get("x-api-key")?.trim() || "";
  const apiKeyLabel = presented && keys.has(presented) ? keys.get(presented)! : null;

  const limit = apiKeyLabel ? KEYED_LIMIT : ANON_LIMIT;
  const id = apiKeyLabel ? `key:${apiKeyLabel}` : `ip:${clientIp(req)}`;
  const now = Date.now();

  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(id, b);
  }
  b.count += 1;

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const remaining = Math.max(0, limit - b.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return {
    ok: b.count <= limit,
    limit,
    remaining,
    resetAt: b.resetAt,
    retryAfterSeconds,
    apiKeyLabel,
  };
}

export function rateLimitHeaders(d: RateDecision): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(d.limit),
    "X-RateLimit-Remaining": String(d.remaining),
    "X-RateLimit-Reset": String(Math.ceil(d.resetAt / 1000)),
  };
  if (!d.ok) h["Retry-After"] = String(d.retryAfterSeconds);
  return h;
}
