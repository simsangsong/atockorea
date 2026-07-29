/**
 * 프로덕션 압력테스트 — 손님 룸 / 가이드 콘솔 / 기사 콕핏.
 *
 * 배포된 앱을 HTTP 로 실제 주행한다. 쓰기는 전부 `sim_tag='sim'` 예약에만
 * 떨어지고 `npx tsx scripts/sim-tour-day.ts --cleanup` 이 되돌린다.
 *
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts    ← 먼저
 *   npx tsx scripts/qa-prod-tour-room.ts
 *   npx tsx scripts/sim-tour-day.ts --cleanup           ← 반드시 마지막에
 *
 * 표면을 더 넓히려면 `scripts/qa-prod-surfaces.ts`(인증·미디어·결제·챗봇).
 *
 * 🔴 일부러 건드리지 않는 것 (사람을 부르거나 돈을 쓴다):
 *   · POST /sos        → 실제 당직자에게 알람이 간다
 *   · 손님 일괄 메일   → 미리보기까지만
 *
 * 계약 함정은 이미 풀려 있다. 다시 헤매지 말 것:
 *   · 룸 토큰은 **프로덕션이 발급**해야 한다(`/api/admin/tour-ops/links`).
 *     `TOUR_ROOM_TOKEN_SECRET` 이 .env.local 과 Vercel 에서 달라 로컬 서명은 403.
 *   · 어드민 API 는 `Authorization: Bearer` 를 받는다.
 *   · join 은 **201** 이고 응답은 `channel.topic`(`channelTopic` 아님),
 *     세션은 `x-tour-room-auth` 헤더로 나른다.
 *   · 손님 시그널 타입은 `lost`(`lost_me` 는 핀 이름이지 타입이 아니다).
 *   · extras PATCH 는 `{extraId, action: confirm|settle|void}`.
 *   · morning-briefing·dining·approach·spot-events·captions 는 **POST 전용**.
 *   · extend 는 `{hours: 1..8}` 이고 private 투어만(아니면 400 private_only).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const BASE = process.env.QA_BASE ?? 'https://www.atockorea.com';
const FIX = path.join('scripts', '.sim-fixtures.json');
if (!existsSync(FIX)) {
  console.error(
    'scripts/.sim-fixtures.json 이 없습니다. 먼저 시딩하세요:\n' +
      '  ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts',
  );
  process.exit(1);
}
const fixtures = JSON.parse(readFileSync(FIX, 'utf8'));

const TOUR_A = '943c79aa-c6d8-4e63-86ab-2656ccb77913';
const TOUR_DATE: string = fixtures.tourDate;
const B1: string = fixtures.booking1;
const B2: string = fixtures.booking2;

function tokenOf(url: string): string {
  return decodeURIComponent(new URL(url, BASE).searchParams.get('rt') ?? '');
}
const ADMIN_JWT: string = fixtures.adminSession.access_token;

/**
 * Tokens must be minted BY production: TOUR_ROOM_TOKEN_SECRET differs between
 * .env.local and Vercel, so a locally-signed token is (correctly) rejected.
 * This is also the real ops workflow — "관제에서 링크 복사".
 */
let GUEST1_TOKEN = '';
let GUEST2_TOKEN = '';
let GUIDE_TOKEN = '';

