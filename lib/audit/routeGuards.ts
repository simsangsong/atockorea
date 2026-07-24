/**
 * A2.4 — permission-boundary extraction (pure core).
 *
 * 🔴 The plan forbids a hand-filled role×route matrix (§H-4: it ends up
 *    half-done and marked "checked"). Instead we statically detect whether each
 *    route references ANY auth/authz guard, and surface only the routes that
 *    mutate with no guard at all. A human judges that short list; a test
 *    (`__tests__/audit/routeGuards.test.ts`) pins it against a reviewed
 *    allowlist so a NEW unguarded mutating route fails CI instead of shipping.
 *
 * A guard is any credential/authorisation check: a Supabase-session helper, an
 * admin/merchant gate, a room-session/token verifier, a webhook signature, or a
 * cron secret. The list is intentionally broad — a false "guarded" is corrected
 * by a reviewer noticing a route on neither list; a false "unguarded" (a missing
 * pattern) just adds noise the reviewer clears by extending GUARD_SYMBOLS. When
 * in doubt, add the symbol here rather than suppress a finding.
 */

export const GUARD_SYMBOLS: readonly string[] = [
  // Supabase-session helpers (lib/auth). getAuthUser is the primary one.
  'getAuthUser', 'getAuthUserFromToken', 'requireAuth', 'requireAuthUser', 'adminAuthJsonResponse',
  'requireAdmin', 'requireMerchant', 'requireStaff', 'requireUser',
  // Tour-room / ops session + token verifiers.
  'resolveRoomActor', 'ensureRoom', 'verifyRoomSession', 'resolveOpsRoomActor',
  'verifyClaimToken', 'verifyCheckinToken', 'verifyCompanion', 'verifyDriver',
  'verifyRoomCheckinToken', 'verifyRoomToken', 'verifyCheckinNonce',
  'verifyQuote', 'signRoom', 'decodeRoomToken', 'verifyGuideSchedule',
  'getServerSession', 'withAuth', 'assertAdmin', 'isAdmin',
  'auth.getUser', '.getUser(',
  'x-tour-room-auth', 'x-tour-room-token',
  'Authorization', 'authorization',
  // Cron secret + webhook signatures.
  'CRON_SECRET', 'constructEvent', 'svix', 'new Webhook',
  'RESEND_WEBHOOK_SECRET', 'WEBHOOK_SECRET', 'x-telegram-bot-api-secret-token',
] as const;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const METHOD_RE =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

export interface RouteGuardResult {
  /** API path, e.g. "/api/tour-rooms/[bookingId]/sos". */
  api: string;
  methods: string[];
  mutatingMethods: string[];
  guarded: boolean;
}

/** Extract the guard status of one route file's source. */
export function analyzeRoute(apiPath: string, source: string): RouteGuardResult {
  const guarded = GUARD_SYMBOLS.some((g) => source.includes(g));
  const methods = new Set<string>();
  for (const m of source.matchAll(METHOD_RE)) methods.add((m[1] || m[2]) as string);
  const methodList = [...methods].sort();
  return {
    api: apiPath,
    methods: methodList,
    mutatingMethods: methodList.filter((m) => MUTATING.has(m)),
    guarded,
  };
}

/** Routes that mutate with no guard — the P0-candidate shortlist. */
export function guardlessMutating(routes: RouteGuardResult[]): RouteGuardResult[] {
  return routes.filter((r) => !r.guarded && r.mutatingMethods.length > 0);
}
