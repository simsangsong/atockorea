/**
 * K4v2 coverage ledger — what a 20-room full-feature run must cover, and what
 * it deliberately will not.
 *
 * The owner's decision changed K4 from "100 rooms of chat load" into "20 rooms,
 * every feature at least once, and **print what you did not run**". That last
 * clause is the whole ticket: a green run that stays silent about its gaps
 * reads as "everything works", and this repo has already been bitten by a
 * harness reporting success over untested ground (five POST-only routes were
 * being called with GET and passing because 404 was in the expected set).
 *
 * So the ledger is built in two halves, on purpose:
 *
 *   DISCOVERED   — every `(method, path)` pair under `app/api/tour-rooms/**`
 *                  and `app/api/tour-mode/**`, parsed from source. Automatic,
 *                  so a new route cannot be missing from the ledger.
 *   DECLARED     — actor, cost tier, and skip reason for each pair. Written by
 *                  hand, because none of those three can be inferred from a
 *                  route file without guessing.
 *
 * The gate is the join: **every discovered pair must have a declaration.** A new
 * route therefore fails the build until somebody decides who calls it, what it
 * costs, and whether the run should hit it. That is the only arrangement where
 * "we covered everything" survives the next person adding an endpoint.
 */

/** Cost of hitting a pair once, which is what decides whether a run may. */
export type K4Tier =
  /** Pure DB/CPU. Free to hammer. */
  | 'free'
  /** Spends real model tokens (translation, vision, concierge, TTS, STT). */
  | 'llm'
  /** Reaches a human being — pager, admin email, ops push. */
  | 'people';

export type K4Actor = 'guest' | 'guide' | 'driver' | 'admin' | 'public';

export interface K4Declaration {
  actor: K4Actor;
  tier: K4Tier;
  /**
   * Present ⇒ the run does NOT call this pair, and the reason is printed in the
   * coverage table. Absent ⇒ the run is expected to call it.
   *
   * 🔴 A skip is a result, not an omission. The failure this guards against is
   * a run that quietly never touched `POST /sos` and reported "all green".
   */
  skip?: string;
}

export interface K4Pair {
  method: string;
  /** API path with dynamic segments left as `[bookingId]` etc. */
  path: string;
  /** Repo-relative route file, so a reader can go look. */
  file: string;
}

export interface K4LedgerRow extends K4Pair, K4Declaration {
  /** 1..N — which simulated room exercises this pair. Null when skipped. */
  room: number | null;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Owner's decision: 20 rooms, private/join mixed to match the live split. */
export const K4_ROOMS = 20;

/** The two trees a tour-room run is allowed to touch. */
export const K4_ROUTE_ROOTS = ['app/api/tour-rooms', 'app/api/tour-mode'] as const;

/**
 * Route handler exports in one file.
 *
 * Matches both `export async function POST` and `export function POST`, and
 * the `export const POST = ...` form. Comments are stripped first: a route that
 * documents "this used to have a DELETE" must not be counted as having one.
 */
export function parseRouteMethods(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const found = new Set<string>();
  for (const method of HTTP_METHODS) {
    const fn = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
    const constFn = new RegExp(`export\\s+const\\s+${method}\\s*[:=]`);
    if (fn.test(code) || constFn.test(code)) found.add(method);
  }
  return HTTP_METHODS.filter((m) => found.has(m));
}

/** `app/api/tour-rooms/[bookingId]/join/route.ts` → `/api/tour-rooms/[bookingId]/join` */
export function routePathFromFile(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  const at = normalized.indexOf('app/api/');
  const rel = at === -1 ? normalized : normalized.slice(at + 'app/'.length);
  return `/${rel.replace(/\/route\.tsx?$/, '')}`;
}

/**
 * Walk the two route trees and return every `(method, path)` pair.
 *
 * Node-only (`fs`) — imported by the generator script and the audit test, never
 * by app code. Kept in this module rather than the script so the test measures
 * the same tree the generator writes.
 */
export function collectK4Pairs(root: string): K4Pair[] {
  // Lazy require keeps this module importable from a browser-ish context; only
  // the two Node callers ever reach this line.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');

  const pairs: K4Pair[] = [];
  const walk = (dir: string) => {
    let entries: import('node:fs').Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/^route\.tsx?$/.test(entry.name)) {
        const rel = path.relative(root, full).replace(/\\/g, '/');
        const source = fs.readFileSync(full, 'utf8');
        for (const method of parseRouteMethods(source)) {
          pairs.push({ method, path: routePathFromFile(rel), file: rel });
        }
      }
    }
  };
  for (const treeRoot of K4_ROUTE_ROOTS) walk(path.join(root, treeRoot));
  return pairs;
}