async function mintTokens() {
  phase = '토큰 발급(관제 링크)';
  const mint = async (label: string, bookingId: string, role: string) => {
    const r = await call(`${label} 링크 발급 (role=${role})`, '/api/admin/tour-ops/links', {
      method: 'POST',
      headers: { authorization: `Bearer ${ADMIN_JWT}` },
      body: { bookingId, role },
      expect: [200, 201],
      assert: (b) => {
        if (!b?.url && !b?.token) return 'url/token 없음';
        if (!b?.qr_data_url) return 'qr_data_url 없음';
      },
    });
    return r.body?.token ?? (r.body?.url ? tokenOf(r.body.url) : '');
  };
  GUEST1_TOKEN = await mint('예약A 손님', B1, 'customer');
  GUEST2_TOKEN = await mint('예약B 손님', B2, 'customer');
  GUIDE_TOKEN = await mint('예약A 가이드', B1, 'guide');
  await call('링크 발급 무권한 거부', '/api/admin/tour-ops/links', {
    method: 'POST',
    body: { bookingId: B1, role: 'customer' },
    expect: [401, 403],
  });
  await call('링크 발급 검증(role 누락→400)', '/api/admin/tour-ops/links', {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_JWT}` },
    body: { bookingId: B1 },
    expect: 400,
  });
}

type Row = {
  phase: string;
  name: string;
  method: string;
  pathText: string;
  status: number | string;
  ms: number;
  verdict: 'PASS' | 'FAIL' | 'NOTE';
  detail: string;
};
const rows: Row[] = [];
let phase = '';

function short(v: unknown, n = 220): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

type Opt = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  expect?: number | number[];
  /** extra assertion on the parsed body; return a string to fail */
  assert?: (body: any, res: Response) => string | void;
  note?: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(name: string, pathText: string, opt: Opt = {}) {
  // 라우트별 레이트리밋(분당 15회 급)에 걸려 429가 결과를 오염시키지 않도록 간격을 둔다.
  await sleep(400);
  const method = opt.method ?? 'GET';
  const expect = opt.expect === undefined ? [200] : Array.isArray(opt.expect) ? opt.expect : [opt.expect];
  const started = Date.now();
  try {
    const res = await fetch(BASE + pathText, {
      method,
      headers: {
        ...(opt.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(opt.headers ?? {}),
      },
      body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    let verdict: Row['verdict'] = expect.includes(res.status) ? 'PASS' : 'FAIL';
    let detail = '';
    if (verdict === 'PASS' && opt.assert) {
      const problem = opt.assert(parsed, res);
      if (problem) {
        verdict = 'FAIL';
        detail = problem;
      }
    }
    if (verdict === 'FAIL' && !detail) detail = short(parsed);
    if (opt.note && verdict === 'FAIL') verdict = 'NOTE';
    rows.push({ phase, name, method, pathText, status: res.status, ms, verdict, detail });
    return { res, body: parsed, status: res.status };
  } catch (e) {
    const ms = Date.now() - started;
    rows.push({
      phase,
      name,
      method,
      pathText,
      status: 'ERR',
      ms,
      verdict: 'FAIL',
      detail: (e as Error).message,
    });
    return { res: null as unknown as Response, body: null, status: 0 };
  }
}

// ───────────────────────────── guest ─────────────────────────────

async function guestPass(bookingId: string, token: string, label: string, locale: string) {
  phase = `손님 ${label}`;
  const deviceKey = randomUUID();

  const join = await call(`${label} 입장(join)`, `/api/tour-rooms/${bookingId}/join`, {
    method: 'POST',
    expect: [200, 201],
    body: { deviceKey, token, contactName: `Sim ${label}` },
    assert: (b) => {
      if (!b?.session) return 'session 미발급';
      if (!b?.snapshot) return 'snapshot 없음';
      if (!b?.channel?.topic) return 'channel.topic 없음(R-23)';
    },
  });
  const session: string = join.body?.session ?? '';
  if (!session) return null;
  const H = { 'x-tour-room-auth': session };

  // 냉시작 스냅샷이 실제로 룸을 담고 있는가
  await call(`${label} 스냅샷`, `/api/tour-mode/room/${bookingId}/snapshot`, {
    headers: H,
    expect: [200, 401, 403],
    note: true,
  });

  await call(`${label} 메시지 목록`, `/api/tour-rooms/${bookingId}/messages`, { headers: H });

  const sent = await call(`${label} 메시지 전송(${locale})`, `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: { text: locale === 'ja' ? 'トイレはどこですか？' : 'Where is the nearest toilet?' },
    expect: [200, 201],
    assert: (b) => {
      const m = b?.message ?? b;
      if (!m?.id) return '메시지 id 없음';
    },
  });
  const messageId: string | null = sent.body?.message?.id ?? sent.body?.id ?? null;

  // 무제한 언어 브릿지(PR #336): 프랑스어로 쓰면 chat_locale 이 학습돼야 한다
  await call(`${label} 타언어 전송(fr) — 브릿지`, `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: { text: 'Où est le point de rendez-vous ?', chatLocale: 'fr' },
    expect: [200, 201],
  });

  if (messageId) {
    await call(`${label} 재번역`, `/api/tour-rooms/${bookingId}/messages/${messageId}/retranslate`, {
      method: 'POST',
      headers: H,
      body: {},
      expect: [200, 202, 400, 403],
      note: true,
    });
    await call(`${label} 리액션`, `/api/tour-rooms/${bookingId}/reactions`, {
      method: 'POST',
      headers: H,
      body: { messageId, emoji: '👍' },
      expect: [200, 201],
    });
    await call(`${label} 읽음`, `/api/tour-rooms/${bookingId}/read`, {
      method: 'POST',
      headers: H,
      body: { lastMessageId: messageId },
      expect: [200, 204],
    });
  }

  await call(`${label} 타이핑`, `/api/tour-rooms/${bookingId}/typing`, {
    method: 'POST',
    headers: H,
    body: { typing: true },
    expect: [200, 204],
  });

  await call(`${label} 위치 공유`, `/api/tour-rooms/${bookingId}/location`, {
    method: 'POST',
    headers: H,
    body: { latitude: 37.5665, longitude: 126.978, accuracyM: 12 },
    expect: [200, 201],
  });

  // 시그널 3종
  for (const type of ['running_late', 'rest_stop', 'lost']) {
    await call(`${label} 시그널 ${type}`, `/api/tour-rooms/${bookingId}/signals`, {
      method: 'POST',
      headers: H,
      body: type === 'lost' ? { type, lat: 37.5665, lng: 126.978 } : { type },
      expect: [200, 201],
    });
  }
  // 잘못된 시그널은 400 이어야 한다 (입력 검증)
  await call(`${label} 시그널 검증(불량 타입→400)`, `/api/tour-rooms/${bookingId}/signals`, {
    method: 'POST',
    headers: H,
    body: { type: 'not_a_signal' },
    expect: 400,
  });

  // 플래너
  await call(`${label} 플랜 조회`, `/api/tour-rooms/${bookingId}/plan`, { headers: H });
  await call(`${label} 플랜 템플릿`, `/api/tour-rooms/${bookingId}/plan/templates`, {
    headers: H,
    expect: [200, 403],
    note: true,
  });
  await call(`${label} 플랜 저장(초안)`, `/api/tour-rooms/${bookingId}/plan`, {
    method: 'PUT',
    headers: H,
    body: {
      stops: [
        { poi_key: 'gyeongbokgung', title: 'Gyeongbokgung Palace', dwell_minutes: 60 },
        { poi_key: 'bukchon', title: 'Bukchon Hanok Village', dwell_minutes: 45 },
      ],
      needs: { stroller: false, halal: true },
      departure_time: '09:00',
    },
    expect: [200, 403, 409],
    note: true,
  });
  await call(`${label} 플랜 확정 시도(손님→403이어야)`, `/api/tour-rooms/${bookingId}/plan`, {
    method: 'PUT',
    headers: H,
    body: { confirm: true },
    expect: [403, 400, 409],
  });

  /**
   * 읽기 표면들 — 진짜 GET 인 것만 남긴다.
   *
   * 🔴 여기 있던 다섯(모닝브리핑·다이닝·approach·spot-events·captions)은
   * **POST 전용 라우트**인데 GET 으로 불리고 있었다. 405/404 가 돌아왔고
   * `expect` 에 404 가 들어 있어서 **전부 초록으로 통과**했다 —
   * 이 파일 머리의 계약 주석에 "POST 전용"이라고 적혀 있는데도 그랬다.
   * 주석은 아무도 멈추지 않는다. 아래 postOnly 로 옮겨서 진짜로 친다.
   */
  const reads: Array<[string, string]> = [
    ['투어 일정', `/api/tour-rooms/${bookingId}/tour-itinerary`],
    ['오늘 요약', `/api/tour-rooms/${bookingId}/day-summary`],
    ['식이 제한', `/api/tour-rooms/${bookingId}/dietary`],
    ['차량 ETA', `/api/tour-rooms/${bookingId}/vehicle-eta`],
    ['이벤트 로그', `/api/tour-rooms/${bookingId}/events`],
    ['정산 원장', `/api/tour-rooms/${bookingId}/extras`],
  ];
  for (const [name, p] of reads) {
    // 🔴 404 를 기대에서 뺐다. GET 라우트가 404 를 주면 그건 통과가 아니라
    // 라우트가 사라졌다는 뜻이다.
    await call(`${label} ${name}`, p, { headers: H, expect: [200, 204, 400, 403], note: true });
  }

  /**
   * POST 전용 표면 — 메서드와 바디를 실제 계약대로.
   * 405 를 기대에 넣지 않는다. 405 가 나오면 그건 이 목록이 또 틀렸다는 뜻이다.
   */
  const postOnly: Array<[string, string, Record<string, unknown>]> = [
    ['모닝 브리핑', `/api/tour-rooms/${bookingId}/morning-briefing`, { locale }],
    ['식당(다이닝)', `/api/tour-rooms/${bookingId}/dining`, { locale }],
    ['접근(approach)', `/api/tour-rooms/${bookingId}/approach`, { locale }],
    ['스팟 이벤트(타임라인)', `/api/tour-rooms/${bookingId}/spot-events`, { locale }],
    ['자막(captions)', `/api/tour-rooms/${bookingId}/captions`, { locale }],
  ];
  for (const [name, p, body] of postOnly) {
    await call(`${label} ${name} (POST)`, p, {
      method: 'POST',
      headers: H,
      body,
      expect: [200, 201, 204, 400, 403, 429],
      note: true,
    });
  }

  // AI 컨시어지 — Tier0(무네트워크 칩은 클라이언트) / Tier1~2 서버
  await call(`${label} 컨시어지(Tier1)`, `/api/tour-rooms/${bookingId}/concierge`, {
    method: 'POST',
    headers: H,
    body: { question: 'What time do we come back to the hotel?', locale },
    expect: [200, 429],
    note: true,
    assert: (b) => {
      if (b?.answer === undefined && b?.text === undefined && b?.error === undefined) return '응답에 answer/text 없음';
    },
  });
  await call(`${label} 컨시어지 검증(빈 질문→400)`, `/api/tour-rooms/${bookingId}/concierge`, {
    method: 'POST',
    headers: H,
    body: { question: '' },
    expect: 400,
  });

  // 타임라인 쿠폰(멱등) — 두 번 눌러도 한 번만 발급돼야 한다
  const c1 = await call(`${label} 타임라인 쿠폰 1회차`, `/api/tour-rooms/${bookingId}/timeline-coupon`, {
    method: 'POST',
    headers: H,
    body: {},
    expect: [200, 400, 403, 409],
    note: true,
  });
  const c2 = await call(`${label} 타임라인 쿠폰 2회차(멱등)`, `/api/tour-rooms/${bookingId}/timeline-coupon`, {
    method: 'POST',
    headers: H,
    body: {},
    expect: [200, 400, 403, 409],
    note: true,
  });
  rows.push({
    phase,
    name: `${label} 쿠폰 멱등성`,
    method: '-',
    pathText: 'timeline-coupon ×2',
    status: `${c1.status}/${c2.status}`,
    ms: 0,
    verdict: c1.status === c2.status ? 'PASS' : 'NOTE',
    detail: `1회차=${c1.status} 2회차=${c2.status} · ${short(c2.body, 120)}`,
  });

  // 동행 초대
  await call(`${label} 동행 초대 발급`, `/api/tour-rooms/${bookingId}/companion-invite`, {
    method: 'POST',
    headers: H,
    body: {},
    expect: [200, 201, 403],
    note: true,
  });

  // 손님이 가이드 전용 라우트를 부르면 403 이어야 한다 (권한 경계)
  await call(`${label} 권한경계: 손님→manual-arrival(403 기대)`, `/api/tour-rooms/${bookingId}/manual-arrival`, {
    method: 'POST',
    headers: H,
    body: { title: 'illegal' },
    expect: 403,
  });
  await call(`${label} 권한경계: 손님→driver-signal(403 기대)`, `/api/tour-rooms/${bookingId}/driver-signal`, {
    method: 'POST',
    headers: H,
    body: { type: 'delay', minutes: 10 },
    expect: 403,
  });
  await call(`${label} 권한경계: 손님→extras 기입(403 기대)`, `/api/tour-rooms/${bookingId}/extras`, {
    method: 'POST',
    headers: H,
    body: { item: 'illegal', amount_krw: 1000, kind: 'entrance' },
    expect: 403,
  });

  // 위조 세션은 반드시 거부돼야 한다
  await call(`${label} 위조 세션 거부`, `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: { 'x-tour-room-auth': session.slice(0, -4) + 'dead' },
    body: { text: 'forged' },
    expect: [401, 403],
  });

  return { session, deviceKey };
}

