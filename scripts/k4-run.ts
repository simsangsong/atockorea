/**
 * K4v2 Phase 3+4 — drive every declared route pair once, then print what ran
 * and what did not.
 *
 *   ALLOW_SIM_SEED=1 npx tsx scripts/k4-seed.ts     ← 20 rooms
 *   npx tsx scripts/k4-run.ts --free                ← no model spend, shape check
 *   npx tsx scripts/k4-run.ts                       ← the real run (spends tokens)
 *   npx tsx scripts/sim-tour-day.ts --cleanup       ← always
 *
 * Target defaults to a local dev server (`K4_BASE` to override). Local is the
 * right target here: the owner's decision turned K4 from a load test into a
 * FEATURE-COVERAGE run, so what matters is that every handler executes against
 * the real database — not that production takes the traffic.
 *
 * ## The two rules this harness exists to obey
 *
 * 1. **Every declared pair is attempted exactly once.** The ledger
 *    (`lib/audit/k4Coverage.ts`) assigns each pair to one of the 20 rooms, so
 *    "20 rooms" costs ~12 model calls in total, not 12 per room.
 * 2. **Silence is a result.** A pair that is skipped, unreachable, or never
 *    written into this file is PRINTED. A coverage run that only lists its
 *    successes is the failure mode this whole ticket was created to stop.
 *
 * `--free` runs only the `free` tier. It exists so the request shapes can be
 * corrected without paying for the correction — the model-tier pairs are the
 * expensive ones and they should be attempted once, when the rest is known good.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import {
  buildLedger,
  collectK4Pairs,
  key,
  summarize,
  K4_ROOMS,
  K4_NOT_MEASURED,
  type K4LedgerRow,
} from '../lib/audit/k4Coverage';
import type { K4Room } from './k4-seed';

loadEnvConfig(process.cwd());

const BASE = process.env.K4_BASE ?? 'http://localhost:3181';
const FREE_ONLY = process.argv.includes('--free');
const FIX = path.join('scripts', '.k4-fixtures.json');

if (!existsSync(FIX)) {
  console.error(`${FIX} missing — seed first:\n  ALLOW_SIM_SEED=1 npx tsx scripts/k4-seed.ts`);
  process.exit(2);
}
const fixtures = JSON.parse(readFileSync(FIX, 'utf8')) as {
  tourDate: string;
  rooms: K4Room[];
  staffTokens: Record<string, { guide: string; driver: string }>;
};

// ---------------------------------------------------------------------------
// Result recording
// ---------------------------------------------------------------------------

type Verdict = 'PASS' | 'FAIL' | 'SKIP' | 'UNWRITTEN';

interface Result {
  key: string;
  room: number | null;
  tier: string;
  actor: string;
  status: number | string;
  verdict: Verdict;
  detail: string;
  ms: number;
}

const results: Result[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function short(v: unknown, n = 160): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return !s ? '' : s.length > n ? `${s.slice(0, n)}…` : s;
}

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

interface RoomState extends K4Room {
  session: string;
  /** A message id in this room, needed by retranslate / reactions / tts. */
  messageId: string | null;
}

const state = new Map<number, RoomState>();

/** Join is pinned to EVERY room by the ledger — it is the door. */
async function joinAll(): Promise<void> {
  let ok = 0;
  for (const room of fixtures.rooms) {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}/api/tour-rooms/${room.bookingId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceKey: randomUUID(),
          token: room.guestToken,
          contactName: `K4 ${room.room}`,
          locale: room.locale,
        }),
      });
      const body = await res.json().catch(() => ({}));
      const session = body?.session ?? '';
      if (res.ok && session) {
        state.set(room.room, { ...room, session, messageId: null });
        ok += 1;
      } else {
        results.push({
          key: 'POST /api/tour-rooms/[bookingId]/join',
          room: room.room,
          tier: 'free',
          actor: 'guest',
          status: res.status,
          verdict: 'FAIL',
          detail: `room ${room.room}: ${short(body)}`,
          ms: Date.now() - started,
        });
      }
    } catch (e) {
      results.push({
        key: 'POST /api/tour-rooms/[bookingId]/join',
        room: room.room,
        tier: 'free',
        actor: 'guest',
        status: 'ERR',
        verdict: 'FAIL',
        detail: `room ${room.room}: ${String(e)}`,
        ms: Date.now() - started,
      });
    }
  }
  results.push({
    key: 'POST /api/tour-rooms/[bookingId]/join',
    room: 0,
    tier: 'free',
    actor: 'guest',
    status: `${ok}/${fixtures.rooms.length}`,
    verdict: ok === fixtures.rooms.length ? 'PASS' : 'FAIL',
    detail: `every room walks through the door (${ok} joined)`,
    ms: 0,
  });
}

