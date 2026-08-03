/**
 * Feature journey ledger — which stage of a guest's trip does each endpoint serve?
 *
 * `k4Coverage.ts` already answers "who calls this" (actor) and "what does it
 * cost" (tier), and its join gate makes a new route fail the build until
 * somebody declares both. What it cannot answer is the question the owner
 * actually asks about the app: **can a person get all the way through?**
 *
 * A role with a hole in the middle of its journey is invisible to every check
 * this repo has. Coverage was 100% and the seat picker had still never been
 * opened in production — because "every route is exercised" and "every stage of
 * the trip works" are different claims, and only the first one was being made.
 *
 * So this adds one axis: the five stages a tour actually moves through. Crossed
 * with the three smart-app roles that gives fifteen cells, and an EMPTY cell is
 * the finding. Not automatically a defect — a driver has nothing to do the day
 * after a tour — but it must be a decision somebody wrote down, never a gap
 * nobody noticed. Same discipline as `skip` in the K4 ledger: silence has to be
 * declared out loud.
 *
 * Stage assignment is hand-written for the same reason actor is: it cannot be
 * inferred from a route file. Two were guessed wrong on the first pass and
 * corrected by reading the routes — `tour-itinerary` says "served to the D-1
 * planner" and `day-summary` says "operator end-of-day summary", so neither
 * belongs in `during` where its neighbours sit.
 */
import { K4_DECLARATIONS, type K4Actor } from './k4Coverage';

/** The five stages a tour moves through, in order. */
export type JourneyStage =
  /** Booked, before the day-before planning opens. Invites, the door, the room. */
  | 'booked'
  /** D-1. The planner, needs, seats — everything that closes at 00:00 KST. */
  | 'dayBefore'
  /** Tour-day morning, up to and including pickup. */
  | 'morning'
  /** The tour itself. */
  | 'during'
  /** After it ends. */
  | 'after';

export const JOURNEY_STAGES: readonly JourneyStage[] = [
  'booked',
  'dayBefore',
  'morning',
  'during',
  'after',
] as const;

/** The smart app's own roles. `admin`/`public` belong to ops and the marketing site. */
export const SMART_APP_ROLES: readonly K4Actor[] = ['guest', 'guide', 'driver'] as const;

/**
 * Every key here must exist in `K4_DECLARATIONS`, and vice versa. The test
 * enforces both directions, so adding a route forces a stage decision the same
 * way it already forces an actor and a tier.
 */