// ───────────────────────────── guide ─────────────────────────────

async function guidePass(bookingId: string) {
  phase = '가이드 콘솔';
  const deviceKey = randomUUID();

  await call('가이드 overview', `/api/tour-mode/guide/overview?rt=${encodeURIComponent(GUIDE_TOKEN)}`, {
    assert: (b) => {
      if (!b || (b.rooms === undefined && b.bookings === undefined)) return 'rooms/bookings 없음';
    },
  });
  await call('가이드 overview 토큰없음(403 기대)', '/api/tour-mode/guide/overview', { expect: 403 });

  const join = await call('가이드 입장(join)', `/api/tour-rooms/${bookingId}/join`, {
    method: 'POST',
    expect: [200, 201],
    body: { deviceKey, token: GUIDE_TOKEN, locale: 'ko', contactName: 'Sim Guide' },
    assert: (b) => {
      if (b?.role && b.role !== 'guide') return `role=${b.role} (guide 기대)`;
      if (!b?.session) return 'session 미발급';
    },
  });
  const session: string = join.body?.session ?? '';
  if (!session) return null;
  const H = { 'x-tour-room-auth': session };

  await call('가이드 플랜 조회', `/api/tour-rooms/${bookingId}/plan`, { headers: H });
  await call('가이드 플랜 확정', `/api/tour-rooms/${bookingId}/plan`, {
    method: 'PUT',
    headers: H,
    body: { confirm: true },
    expect: [200, 400, 409],
    note: true,
  });
  await call('가이드 스톱 스킵(사유)', `/api/tour-rooms/${bookingId}/plan`, {
    method: 'PUT',
    headers: H,
    body: { stops_changed: true, stops: [{ poi_key: 'gyeongbokgung', title: 'Gyeongbokgung Palace', status: 'skipped', skip_reason: 'closed_today' }] },
    expect: [200, 400, 403, 409],
    note: true,
  });

  await call('가이드 도착 트리거(manual-arrival)', `/api/tour-rooms/${bookingId}/manual-arrival`, {
    method: 'POST',
    headers: H,
    body: { title: 'Gyeongbokgung Palace', poiKey: 'gyeongbokgung' },
    expect: [200, 201, 404],
    note: true,
  });
  await call('가이드 도착 번들', `/api/tour-rooms/${bookingId}/arrival-bundle`, {
    headers: H,
    expect: [200, 204, 404],
    note: true,
  });

  // 원장(LEDGER)
  const extra = await call('가이드 지출 기입', `/api/tour-rooms/${bookingId}/extras`, {
    method: 'POST',
    headers: H,
    body: { item: '입장료 (sim)', amount_krw: 12000, kind: 'entrance' },
    expect: [200, 201],
  });
  const extraId = extra.body?.extra?.id ?? extra.body?.id ?? null;
  if (extraId) {
    await call('가이드 지출 상태 전이(수취완료)', `/api/tour-rooms/${bookingId}/extras`, {
      method: 'PATCH',
      headers: H,
      body: { extraId, action: 'confirm' },
      expect: [200, 400, 409],
      note: true,
    });
    await call('가이드 지출 불법 전이 거부', `/api/tour-rooms/${bookingId}/extras`, {
      method: 'PATCH',
      headers: H,
      body: { extraId, action: 'teleport' },
      expect: [400, 409],
    });
  }
  await call('가이드 지출 요약', `/api/tour-rooms/${bookingId}/extras`, {
    method: 'POST',
    headers: H,
    body: { summary: true },
    expect: [200, 400],
    note: true,
  });

  // 공지 방송
  await call('가이드 공지 방송', '/api/tour-rooms/broadcast', {
    method: 'POST',
    headers: H,
    body: { tourId: TOUR_A, tourDate: TOUR_DATE, text: '[SIM] 10분 뒤 출발합니다', token: GUIDE_TOKEN },
    expect: [200, 201, 400, 403],
    note: true,
  });

  /**
   * 🔴 이 호출은 `{ minutes: 30 }` 을 보내고 있었다. 라우트는 `{ hours: 1..8 }`
   * 만 읽으므로 **매번 400 `hours must be a whole number 1..8`** 이었고,
   * `expect` 에 400 이 있어서 초록으로 통과했다. 즉 이 앱에서 **돈이 오가는
   * 유일한 경로**(현금 시간연장 청구를 원장에 기록한다)를 한 번도 실제로
   * 친 적이 없다.
   *
   * 400 을 기대에서 뺀다. 이 경로는 이제 성공하거나(200/201),
   * 전세 상품이 아니라서 거절되거나(403 private_only), 실패로 보고된다.
   */
  await call('가이드 연장(extend, hours=1)', `/api/tour-rooms/${bookingId}/extend`, {
    method: 'POST',
    headers: H,
    body: { hours: 1 },
    expect: [200, 201, 403, 409],
    note: true,
  });
  // 계약 자체도 한 번 친다 — 범위 밖 값은 반드시 400 이어야 한다.
  await call('가이드 연장 검증(hours=0 → 400)', `/api/tour-rooms/${bookingId}/extend`, {
    method: 'POST',
    headers: H,
    body: { hours: 0 },
    expect: 400,
  });

  return session;
}