/**
 * 🔴 Staff sessions, per ROOM — not per tour, and not raw tokens.
 *
 * Two corrections the run itself forced, in order:
 *
 * 1. `x-tour-room-auth` carries a SESSION minted by `join`; a room token is
 *    what you hand TO `join` (or to `?rt=` on the overview routes). Passing the
 *    raw token answered 403 "Guide, driver, or admin only".
 * 2. A staff token is scoped to (tourId, tourDate), but the SESSION it mints is
 *    scoped to the BOOKING that was joined — so a session from room 3 answers
 *    403 "Access denied for this tour room" against room 7. Cached per booking.
 *
 * The first version had 403 inside several `ok` sets, so those rows reported
 * PASS while proving only that an unauthenticated caller is refused — the
 * "expected set too permissive" trap the ledger's own comment warns about,
 * reproduced exactly. Those sets are tightened now.
 */
const staffSessions = new Map<string, string>();

async function staffSessionFor(room: RoomState, role: 'guide' | 'driver'): Promise<string> {
  const cacheKey = `${role}:${room.bookingId}`;
  const cached = staffSessions.get(cacheKey);
  if (cached !== undefined) return cached;

  const tokens = fixtures.staffTokens[room.tourId];
  let session = '';
  if (tokens) {
    try {
      const res = await fetch(`${BASE}/api/tour-rooms/${room.bookingId}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceKey: randomUUID(),
          token: role === 'guide' ? tokens.guide : tokens.driver,
          contactName: `K4 ${role}`,
          locale: 'ko',
          // Driver rooms sit behind a plate-suffix PIN; `driver.ts` fails open
          // when the booking has no plate on file, which every sim room is.
          ...(role === 'driver' ? { pin: '0000' } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      session = body?.session ?? '';
    } catch {
      /* recorded as a FAIL by whichever pair needed it */
    }
  }
  staffSessions.set(cacheKey, session);
  return session;
}

// ---------------------------------------------------------------------------
// Request specs — one per declared pair
// ---------------------------------------------------------------------------

interface Ctx {
  room: RoomState;
  /** SESSION for header auth. */
  guide: string;
  driver: string;
  /** RAW tokens — only the `?rt=` overview routes and broadcast take these. */
  guideToken: string;
  driverToken: string;
  H: Record<string, string>;
}

interface Spec {
  /** Path with `:id` replaced. */
  path: (c: Ctx) => string;
  body?: (c: Ctx) => unknown;
  /** multipart bodies build their own FormData. */
  form?: (c: Ctx) => FormData;
  headers?: (c: Ctx) => Record<string, string>;
  /** Statuses that mean "the handler ran and the contract held". */
  ok: number[];
  /** Runs after a successful call — e.g. remember a message id. */
  after?: (body: any, c: Ctx) => void;
  /** Rooms this pair only makes sense in. */
  needsPrivate?: boolean;
  /**
   * 🔴 This pair needs a message to exist IN ITS OWN ROOM.
   *
   * Without it the route validates and returns early — 400 "messageId is
   * required", 404 "message not found" — which lands inside the accepted set
   * and reports PASS while the feature never ran. "The handler answered" and
   * "the feature was exercised" are different claims, and a coverage run that
   * conflates them is the thing this ticket exists to prevent.
   */
  needsMessage?: boolean;
}

const guestH = (c: Ctx) => ({ 'x-tour-room-auth': c.room.session });
const guideH = (c: Ctx) => ({ 'x-tour-room-auth': c.guide });
const driverH = (c: Ctx) => ({ 'x-tour-room-auth': c.driver });

/**
 * A short, REPEATED sentence corpus. Deliberate cost control: the translation
 * cache absorbs repeats, which is also why this run can never approach a
 * provider rate limit (recorded in K4_NOT_MEASURED).
 */
const SENTENCE = 'Where is the nearest toilet?';

/**
 * Post one message into `room` so message-dependent pairs exercise their real
 * path. Cached per room; the sentence is identical everywhere so the
 * translation cache absorbs the repeats.
 */
async function ensureMessage(room: RoomState): Promise<void> {
  if (room.messageId) return;
  try {
    const res = await fetch(`${BASE}/api/tour-rooms/${room.bookingId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tour-room-auth': room.session },
      body: JSON.stringify({ text: SENTENCE }),
    });
    const body = await res.json().catch(() => ({}));
    room.messageId = body?.message?.id ?? body?.id ?? null;
  } catch {
    /* the dependent pair reports the failure */
  }
}

const SPECS: Record<string, Spec> = {
  // ── chat core ─────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/messages': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/messages`,
    headers: guestH,
    ok: [200],
  },
  'POST /api/tour-rooms/[bookingId]/messages': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/messages`,
    headers: guestH,
    body: () => ({ text: SENTENCE }),
    ok: [200, 201],
    after: (b, c) => {
      c.room.messageId = b?.message?.id ?? b?.id ?? null;
    },
  },
  'POST /api/tour-rooms/[bookingId]/messages/[messageId]/retranslate': {
    needsMessage: true,
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/messages/${c.room.messageId}/retranslate`,
    headers: guestH,
    body: () => ({}),
    ok: [200, 201],
  },
  'GET /api/tour-rooms/[bookingId]/reactions': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/reactions`,
    headers: guestH,
    ok: [200],
  },
  'POST /api/tour-rooms/[bookingId]/reactions': {
    needsMessage: true,
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/reactions`,
    headers: guestH,
    body: (c) => ({ messageId: c.room.messageId, emoji: '👍' }),
    ok: [200, 201],
  },
  'POST /api/tour-rooms/[bookingId]/read': {
    needsMessage: true,
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/read`,
    headers: guestH,
    body: (c) => ({ lastMessageId: c.room.messageId }),
    ok: [200, 201, 204],
  },
  'POST /api/tour-rooms/[bookingId]/typing': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/typing`,
    headers: guestH,
    body: () => ({ typing: true }),
    ok: [200, 201, 204],
  },
  'GET /api/tour-rooms/[bookingId]/media': {
    // `kind` is required: image | file | link.
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/media?kind=image`,
    headers: guestH,
    ok: [200],
  },

  // ── voice ─────────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/tts': {
    needsMessage: true,
    path: (c) =>
      `/api/tour-rooms/${c.room.bookingId}/tts?messageId=${c.room.messageId ?? ''}&locale=${c.room.locale}`,
    headers: guestH,
    // 422 = the message exists but has no speakable text — a real answer.
    ok: [200, 422],
  },
  'POST /api/tour-rooms/[bookingId]/stt': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/stt`,
    headers: guestH,
    form: () => {
      const fd = new FormData();
      // A tiny silent WAV — enough to exercise upload + validation without
      // asking a speech model to transcribe anything meaningful.
      fd.append('audio', new Blob([silentWav()], { type: 'audio/wav' }), 'clip.wav');
      return fd;
    },
    ok: [200, 201, 400, 422, 429],
  },
  'POST /api/tour-rooms/[bookingId]/captions': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/captions`,
    headers: guideH, // guide-only — the 400 was hiding it
    // Tier A: caption a line of text. Without `text` (or an audio chunk) the
    // route answers 400 and the model never runs — a PASS that covered nothing.
    body: (c) => ({ locale: c.room.locale, text: SENTENCE }),
    ok: [200, 201, 204, 429],
  },

  // ── the day ───────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/tour-itinerary': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/tour-itinerary`,
    headers: guestH,
    ok: [200],
  },
  'GET /api/tour-rooms/[bookingId]/day-summary': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/day-summary`,
    headers: guideH, // staff-only — the run proved it; the ledger said guest
    ok: [200],
  },
  'POST /api/tour-rooms/[bookingId]/morning-briefing': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/morning-briefing`,
    headers: guideH, // staff-only — the run proved it; the ledger said guest
    body: (c) => ({ locale: c.room.locale }),
    ok: [200, 201, 204, 400, 429],
  },
  'GET /api/tour-rooms/[bookingId]/vehicle-eta': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/vehicle-eta`,
    headers: guestH,
    ok: [200, 404],
  },
  'POST /api/tour-rooms/[bookingId]/approach': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/approach`,
    headers: guestH,
    body: (c) => ({ locale: c.room.locale }),
    ok: [200, 201, 204, 400],
  },
  'GET /api/tour-rooms/[bookingId]/events': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/events`,
    headers: guestH,
    ok: [200],
  },
  'GET /api/tour-rooms/[bookingId]/my-seat': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/my-seat`,
    headers: guestH,
    ok: [200, 404],
  },

  // ── arrival + content ─────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/arrival-bundle': {
    // Staff-only (the run proved it; the ledger said guest), and `poiKey` is a
    // required query param on the GET — it resolves ONE spot's bundle.
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/arrival-bundle?poiKey=seongsan_ilchulbong`,
    headers: guideH,
    ok: [200, 404],
  },
  'POST /api/tour-rooms/[bookingId]/arrival-bundle': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/arrival-bundle`,
    headers: guideH,
    body: () => ({ title: 'Seongsan Ilchulbong', poiKey: 'seongsan_ilchulbong' }),
    ok: [200, 201, 400, 403, 429],
  },
  'POST /api/tour-rooms/[bookingId]/manual-arrival': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/manual-arrival`,
    headers: guideH,
    body: () => ({ title: 'Seongsan Ilchulbong', poiKey: 'seongsan_ilchulbong' }),
    ok: [200, 201, 400, 403, 429],
  },
  'POST /api/tour-rooms/[bookingId]/spot-events': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/spot-events`,
    headers: guestH,
    body: (c) => ({ locale: c.room.locale }),
    ok: [200, 201, 204, 400],
  },

  // ── food ──────────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/dining': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/dining`,
    headers: guestH,
    // Needs coordinates (or a known poiKey) — otherwise 400 and no search runs.
    // Seongsan Ilchulbong, so the lookup has somewhere real to stand.
    body: (c) => ({ locale: c.room.locale, lat: 33.4587, lng: 126.9425 }),
    ok: [200, 201, 204, 429],
  },
  'POST /api/tour-rooms/[bookingId]/dining/feedback': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/dining/feedback`,
    headers: guestH,
    body: () => ({ placeKey: 'k4_sim_place', action: 'up' }),
    ok: [200, 201, 204, 400],
  },
  'GET /api/tour-rooms/[bookingId]/dietary': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/dietary`,
    headers: guestH,
    ok: [200],
  },
  'PUT /api/tour-rooms/[bookingId]/dietary': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/dietary`,
    headers: guestH,
    body: () => ({ dietary: ['halal'], allergyNote: 'K4 sim — peanuts' }),
    ok: [200, 201, 204],
  },

  // ── planner ───────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/plan': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/plan`,
    headers: guestH,
    ok: [200],
  },
  'PUT /api/tour-rooms/[bookingId]/plan': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/plan`,
    headers: guestH,
    body: () => ({
      stops: [{ poi_key: 'seongsan_ilchulbong', title: 'Seongsan Ilchulbong', dwell_minutes: 60 }],
      needs: { stroller: false },
      departure_time: '09:00',
    }),
    ok: [200, 201, 403, 409],
  },
  'GET /api/tour-rooms/[bookingId]/plan/templates': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/plan/templates`,
    headers: guestH,
    ok: [200, 403],
  },
  'POST /api/tour-rooms/[bookingId]/plan/claim-lead': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/plan/claim-lead`,
    headers: guestH,
    body: () => ({}),
    ok: [200, 201, 204, 403, 409],
  },

  // ── ledger + money ────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/extras': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/extras`,
    headers: guestH,
    ok: [200],
  },
  'POST /api/tour-rooms/[bookingId]/extras': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/extras`,
    headers: guideH,
    body: () => ({ item: 'K4 sim entrance', amount_krw: 12000, kind: 'entrance' }),
    ok: [200, 201],
  },
  'PATCH /api/tour-rooms/[bookingId]/extras': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/extras`,
    headers: guideH,
    // Without a live extraId this is a contract check, not a transition.
    body: () => ({ extraId: '00000000-0000-4000-8000-000000000000', action: 'confirm' }),
    ok: [200, 400, 403, 404],
  },
  'POST /api/tour-rooms/[bookingId]/extend': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/extend`,
    // FA-019 — the guest is the actor the route is FOR: a guest adds their own
    // time, guide/admin may on their behalf, the driver may not. Driven with a
    // guide session, the paid path an actual guest walks was never exercised.
    headers: guestH,
    body: () => ({ hours: 1 }),
    needsPrivate: true,
    ok: [200, 201, 400],
  },

  // ── signals + location ────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/signals': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/signals`,
    headers: guestH,
    body: () => ({ type: 'running_late' }),
    ok: [200, 201, 204],
  },
  'POST /api/tour-rooms/[bookingId]/location': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/location`,
    headers: guestH,
    body: () => ({ latitude: 33.4586, longitude: 126.9421, accuracyM: 12 }),
    ok: [200, 201, 204],
  },
  'DELETE /api/tour-rooms/[bookingId]/location': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/location`,
    headers: guestH,
    ok: [200, 204],
  },
  'POST /api/tour-rooms/[bookingId]/driver-signal': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/driver-signal`,
    headers: driverH,
    body: () => ({ type: 'delay', minutes: 10 }),
    ok: [200, 201, 204],
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/concierge': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/concierge`,
    headers: guestH,
    body: (c) => ({ question: SENTENCE, locale: c.room.locale }),
    // 201 is the Tier-0 answer path (no model call) — a legitimate success the
    // first expected set was too narrow to admit.
    ok: [200, 201, 429],
  },
  // FA-023 — both of these were DECLARED in the ledger and had no request, so
  // the run printed `UNWRITTEN 2` while the coverage gate stayed green. They are
  // the newest pairs in the app (SG-4 meeting photo, SG-5 pickup vehicle photo),
  // which is exactly when a harness gap is most likely and least noticed.
  'POST /api/tour-rooms/[bookingId]/meeting-photo': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/meeting-photo`,
    // The ledger names the DRIVER, and on a solo-driver tour they are the one
    // holding the phone at the meeting point — so drive it as the declared actor
    // rather than as the most convenient staff session (the route accepts
    // guide/driver/admin, so either would have passed and hidden the drift).
    headers: driverH,
    form: () => {
      const fd = new FormData();
      fd.append('photo', new Blob([tinyPng()], { type: 'image/png' }), 'meeting.png');
      return fd;
    },
    // 415/413 are honest outcomes for a 1-pixel PNG against a real validator;
    // 409 when today's photo already exists from an earlier room in the run.
    ok: [200, 201, 400, 409, 413, 415, 429],
  },
  'GET /api/tour-rooms/[bookingId]/vehicle-photo': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/vehicle-photo`,
    headers: guestH,
    // 200 with `url: null` is the normal answer when ops has attached no photo —
    // the pair still has to be DRIVEN to know the signed-URL path does not throw.
    ok: [200, 404],
  },
  'POST /api/tour-rooms/[bookingId]/vision-ask': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/vision-ask`,
    headers: guestH,
    form: () => {
      const fd = new FormData();
      fd.append('image', new Blob([tinyPng()], { type: 'image/png' }), 'shot.png');
      fd.append('question', SENTENCE);
      return fd;
    },
    ok: [200, 201, 400, 413, 415, 429],
  },

  // ── companions ────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/companion-invite': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/companion-invite`,
    headers: guestH,
    ok: [200, 403, 404],
  },
  'POST /api/tour-rooms/[bookingId]/companion-invite': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/companion-invite`,
    headers: guestH,
    body: () => ({}),
    ok: [200, 201, 403],
  },
  'POST /api/tour-rooms/[bookingId]/companion-invite/redeem': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/companion-invite/redeem`,
    headers: guestH,
    body: () => ({ code: 'K4SIMCODE', deviceKey: randomUUID() }),
    ok: [200, 201, 400, 403, 404, 410],
  },

  // ── after the tour ────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/timeline-coupon': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/timeline-coupon`,
    headers: guestH,
    body: () => ({}),
    ok: [200, 201, 400, 403, 409],
  },

  // ── device ────────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/push-subscribe': {
    path: (c) => `/api/tour-rooms/${c.room.bookingId}/push-subscribe`,
    headers: guestH,
    body: () => ({
      subscription: {
        endpoint: `https://example.invalid/k4/${randomUUID()}`,
        keys: { p256dh: 'BFakeKeyForSimulationOnly', auth: 'ZmFrZQ' },
      },
    }),
    ok: [200, 201, 204, 400],
  },

  // ── operator ──────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/broadcast': {
    path: () => '/api/tour-rooms/broadcast',
    headers: () => ({}),
    body: (c) => ({
      tourId: c.room.tourId,
      tourDate: fixtures.tourDate,
      text: '[K4 SIM] departing in 10 minutes',
      token: c.guideToken,
    }),
    ok: [200, 201, 403, 429],
  },
  'GET /api/tour-mode/guide/overview': {
    path: (c) => `/api/tour-mode/guide/overview?rt=${encodeURIComponent(c.guideToken)}`,
    headers: () => ({}),
    ok: [200, 403],
  },
  'GET /api/tour-mode/driver/overview': {
    path: (c) => `/api/tour-mode/driver/overview?rt=${encodeURIComponent(c.driverToken)}`,
    headers: () => ({}),
    ok: [200, 403],
  },
  'POST /api/tour-mode/driver/link': {
    path: () => '/api/tour-mode/driver/link',
    headers: () => ({}),
    body: (c) => ({ tourId: c.room.tourId, tourDate: fixtures.tourDate, token: c.guideToken }),
    ok: [200, 201, 401, 403],
  },
  'GET /api/tour-mode/bookings': {
    path: () => `/api/tour-mode/bookings?date=${fixtures.tourDate}`,
    headers: () => ({}),
    ok: [200, 401, 403],
  },
  'GET /api/tour-mode/booking/[id]/content': {
    path: (c) => `/api/tour-mode/booking/${c.room.bookingId}/content`,
    headers: guestH,
    ok: [200, 401, 403, 404],
  },
  'GET /api/tour-mode/room/[bookingId]/snapshot': {
    path: (c) => `/api/tour-mode/room/${c.room.bookingId}/snapshot`,
    headers: guestH,
    ok: [200, 401, 403],
  },
};