export const FEATURE_STAGES: Record<string, JourneyStage> = {
  // ── booked: the door, the room, and who else is coming ─────────────────────
  'POST /api/tour-rooms/[bookingId]/join': 'booked',
  'GET /api/tour-rooms/[bookingId]/companion-invite': 'booked',
  'POST /api/tour-rooms/[bookingId]/companion-invite': 'booked',
  'POST /api/tour-rooms/[bookingId]/companion-invite/redeem': 'booked',
  'GET /api/tour-mode/bookings': 'booked',
  'GET /api/tour-mode/room/[bookingId]/snapshot': 'booked',

  // ── dayBefore: everything C-11 closes at 00:00 KST on the day ──────────────
  /** Route header: "served to the D-1 planner". Not a during-tour read. */
  'GET /api/tour-rooms/[bookingId]/tour-itinerary': 'dayBefore',
  'GET /api/tour-rooms/[bookingId]/plan': 'dayBefore',
  'PUT /api/tour-rooms/[bookingId]/plan': 'dayBefore',
  'GET /api/tour-rooms/[bookingId]/plan/templates': 'dayBefore',
  'POST /api/tour-rooms/[bookingId]/plan/claim-lead': 'dayBefore',
  'GET /api/tour-rooms/[bookingId]/dietary': 'dayBefore',
  'PUT /api/tour-rooms/[bookingId]/dietary': 'dayBefore',
  'POST /api/tour-rooms/[bookingId]/push-subscribe': 'dayBefore',
  /** Guest seat writes close at 00:00 KST on the tour day, so this is a D-1 act. */
  'GET /api/tour-rooms/[bookingId]/my-seat': 'dayBefore',
  'GET /api/tour-mode/booking/[id]/content': 'dayBefore',
  /** The guide mints the driver's link ahead of the day. */
  'POST /api/tour-mode/driver/link': 'dayBefore',

  // ── morning: waking up, finding the vehicle, meeting ───────────────────────
  'POST /api/tour-rooms/[bookingId]/morning-briefing': 'morning',
  'GET /api/tour-rooms/[bookingId]/vehicle-eta': 'morning',
  'GET /api/tour-rooms/[bookingId]/vehicle-photo': 'morning',
  'POST /api/tour-rooms/[bookingId]/meeting-photo': 'morning',
  'GET /api/tour-mode/driver/overview': 'morning',
  'GET /api/tour-mode/guide/overview': 'morning',

  // ── during: the tour ───────────────────────────────────────────────────────
  'GET /api/tour-rooms/[bookingId]/messages': 'during',
  'POST /api/tour-rooms/[bookingId]/messages': 'during',
  'POST /api/tour-rooms/[bookingId]/messages/[messageId]/retranslate': 'during',
  'GET /api/tour-rooms/[bookingId]/reactions': 'during',
  'POST /api/tour-rooms/[bookingId]/reactions': 'during',
  'POST /api/tour-rooms/[bookingId]/read': 'during',
  'POST /api/tour-rooms/[bookingId]/typing': 'during',
  'GET /api/tour-rooms/[bookingId]/media': 'during',
  'GET /api/tour-rooms/[bookingId]/tts': 'during',
  'POST /api/tour-rooms/[bookingId]/stt': 'during',
  'POST /api/tour-rooms/[bookingId]/captions': 'during',
  'GET /api/tour-rooms/[bookingId]/region-scripts': 'during',
  'POST /api/tour-rooms/[bookingId]/approach': 'during',
  'GET /api/tour-rooms/[bookingId]/events': 'during',
  'GET /api/tour-rooms/[bookingId]/arrival-bundle': 'during',
  'POST /api/tour-rooms/[bookingId]/arrival-bundle': 'during',
  'POST /api/tour-rooms/[bookingId]/manual-arrival': 'during',
  'POST /api/tour-rooms/[bookingId]/spot-events': 'during',
  'POST /api/tour-rooms/[bookingId]/dining': 'during',
  'POST /api/tour-rooms/[bookingId]/dining/feedback': 'during',
  'GET /api/tour-rooms/[bookingId]/extras': 'during',
  'POST /api/tour-rooms/[bookingId]/extras': 'during',
  'PATCH /api/tour-rooms/[bookingId]/extras': 'during',
  'POST /api/tour-rooms/[bookingId]/extend': 'during',
  'POST /api/tour-rooms/[bookingId]/signals': 'during',
  'POST /api/tour-rooms/[bookingId]/location': 'during',
  'DELETE /api/tour-rooms/[bookingId]/location': 'during',
  'POST /api/tour-rooms/[bookingId]/driver-signal': 'during',
  'POST /api/tour-rooms/[bookingId]/concierge': 'during',
  'POST /api/tour-rooms/[bookingId]/vision-ask': 'during',
  'POST /api/tour-rooms/[bookingId]/sos': 'during',
  'POST /api/tour-rooms/broadcast': 'during',

  // ── after ──────────────────────────────────────────────────────────────────
  /** Route header: "operator end-of-day summary". */
  'GET /api/tour-rooms/[bookingId]/day-summary': 'after',
  'POST /api/tour-rooms/[bookingId]/timeline-coupon': 'after',
};

export interface JourneyCell {
  role: K4Actor;
  stage: JourneyStage;
  /** Declaration keys sitting in this cell. */
  pairs: string[];
}

/** The role × stage grid, built from the two hand-written tables. */
export function buildJourneyMatrix(): JourneyCell[] {
  const cells: JourneyCell[] = [];
  for (const role of SMART_APP_ROLES) {
    for (const stage of JOURNEY_STAGES) {
      const pairs = Object.keys(FEATURE_STAGES).filter(
        (key) => K4_DECLARATIONS[key]?.actor === role && FEATURE_STAGES[key] === stage,
      );
      cells.push({ role, stage, pairs });
    }
  }
  return cells;
}

/**
 * Cells that carry no endpoint, and why that is a decision rather than a hole.
 *
 * 🔴 Two of these four are recorded as findings, not as settled answers. They
 * are written here so the grid can be green without the question disappearing —
 * an undeclared empty cell fails the gate, and a declared one keeps its reason
 * in the repo where the next person will read it.
 */
