/**
 * Daily API-call counters for the dining collectors (§5.7 R-3).
 *
 * 🔴 WHY THIS MODULE EXISTS — a measured bug. `noteKakaoCall()` and
 * `quotaState()` both funnelled into `durableIncrWindow` / `durableReadCount`,
 * which THROW when `UPSTASH_REDIS_REST_URL` / `_TOKEN` are unset. Both callers
 * caught the throw and returned `used: 0`. The result: a seeding run that had
 * just spent 10 Kakao calls printed `kakao quota today 0/30000 (0.0%)`, and —
 * far worse than the cosmetic lie — the 70 % brake in `scripts/seed-dining-cells.ts`
 * and the `quota.exhausted` guard in `cache.server.ts` could never fire. The
 * one thing standing between a runaway loop and a burned daily budget was
 * hard-wired to "plenty left".
 *
 * The fix has two halves:
 *
 *  1. A PROCESS-LOCAL fallback counter. It cannot see other serverless
 *     instances — that is precisely what Upstash is for — but the realistic
 *     burn shape is one long-running process in a loop (the seeding script over
 *     30 POIs), and in-process counting brakes that correctly. Under-counting
 *     across instances is a smaller failure than counting nothing at all.
 *
 *  2. `durable: false` on the returned state, so every surface can say
 *     "in-process only" instead of printing a confident, wrong percentage. A
 *     number an operator cannot trust is worse than an admitted unknown.
 *
 * Both providers share this module rather than each keeping a copy of the same
 * logic — the original duplication is how the same defect ended up in two files.
 */

import { durableIncrWindow, durableReadCount } from '@/lib/durable-rate-limit';

export interface DailyQuotaState {
  used: number;
  cap: number;
  /** used / cap, 0 when the cap is not a positive number. */
  ratio: number;
  /** true at ≥ the alert ratio — the caller pings ops once a day. */
  shouldAlert: boolean;
  /** true at ≥ 100 % — collection stops and serving degrades to cache-only. */
  exhausted: boolean;
  /**
   * false when no durable store answered, i.e. `used` counts THIS PROCESS only
   * and other instances are invisible. Surfaces must label it; guards should
   * still honour it (an under-count is a floor, never an over-count).
   */
  durable: boolean;
}

/** Fallback counters, keyed the same as the durable ones. Per-process by design. */
const localWindows = new Map<string, { count: number; resetAt: number }>();

function bumpLocal(key: string, windowSec: number): number {
  const now = Date.now();
  const current = localWindows.get(key);
  if (!current || now >= current.resetAt) {
    localWindows.set(key, { count: 1, resetAt: now + windowSec * 1_000 });
    return 1;
  }
  current.count += 1;
  return current.count;
}

function readLocal(key: string): number {
  const current = localWindows.get(key);
  if (!current || Date.now() >= current.resetAt) return 0;
  return current.count;
}

function stateFor(used: number, cap: number, alertRatio: number, durable: boolean): DailyQuotaState {
  const ratio = cap > 0 ? used / cap : 0;
  return { used, cap, ratio, shouldAlert: ratio >= alertRatio, exhausted: ratio >= 1, durable };
}

export interface QuotaCounterOptions {
  key: string;
  windowSec: number;
  cap: number;
  alertRatio: number;
}

/**
 * Count one outbound call. Never throws — an unreachable counter must not break
 * collection. Falls back to the process-local window when the durable store is
 * unavailable, so the count is never silently zero.
 */
export async function noteQuotaCall(opts: QuotaCounterOptions): Promise<DailyQuotaState> {
  try {
    const used = await durableIncrWindow(opts.key, opts.windowSec);
    return stateFor(used, opts.cap, opts.alertRatio, true);
  } catch {
    return stateFor(bumpLocal(opts.key, opts.windowSec), opts.cap, opts.alertRatio, false);
  }
}

/** Read-only view for the collect guard, the seeding brake and the admin surface. */
export async function readQuotaState(opts: QuotaCounterOptions): Promise<DailyQuotaState> {
  try {
    const used = await durableReadCount(opts.key);
    return stateFor(used, opts.cap, opts.alertRatio, true);
  } catch {
    return stateFor(readLocal(opts.key), opts.cap, opts.alertRatio, false);
  }
}

/** Test helper — clears the process-local fallback windows. */
export function __resetLocalQuotaWindows(): void {
  localWindows.clear();
}