// ───────────────────────────── driver ─────────────────────────────

async function driverPass(bookingId: string) {
  phase = '기사 콕핏';

  const link = await call('기사 링크 발급(admin)', '/api/tour-mode/driver/link', {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_JWT}` },
    body: { tourId: TOUR_A, tourDate: TOUR_DATE, displayName: 'Sim Driver' },
    expect: [200, 201],
    assert: (b) => {
      if (!b?.url && !b?.token) return 'url/token 없음';
    },
  });
  await call('기사 링크 무권한 거부', '/api/tour-mode/driver/link', {
    method: 'POST',
    body: { tourId: TOUR_A, tourDate: TOUR_DATE },
    expect: [401, 403],
  });

  const driverToken: string =
    link.body?.token ?? (link.body?.url ? tokenOf(link.body.url) : '');
  if (!driverToken) return null;

  await call('기사 overview(PII 최소)', `/api/tour-mode/driver/overview?rt=${encodeURIComponent(driverToken)}`, {
    expect: [200, 403],
    assert: (b) => {
      const s = JSON.stringify(b ?? {});
      if (/contact_email|contact_phone|"email":/.test(s)) return 'PII 최소화 위반: 손님 연락처가 응답에 있음';
    },
  });

  // 차량 PIN 게이트: 잘못된 PIN 은 거부돼야 한다
  await call('기사 입장 — 틀린 PIN(거부 기대)', `/api/tour-rooms/${bookingId}/join`, {
    method: 'POST',
    body: { deviceKey: randomUUID(), token: driverToken, pin: '0000', contactName: 'Sim Driver' },
    expect: [200, 401, 403],
    note: true,
  });

  const join = await call('기사 입장(join)', `/api/tour-rooms/${bookingId}/join`, {
    method: 'POST',
    body: { deviceKey: randomUUID(), token: driverToken, contactName: 'Sim Driver' },
    expect: [200, 403],
    note: true,
  });
  const session: string = join.body?.session ?? '';
  if (!session) return null;
  const H = { 'x-tour-room-auth': session };

  // 🔴 회귀 감시: verifyRoomSession 이 driver 를 거부하던 라이브 버그
  await call('기사 세션이 후속 호출에 통한다(회귀)', `/api/tour-rooms/${bookingId}/messages`, {
    headers: H,
  });

  for (const [name, body] of [
    ['지연', { type: 'delay', minutes: 15 }],
    ['주차핀', { type: 'parking_pin', lat: 37.5665, lng: 126.978 }],
    ['차량도착', { type: 'vehicle_arrived' }],
    ['차량문제', { type: 'vehicle_issue' }],
    ['복귀시간', { type: 'return_time', time: '17:30', point: 'the main gate' }],
  ] as Array<[string, Record<string, unknown>]>) {
    await call(`기사 시그널 ${name}`, `/api/tour-rooms/${bookingId}/driver-signal`, {
      method: 'POST',
      headers: H,
      body,
      expect: [200, 201],
    });
  }
  await call('기사 시그널 검증(주차핀 좌표누락→400)', `/api/tour-rooms/${bookingId}/driver-signal`, {
    method: 'POST',
    headers: H,
    body: { type: 'parking_pin' },
    expect: 400,
  });
  await call('기사 복귀시간 취소', `/api/tour-rooms/${bookingId}/driver-signal`, {
    method: 'POST',
    headers: H,
    body: { type: 'return_time', cancel: true, time: '17:30' },
    expect: [200, 201, 400],
    note: true,
  });

  return session;
}

// ───────────────────────────── run ─────────────────────────────

async function main() {
  console.log(`대상: ${BASE} · 투어일 ${TOUR_DATE}\n`);

  await mintTokens();
  await guestPass(B1, GUEST1_TOKEN, 'A(en)', 'en');
  await guestPass(B2, GUEST2_TOKEN, 'B(ja)', 'ja');
  await guidePass(B1);
  await driverPass(B1);

  // 리포트
  const byPhase = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byPhase.has(r.phase)) byPhase.set(r.phase, []);
    byPhase.get(r.phase)!.push(r);
  }
  for (const [p, list] of byPhase) {
    console.log(`\n── ${p} ──`);
    for (const r of list) {
      const mark = r.verdict === 'PASS' ? 'PASS' : r.verdict === 'NOTE' ? 'NOTE' : 'FAIL';
      console.log(
        `  ${mark}  ${r.name}  [${r.method} ${r.status} ${r.ms}ms]${r.detail ? `\n        ↳ ${r.detail}` : ''}`,
      );
    }
  }
  const pass = rows.filter((r) => r.verdict === 'PASS').length;
  const fail = rows.filter((r) => r.verdict === 'FAIL').length;
  const note = rows.filter((r) => r.verdict === 'NOTE').length;
  console.log(`\n총 ${rows.length}검사 — PASS ${pass} · FAIL ${fail} · NOTE ${note}`);
  writeFileSync(path.join('scripts', '.qa-prod-tour-room-report.json'), JSON.stringify(rows, null, 2));
  console.log('상세 → scripts/.qa-prod-tour-room-report.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