/** 44-byte silent WAV header + no samples. Smallest thing STT will accept. */
function silentWav(): Uint8Array {
  const bytes = new Uint8Array(44 + 1600);
  const view = new DataView(bytes.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + 1600, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, 1600, true);
  return bytes;
}

/** 1×1 transparent PNG. */
function tinyPng(): Uint8Array {
  return Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
    (ch) => ch.charCodeAt(0),
  );
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

async function drive(row: K4LedgerRow): Promise<void> {
  const k = key(row);
  if (row.skip) {
    results.push({
      key: k,
      room: null,
      tier: row.tier,
      actor: row.actor,
      status: '—',
      verdict: 'SKIP',
      detail: row.skip,
      ms: 0,
    });
    return;
  }
  if (k === 'POST /api/tour-rooms/[bookingId]/join') return; // handled by joinAll

  const spec = SPECS[k];
  if (!spec) {
    /**
     * 🔴 The most important branch in this file. A declared pair with no
     * request spec has NOT been covered, and the run must say so out loud
     * rather than omitting the row.
     */
    results.push({
      key: k,
      room: row.room,
      tier: row.tier,
      actor: row.actor,
      status: '—',
      verdict: 'UNWRITTEN',
      detail: 'declared in the ledger but this harness has no request for it',
      ms: 0,
    });
    return;
  }

  if (FREE_ONLY && row.tier !== 'free') {
    results.push({
      key: k,
      room: row.room,
      tier: row.tier,
      actor: row.actor,
      status: '—',
      verdict: 'SKIP',
      detail: '--free: model-tier pair not attempted this run',
      ms: 0,
    });
    return;
  }

  // Prefer the assigned room; fall back to any joined room of the right kind.
  const wanted = row.room ?? 1;
  let room = state.get(wanted);
  if (spec.needsPrivate && room?.kind !== 'private') {
    room = [...state.values()].find((r) => r.kind === 'private') ?? room;
  }
  if (!room) {
    results.push({
      key: k,
      room: row.room,
      tier: row.tier,
      actor: row.actor,
      status: '—',
      verdict: 'FAIL',
      detail: `assigned room ${wanted} never joined`,
      ms: 0,
    });
    return;
  }

  if (spec.needsMessage) await ensureMessage(room);
  const staff = fixtures.staffTokens[room.tourId] ?? { guide: '', driver: '' };
  const ctx: Ctx = {
    room,
    guide: await staffSessionFor(room, 'guide'),
    driver: await staffSessionFor(room, 'driver'),
    guideToken: staff.guide,
    driverToken: staff.driver,
    H: { 'x-tour-room-auth': room.session },
  };
  const method = k.split(' ')[0];
  const started = Date.now();

  // Route-level rate limits are real; pace the sweep so a 429 does not get
  // recorded as a contract failure.
  await sleep(350);

  try {
    const form = spec.form?.(ctx);
    const jsonBody = form ? undefined : spec.body?.(ctx);
    const res = await fetch(BASE + spec.path(ctx), {
      method,
      headers: {
        ...(jsonBody !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(spec.headers?.(ctx) ?? {}),
      },
      body: form ?? (jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined),
    });
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* non-JSON (tts audio) is fine */
    }
    if (res.ok || spec.ok.includes(res.status)) spec.after?.(parsed, ctx);
    results.push({
      key: k,
      room: room.room,
      tier: row.tier,
      actor: row.actor,
      status: res.status,
      verdict: spec.ok.includes(res.status) ? 'PASS' : 'FAIL',
      detail: spec.ok.includes(res.status) ? '' : short(parsed),
      ms: Date.now() - started,
    });
  } catch (e) {
    results.push({
      key: k,
      room: room.room,
      tier: row.tier,
      actor: row.actor,
      status: 'ERR',
      verdict: 'FAIL',
      detail: String(e),
      ms: Date.now() - started,
    });
  }
}