export const DECLARED_EMPTY: Record<string, string> = {
  'guide/booked':
    'Assignment happens in the ops console, not the smart app. A guide has no ' +
    'endpoint here because they do not yet know the tour is theirs.',
  'driver/booked':
    'Same as the guide, and more so: the driver is picked last and holds no ' +
    'link until the guide mints one.',
  /**
   * 🔴 The first version of this reason was wrong, and F4 caught it by reading
   * the route instead of the ticket: it claimed the driver "has nothing to open
   * until the morning". Not so — /driver/overview scopes to the TOKEN's
   * tourDate, not to today, so a driver opening the link the day before gets
   * that date with `lifecycle: 'lobby'`. They can look ahead already.
   */
  'driver/dayBefore':
    'Covered by GET /api/tour-mode/driver/overview, which the grid files under ' +
    'morning because that is when it is mostly read. It scopes to the token\'s ' +
    'tourDate rather than today, so the same link answers the day before. The ' +
    'acknowledgement gap is closed too (F7): joining already wrote a driver row ' +
    'in tour_room_participants and /guide/overview already sent it — the guide ' +
    'console declared the field and never read it, so the answer arrived on ' +
    'every poll and was dropped. It now shows 기사 미확인 until the driver opens ' +
    'the link. Engine present, consumer absent; the consumer is here now.',
  'driver/after':
    'Closed by found_item (feature audit F4), which rides driver-signal and so ' +
    'is filed under during. The driver taps it while cleaning the van; the ' +
    'route has no lifecycle gate, so it works after the tour, and it reaches ' +
    'both the guests and the ops desk that actually stores the item. Before ' +
    'that the guest could report a LOST item and the person holding it could ' +
    'not report a FOUND one — the signals route answers a driver 403 "Drivers ' +
    'use driver-signal", and driver-signal had no such type.',
};

export function cellKey(role: K4Actor, stage: JourneyStage): string {
  return `${role}/${stage}`;
}

const STAGE_LABEL: Record<JourneyStage, string> = {
  booked: '예약 직후',
  dayBefore: 'D-1 전날',
  morning: '당일 아침',
  during: '투어 중',
  after: '종료 후',
};

/** The owner-readable grid. Generated — see scripts/gen-feature-journey.ts. */
export function renderJourneyMarkdown(): string {
  const matrix = buildJourneyMatrix();
  const at = (role: K4Actor, stage: JourneyStage) =>
    matrix.find((c) => c.role === role && c.stage === stage)!;

  const lines: string[] = [
    '# feature-journey — 역할 × 여정 격자',
    '',
    '> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 —',
    '> `lib/audit/featureJourney.ts` 를 고치고 `npx tsx scripts/gen-feature-journey.ts` 를 돌린다.',
    '> `__tests__/audit/featureJourney.test.ts` 가 소스와 어긋나면 실패한다.',
    '',
    '커버리지("모든 라우트를 한 번씩 쳤다")와 완주("사람이 끝까지 갔다")는 다른 주장이고,',
    '지금까지 이 레포는 앞의 것만 하고 있었다. 이 격자는 뒤의 것을 묻는다.',
    '**빈 칸은 그 자체로 발견**이다 — 결함이라는 뜻은 아니지만, 누군가 적어 둔 결정이어야 한다.',
    '',
    '## 격자 (엔드포인트 수)',
    '',
    `| 역할 | ${JOURNEY_STAGES.map((s) => STAGE_LABEL[s]).join(' | ')} |`,
    `|---|${JOURNEY_STAGES.map(() => '---').join('|')}|`,
  ];

  for (const role of SMART_APP_ROLES) {
    const cells = JOURNEY_STAGES.map((stage) => {
      const n = at(role, stage).pairs.length;
      return n === 0 ? '**— 없음**' : String(n);
    });
    lines.push(`| **${role}** | ${cells.join(' | ')} |`);
  }

  lines.push('', '## 빈 칸과 그 사유', '');
  const empties = matrix.filter((c) => c.pairs.length === 0);
  if (empties.length === 0) {
    lines.push('없음 — 15칸 전부 엔드포인트를 가진다.');
  } else {
    for (const cell of empties) {
      const key = cellKey(cell.role, cell.stage);
      lines.push(`### ${cell.role} × ${STAGE_LABEL[cell.stage]}`, '', DECLARED_EMPTY[key] ?? '🔴 사유 미선언', '');
    }
  }

  lines.push('## 칸별 엔드포인트', '');
  for (const role of SMART_APP_ROLES) {
    for (const stage of JOURNEY_STAGES) {
      const cell = at(role, stage);
      if (cell.pairs.length === 0) continue;
      lines.push(`**${role} · ${STAGE_LABEL[stage]}** (${cell.pairs.length})`, '');
      for (const pair of cell.pairs) lines.push(`- \`${pair}\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}
