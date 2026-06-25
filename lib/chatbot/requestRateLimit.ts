// Generic in-memory IP/key request throttle for chatbot endpoints.
//
// Best-effort abuse/cost brake — it is per-process (serverless instances each
// keep their own map) and resets on deploy, so it is NOT a hard security
// boundary. Its job is to blunt casual scripted abuse and runaway cost on
// endpoints that fan out to paid LLM/embedding APIs. For durable limits across
// instances use a shared store (Redis); the call sites here are written so that
// swap is localized.

import {
  isDurableRateLimitConfigured,
  durableIncrWindow,
  evaluatePostIncrementWindow,
} from '@/lib/durable-rate-limit';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MINUTE_SEC = 60;
const HOUR_SEC = 60 * MINUTE_SEC;

export type RateConfig = { perMinute: number; perHour: number };

// namespace -> (key -> hit timestamps)
const namespaces = new Map<string, Map<string, number[]>>();

function bucketFor(namespace: string, key: string): { store: Map<string, number[]>; hits: number[] } {
  let store = namespaces.get(namespace);
  if (!store) {
    store = new Map();
    namespaces.set(namespace, store);
  }
  return { store, hits: store.get(key) ?? [] };
}

export type RateResult = { allowed: boolean; retryAfterMs: number };

/**
 * Sliding-window check that CONSUMES a slot when allowed. Call once per request.
 */
export function allowRequest(
  namespace: string,
  key: string,
  cfg: RateConfig,
  now: number = Date.now(),
): RateResult {
  const { store, hits } = bucketFor(namespace, key);
  const recent = hits.filter((t) => now - t < HOUR_MS);
  const perMinute = recent.filter((t) => now - t < MINUTE_MS).length;
  if (perMinute >= cfg.perMinute) {
    store.set(key, recent);
    return { allowed: false, retryAfterMs: MINUTE_MS };
  }
  if (recent.length >= cfg.perHour) {
    store.set(key, recent);
    return { allowed: false, retryAfterMs: HOUR_MS };
  }
  recent.push(now);
  store.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}

/** Test helper — clears all throttle state. */
export function __resetRequestRateLimit(): void {
  namespaces.clear();
}

/**
 * CB-2 / W9.11 — durable-aware `allowRequest`. When Upstash is configured it
 * consumes a slot in a shared minute + hour counter so the throttle holds across
 * serverless instances. When Upstash is unconfigured OR a Redis call fails, it
 * falls back to the in-memory {@link allowRequest} — fail-open so a Redis outage
 * degrades the brake to per-instance rather than breaking the endpoint.
 */
export async function allowRequestDurable(
  namespace: string,
  key: string,
  cfg: RateConfig,
): Promise<RateResult> {
  if (isDurableRateLimitConfigured()) {
    try {
      const minuteKey = `rl:${namespace}:${key}:m`;
      const hourKey = `rl:${namespace}:${key}:h`;
      const [minuteCount, hourCount] = await Promise.all([
        durableIncrWindow(minuteKey, MINUTE_SEC),
        durableIncrWindow(hourKey, HOUR_SEC),
      ]);
      const minute = evaluatePostIncrementWindow(minuteCount, cfg.perMinute, MINUTE_MS);
      if (!minute.allowed) return minute;
      return evaluatePostIncrementWindow(hourCount, cfg.perHour, HOUR_MS);
    } catch (err) {
      console.warn('[requestRateLimit] durable path failed; falling back to in-memory:', err);
    }
  }
  return allowRequest(namespace, key, cfg);
}