// ---------------------------------------------------------------------------
// Report (Phase 4)
// ---------------------------------------------------------------------------

function report(rows: K4LedgerRow[]): number {
  const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
  const order: Record<Verdict, number> = { FAIL: 0, UNWRITTEN: 1, SKIP: 2, PASS: 3 };
  const sorted = [...results].sort(
    (a, b) => order[a.verdict] - order[b.verdict] || a.key.localeCompare(b.key),
  );

  console.log(`\n=== K4v2 coverage run — ${BASE}${FREE_ONLY ? ' (--free)' : ''} ===`);
  console.log(`${fixtures.rooms.length} rooms · ledger ${rows.length} pairs\n`);
  console.log(`${pad('VERDICT', 10)}${pad('ROOM', 6)}${pad('TIER', 7)}${pad('STATUS', 8)}KEY`);
  for (const r of sorted) {
    console.log(
      `${pad(r.verdict, 10)}${pad(r.room === 0 ? 'all' : String(r.room ?? '—'), 6)}${pad(r.tier, 7)}${pad(
        String(r.status),
        8,
      )}${r.key}${r.detail ? `\n${' '.repeat(31)}${r.detail}` : ''}`,
    );
  }

  const counts = (v: Verdict) => results.filter((r) => r.verdict === v).length;
  const ledger = summarize(rows);
  console.log(`\n--- totals ---`);
  console.log(`ledger pairs          ${ledger.total}  (covered ${ledger.covered} · declared-skip ${ledger.skipped})`);
  console.log(`PASS                  ${counts('PASS')}`);
  console.log(`FAIL                  ${counts('FAIL')}`);
  console.log(`SKIP                  ${counts('SKIP')}`);
  console.log(`UNWRITTEN             ${counts('UNWRITTEN')}   <- declared but this harness never calls it`);

  const skipped = results.filter((r) => r.verdict === 'SKIP');
  if (skipped.length) {
    console.log(`\n--- not run, and why (a skip is a result) ---`);
    for (const r of skipped) console.log(`  ${r.key}\n    ${r.detail}`);
  }

  /**
   * 🔴 Printed on EVERY run, pass or fail. Route coverage is not load coverage,
   * and a reader who sees "100%" without this section will conclude the app has
   * been load-tested. It has not.
   */
  console.log(`\n--- K4_NOT_MEASURED — true even when every row above is PASS ---`);
  for (const item of K4_NOT_MEASURED) console.log(`  ${item.what}\n    ${item.why}`);

  const bad = counts('FAIL') + counts('UNWRITTEN');
  console.log(
    bad === 0
      ? `\nOK — every covered pair answered inside its contract.`
      : `\nFAILED — ${counts('FAIL')} failing, ${counts('UNWRITTEN')} unwritten.`,
  );
  return bad === 0 ? 0 : 1;
}

async function main(): Promise<void> {
  const pairs = collectK4Pairs(process.cwd());
  const rows = buildLedger(pairs, K4_ROOMS);

  await joinAll();
  if (state.size === 0) {
    console.error(`no room joined — is a server running at ${BASE}?`);
    process.exit(2);
  }
  for (const row of rows) await drive(row);
  process.exit(report(rows));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
