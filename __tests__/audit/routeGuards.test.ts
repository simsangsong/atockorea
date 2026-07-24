/**
 * @jest-environment node
 *
 * A2.4 — permission-boundary guard. Scans every app/api route and asserts that
 * the set of routes which MUTATE with no auth guard is exactly the reviewed
 * public allowlist below. A new mutating route with no guard fails here — the
 * matrix maintains itself instead of a human re-reading 237 routes.
 *
 * 🔴 Every entry on the allowlist was individually verified (2026-07-25):
 *   · auth flows — public by nature (you cannot require auth to authenticate)
 *   · client telemetry sinks (analytics/logs) — no sensitive mutation
 *   · pre-purchase product AI + availability + quote — public surface, and the
 *     money-spending ones (LLM, email/SMS) are all rate-limited (requestGate)
 * If a NEW route lands here, it is guilty until reviewed: either add a guard or,
 * if it is genuinely public, add it AND its justification to the allowlist.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { analyzeRoute, guardlessMutating } from '@/lib/audit/routeGuards';

const API_DIR = join(process.cwd(), 'app', 'api');

/** Reviewed public, guard-less, mutating routes (see file header). */
const PUBLIC_ALLOWLIST = new Set<string>([
  '/api/agent/v1/quote', // issues a signed quote token; the token is the later credential
  '/api/analytics/events', // client telemetry sink
  '/api/auth/check-email',
  '/api/auth/forgot-id',
  '/api/auth/merchant/login',
  '/api/auth/send-verification-code', // rate-limited 3/min per IP
  '/api/auth/verify-code',
  '/api/contact', // rate-limited 3/min per IP
  '/api/itinerary/match', // public planner
  '/api/logs/error', // client error sink
  '/api/promo-codes/validate', // read-only validation, no value mutation
  '/api/tour-product/assistant/feedback',
  '/api/tour-product/assistant/live', // rate-limited 10/min per session
  '/api/tour-product/match', // rate-limited 10/min per IP
  '/api/tour-product/match-explanation',
  '/api/tours/[id]/availability', // public availability
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

describe('A2.4 route auth-guard boundary', () => {
  const files = walk(API_DIR);
  const routes = files.map((f) => {
    const api = '/api/' + relative(API_DIR, f).replace(/[/\\]route\.ts$/, '').replaceAll('\\', '/');
    return analyzeRoute(api, readFileSync(f, 'utf8'));
  });

  it('actually scanned the route tree', () => {
    expect(routes.length).toBeGreaterThan(200);
  });

  it('every guard-less mutating route is on the reviewed public allowlist', () => {
    const offenders = guardlessMutating(routes)
      .map((r) => r.api)
      .filter((api) => !PUBLIC_ALLOWLIST.has(api));
    // A non-empty list means a route mutates with no auth guard and no review.
    expect(offenders).toEqual([]);
  });

  it('the allowlist has no stale entries (each still exists and is still guard-less)', () => {
    const currentGuardless = new Set(guardlessMutating(routes).map((r) => r.api));
    const stale = [...PUBLIC_ALLOWLIST].filter((api) => !currentGuardless.has(api));
    // A stale entry means a route was deleted or has since gained a guard —
    // drop it so the allowlist can't quietly bless a future guard-less route.
    expect(stale).toEqual([]);
  });
});