/**
 * 🔴 The declared half of the ledger.
 *
 * Keys are `METHOD /path`. Everything discovered must appear here; the gate
 * enforces it in both directions, because a stale entry is as misleading as a
 * missing one (it claims coverage of a route that no longer exists).
 */
export const K4_DECLARATIONS: Record<string, K4Declaration> = {
  // ── the door ───────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/join': { actor: 'guest', tier: 'free' },

  // ── chat core ──────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/messages': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/messages': { actor: 'guest', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/messages/[messageId]/retranslate': {
    actor: 'guest',
    tier: 'llm',
  },
  'GET /api/tour-rooms/[bookingId]/reactions': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/reactions': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/read': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/typing': { actor: 'guest', tier: 'free' },
  'GET /api/tour-rooms/[bookingId]/media': { actor: 'guest', tier: 'free' },

  // ── voice / audio ──────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/tts': { actor: 'guest', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/stt': { actor: 'guest', tier: 'llm' },
  /**
   * 🔴 Fourth actor correction, and the one that was HIDDEN: with an empty body
   * this route answered 400 (input validation) long before it checked who was
   * asking. Supplying real input moved the answer to 403 "Only the guide can
   * broadcast captions". A validation error can mask an authorization contract.
   */
  'POST /api/tour-rooms/[bookingId]/captions': { actor: 'guide', tier: 'llm' },

  // ── the day ────────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/tour-itinerary': { actor: 'guest', tier: 'free' },
  /**
   * 🔴 Corrected by the Phase 3 run, not by reading: declared `guest`, answered
   * 403 "Guide, driver, or admin only". The ledger's hand-written half says an
   * actor "cannot be inferred from a route file without guessing" — this is what
   * a wrong guess looks like, and driving the route is what found it.
   */
  'GET /api/tour-rooms/[bookingId]/day-summary': { actor: 'guide', tier: 'free' },
  /** Staff-only — third actor correction the Phase 3 run forced (see day-summary). */
  'POST /api/tour-rooms/[bookingId]/morning-briefing': { actor: 'guide', tier: 'llm' },
  'GET /api/tour-rooms/[bookingId]/vehicle-eta': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/approach': { actor: 'guest', tier: 'free' },
  'GET /api/tour-rooms/[bookingId]/events': { actor: 'guest', tier: 'free' },
  'GET /api/tour-rooms/[bookingId]/my-seat': { actor: 'guest', tier: 'free' },

  // ── arrival + content ──────────────────────────────────────────────────────
  /** Staff-only too — same correction, same cause (see day-summary above). */
  'GET /api/tour-rooms/[bookingId]/arrival-bundle': { actor: 'guide', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/arrival-bundle': { actor: 'guide', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/manual-arrival': { actor: 'guide', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/spot-events': { actor: 'guest', tier: 'free' },

  // ── food ───────────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/dining': { actor: 'guest', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/dining/feedback': { actor: 'guest', tier: 'free' },
  'GET /api/tour-rooms/[bookingId]/dietary': { actor: 'guest', tier: 'free' },
  'PUT /api/tour-rooms/[bookingId]/dietary': { actor: 'guest', tier: 'free' },

  // ── planner ────────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/plan': { actor: 'guest', tier: 'free' },
  'PUT /api/tour-rooms/[bookingId]/plan': { actor: 'guest', tier: 'free' },
  'GET /api/tour-rooms/[bookingId]/plan/templates': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/plan/claim-lead': { actor: 'guest', tier: 'free' },

  // ── ledger + money ─────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/extras': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/extras': { actor: 'guide', tier: 'free' },
  'PATCH /api/tour-rooms/[bookingId]/extras': { actor: 'guide', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/extend': { actor: 'guide', tier: 'free' },

  // ── signals + location ─────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/signals': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/location': { actor: 'guest', tier: 'free' },
  'DELETE /api/tour-rooms/[bookingId]/location': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/driver-signal': { actor: 'driver', tier: 'free' },
  // SG-4d — meeting-point photo capture (staff camera → public bucket → review queue).
  'POST /api/tour-rooms/[bookingId]/meeting-photo': { actor: 'driver', tier: 'free' },

  // ── AI surfaces ────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/concierge': { actor: 'guest', tier: 'llm' },
  'POST /api/tour-rooms/[bookingId]/vision-ask': { actor: 'guest', tier: 'llm' },

  // ── companions ─────────────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/companion-invite': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/companion-invite': { actor: 'guest', tier: 'free' },
  'POST /api/tour-rooms/[bookingId]/companion-invite/redeem': { actor: 'guest', tier: 'free' },

  // ── after the tour ─────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/timeline-coupon': { actor: 'guest', tier: 'free' },

  // ── device plumbing ────────────────────────────────────────────────────────
  'POST /api/tour-rooms/[bookingId]/push-subscribe': { actor: 'guest', tier: 'free' },

  // ── operator ───────────────────────────────────────────────────────────────
  'POST /api/tour-rooms/broadcast': { actor: 'guide', tier: 'llm' },
  'GET /api/tour-mode/guide/overview': { actor: 'guide', tier: 'free' },
  'GET /api/tour-mode/driver/overview': { actor: 'driver', tier: 'free' },
  'POST /api/tour-mode/driver/link': { actor: 'admin', tier: 'free' },
  'GET /api/tour-mode/bookings': { actor: 'admin', tier: 'free' },
  'GET /api/tour-mode/booking/[id]/content': { actor: 'guest', tier: 'free' },
  'GET /api/tour-mode/room/[bookingId]/snapshot': { actor: 'guest', tier: 'free' },

  // ── skipped by design ──────────────────────────────────────────────────────
  /**
   * 🔴 The only pair in the ledger that calls a living person: it emails the
   * admin address and fires an ops web push. The owner's instruction for this
   * autonomous run was explicit — do not ring it, print it as skipped with the
   * reason. Temporarily repointing an emergency path's recipients was rejected
   * as an option, because changing the configuration of the emergency path is
   * itself the risk it is meant to protect against.
   */
  'POST /api/tour-rooms/[bookingId]/sos': {
    actor: 'guest',
    tier: 'people',
    skip: 'SKIPPED BY DESIGN — rings a real on-call human (admin email + ops push). Run it only while the owner is watching.',
  },
};

/**
 * Deterministic room assignment: same ledger ⇒ same layout, every run.
 *
 * Not random, and not `Math.random()` — a coverage report you cannot reproduce
 * is a coverage report you cannot bisect. `join` is pinned to every room
 * because it is the door: each of the N rooms has to walk through it.
 */
export const K4_JOIN_PATH = 'POST /api/tour-rooms/[bookingId]/join';

export function assignRooms(pairs: readonly K4Pair[], rooms: number): Map<string, number | null> {
  const out = new Map<string, number | null>();
  let cursor = 0;
  for (const pair of [...pairs].sort((a, b) => key(a).localeCompare(key(b)))) {
    const k = key(pair);
    const declaration = K4_DECLARATIONS[k];
    if (declaration?.skip) {
      out.set(k, null);
      continue;
    }
    if (k === K4_JOIN_PATH) {
      out.set(k, 0); // 0 = every room
      continue;
    }
    out.set(k, (cursor++ % rooms) + 1);
  }
  return out;
}

export function key(pair: { method: string; path: string }): string {
  return `${pair.method} ${pair.path}`;
}

/** Join the discovered pairs with their declarations. Throws on any gap. */
export function buildLedger(pairs: readonly K4Pair[], rooms = 20): K4LedgerRow[] {
  const assignment = assignRooms(pairs, rooms);
  return [...pairs]
    .sort((a, b) => key(a).localeCompare(key(b)))
    .map((pair) => {
      const k = key(pair);
      const declaration = K4_DECLARATIONS[k];
      if (!declaration) {
        throw new Error(
          `K4 ledger has no declaration for "${k}". Add it to K4_DECLARATIONS with an actor, ` +
            `a cost tier, and a skip reason if the run must not call it.`,
        );
      }
      return { ...pair, ...declaration, room: assignment.get(k) ?? null };
    });
}

export interface K4Summary {
  total: number;
  covered: number;
  skipped: number;
  byTier: Record<K4Tier, number>;
  byActor: Record<K4Actor, number>;
}

export function summarize(rows: readonly K4LedgerRow[]): K4Summary {
  const byTier = { free: 0, llm: 0, people: 0 } as Record<K4Tier, number>;
  const byActor = { guest: 0, guide: 0, driver: 0, admin: 0, public: 0 } as Record<K4Actor, number>;
  let skipped = 0;
  for (const row of rows) {
    byTier[row.tier] += 1;
    byActor[row.actor] += 1;
    if (row.skip) skipped += 1;
  }
  return { total: rows.length, covered: rows.length - skipped, skipped, byTier, byActor };
}

/**
 * What the run did NOT measure — printed alongside the table, always.
 *
 * These are not endpoints, so they can never appear as a skipped row, which is
 * exactly why they need writing down: a reader looking at 100% route coverage
 * would otherwise conclude the app had been load-tested. It has not.
 */
export const K4_NOT_MEASURED: ReadonlyArray<{ what: string; why: string }> = [
  {
    what: 'Concurrent realtime connections (§K-2 wall #1)',
    why: 'A sequential HTTP run opens one socket at a time. The ceiling is a property of simultaneous subscribers, and its actual value is still unknown (K2 needs the Supabase console).',
  },
  {
    what: 'SSE fallback amplification (§K-3)',
    why: 'The dangerous shape is every client degrading to SSE at once and converting one capacity limit into unbounded function-hours and DB reads. Reproducing it needs induced realtime failure under concurrency, not a route sweep.',
  },
  {
    what: 'Translation provider rate limits (§K-2 wall #4)',
    why: 'The run reuses a small sentence corpus so the translation cache absorbs it — deliberately, to keep the bill down. That means it also never approaches the provider ceiling.',
  },
  {
    what: 'Cold-start latency',
    why: 'A back-to-back sweep keeps functions warm. Real guests arrive spread across a morning and pay cold starts the harness never sees.',
  },
];

/** Markdown ledger. Generated, never hand-edited — see the stale gate. */
export function renderLedgerMarkdown(rows: readonly K4LedgerRow[], rooms = 20): string {
  const s = summarize(rows);
  const lines: string[] = [];
  lines.push('# K4-coverage — 20방 전 기능 커버리지 원장');
  lines.push('');
  lines.push('> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 —');
  lines.push('> `lib/audit/k4Coverage.ts` 를 고치고 `npx tsx scripts/gen-k4-coverage.ts` 를 돌린다.');
  lines.push('> `__tests__/audit/k4Coverage.test.ts` 가 이 파일과 소스가 어긋나면 실패한다.');
  lines.push('');
  lines.push('## 왜 원장이 먼저인가');
  lines.push('');
  lines.push('사장님 결정으로 K4 는 "100방 채팅 부하"에서 **"20방 × 전 기능, 그리고 안 돌린 것을 출력"**');
  lines.push('으로 바뀌었다. 마지막 절이 이 티켓의 본체다 — **공백을 말하지 않는 초록은 "다 된다"로 읽힌다.**');
  lines.push('실제로 이 레포의 프로덕션 하니스가 그랬다: POST 전용 라우트 5개를 GET 으로 치고 있었고,');
  lines.push('기대 코드에 404 가 들어 있어서 **여섯 건이 가짜로 통과**했다.');
  lines.push('');
  lines.push('원장이 **먼저** 착지하는 이유도 같다. 원장이 틀리면 그 아래 배정·주행·보고가 전부 틀리는데,');
  lines.push('원장을 제대로 만드는 데에는 **네트워크도 비용도 들지 않는다.**');
  lines.push('');
  lines.push('## 수치');
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| (메서드, 경로) 쌍 | **${s.total}** |`);
  lines.push(`| 주행 대상 | ${s.covered} |`);
  lines.push(`| 설계상 건너뜀 | ${s.skipped} |`);
  lines.push(`| 방 개수 | ${rooms} |`);
  lines.push(`| 비용 등급 | free ${s.byTier.free} · llm ${s.byTier.llm} · people ${s.byTier.people} |`);
  lines.push(
    `| 행위자 | guest ${s.byActor.guest} · guide ${s.byActor.guide} · driver ${s.byActor.driver} · admin ${s.byActor.admin} |`,
  );
  lines.push('');
  lines.push('`room 0` = **모든 방**이 지난다(문이므로). `room —` = 건너뜀.');
  lines.push('');
  lines.push('## 원장');
  lines.push('');
  lines.push('| 메서드 | 경로 | 행위자 | 비용 | 방 | 건너뛴 사유 |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of rows) {
    const room = row.skip ? '—' : row.room === 0 ? '전부' : String(row.room);
    lines.push(
      `| \`${row.method}\` | \`${row.path}\` | ${row.actor} | ${row.tier} | ${room} | ${row.skip ?? ''} |`,
    );
  }
  lines.push('');
  lines.push('## 🔴 이 주행이 재지 않는 것');
  lines.push('');
  lines.push('라우트 커버리지 100% 를 보고 "부하 테스트를 통과했다"고 읽지 않도록, 아래를 표와 **항상 같이**');
  lines.push('출력한다. 이것들은 엔드포인트가 아니라서 건너뜀 행으로도 나타날 수 없다 —');
  lines.push('그래서 적어 두지 않으면 영영 안 보인다.');
  lines.push('');
  lines.push('| 안 잰 것 | 왜 |');
  lines.push('|---|---|');
  for (const item of K4_NOT_MEASURED) {
    lines.push(`| ${item.what} | ${item.why} |`);
  }
  lines.push('');
  return lines.join('\n');
}
