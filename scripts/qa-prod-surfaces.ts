/**
 * 프로덕션 표면 커버리지 하니스 — 압력테스트가 안 짚은 곳 (플랜 Wave 5).
 *
 * 2026-07-26 압력테스트는 투어룸·관제만 밟았다. 250개 라우트 중 약 186개가
 * 한 번도 안 불렸고, 그중 **돈·인증·미디어**가 가장 큰 구멍이었다.
 * 이 하니스는 그 셋을 라이브에 대고 확인한다.
 *
 *   npx tsx scripts/qa-prod-surfaces.ts             전부
 *   npx tsx scripts/qa-prod-surfaces.ts auth media  고른 단계만
 *
 * 단계: auth · media · payment · chat
 *
 * 🔴 안전 규약 — 이 하니스는 절대 하지 않는다:
 *   · 돈을 움직이지 않는다. capture/refund/settle 은 **거부 경로만** 친다.
 *   · SOS 를 쏘지 않는다(실제 당직자에게 알람이 간다).
 *   · 손님에게 실제 메일·왓츠앱을 보내지 않는다(미리보기까지만).
 *   쓰기는 전부 `sim_tag='sim'` 예약이나 이 스크립트가 만든 임시 계정에만 하고,
 *   임시 계정은 끝나면 지운다.
 *
 * 계약 함정은 이미 다 풀려 있다(주석에 표시). 다시 헤매지 말 것:
 *   · 룸 토큰은 **프로덕션이 발급**해야 한다 — 로컬 서명은 403이다.
 *   · 어드민 API 는 `Authorization: Bearer` 를 받는다(쿠키 흉내 불필요).
 *   · join 응답은 `channel.topic` 이고 세션은 `x-tour-room-auth` 헤더다.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const BASE = process.env.QA_BASE ?? 'https://www.atockorea.com';
const FIXTURES = path.join('scripts', '.sim-fixtures.json');
const PHASES = ['auth', 'media', 'payment', 'chat'] as const;
type Phase = (typeof PHASES)[number];

const requested = process.argv.slice(2).filter((a) => (PHASES as readonly string[]).includes(a)) as Phase[];
const phases: Phase[] = requested.length > 0 ? requested : [...PHASES];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다 (.env.local).');
  process.exit(1);
}
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

// ── 결과 수집 ──────────────────────────────────────────────────────────────

type Verdict = 'PASS' | 'FAIL' | 'NOTE';
type Row = { phase: string; name: string; status: number | string; ms: number; verdict: Verdict; detail: string };
const rows: Row[] = [];
let phaseLabel = '';

const say = (name: string, verdict: Verdict, detail = '', status: number | string = '-') =>
  rows.push({ phase: phaseLabel, name, status, ms: 0, verdict, detail });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (v: unknown, n = 220) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return !s ? '' : s.length > n ? s.slice(0, n) + '…' : s;
};

type Opt = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  expect?: number | number[];
  assert?: (body: any, res: Response) => string | void;
  note?: boolean;
  /** 요청 간격(ms). 라우트별 레이트리밋에 걸려 결과가 오염되지 않게. */
  gap?: number;
};

async function call(name: string, pathText: string, opt: Opt = {}) {
  await sleep(opt.gap ?? 220);
  const expect = opt.expect === undefined ? [200] : Array.isArray(opt.expect) ? opt.expect : [opt.expect];
  const started = Date.now();
  try {
    const res = await fetch(BASE + pathText, {
      method: opt.method ?? 'GET',
      headers: {
        ...(opt.body !== undefined && !(opt.body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(opt.headers ?? {}),
      },
      body:
        opt.body === undefined ? undefined : opt.body instanceof FormData ? opt.body : JSON.stringify(opt.body),
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    let verdict: Verdict = expect.includes(res.status) ? 'PASS' : 'FAIL';
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
    rows.push({ phase: phaseLabel, name, status: res.status, ms, verdict, detail });
    return { status: res.status, body: parsed, res };
  } catch (e) {
    rows.push({ phase: phaseLabel, name, status: 'ERR', ms: Date.now() - started, verdict: 'FAIL', detail: (e as Error).message });
    return { status: 0, body: null, res: null as unknown as Response };
  }
}

// ── 공용 픽스처 ────────────────────────────────────────────────────────────

function loadFixtures(): { booking1: string; tourDate: string; adminJwt: string } | null {
  if (!existsSync(FIXTURES)) return null;
  const f = JSON.parse(readFileSync(FIXTURES, 'utf8'));
  return { booking1: f.booking1, tourDate: f.tourDate, adminJwt: f.adminSession?.access_token ?? '' };
}

/**
 * 손님 룸 세션. 토큰은 **프로덕션이 발급**해야 한다 — TOUR_ROOM_TOKEN_SECRET 이
 * .env.local 과 Vercel 에서 다르므로 로컬 서명 토큰은 403 이다.
 */
async function guestSession(bookingId: string, adminJwt: string): Promise<string | null> {
  const link = await fetch(`${BASE}/api/admin/tour-ops/links`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminJwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ bookingId, role: 'customer' }),
  }).then((r) => r.json()).catch(() => null);
  if (!link?.url) return null;
  const token = decodeURIComponent(new URL(link.url).searchParams.get('rt') ?? '');
  const join = await fetch(`${BASE}/api/tour-rooms/${bookingId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceKey: randomUUID(), token, locale: 'en', contactName: 'QA Surface' }),
  }).then((r) => r.json()).catch(() => null);
  return join?.session ?? null;
}

// ── auth: 권한 경계 스윕 ───────────────────────────────────────────────────

/**
 * 어드민 라우트를 **파일시스템에서 열거**한다. 목록을 손으로 관리하면 라우트가
 * 늘 때마다 스윕이 뒤처지고, 뒤처진 스윕은 "다 통과했다"고 말한다.
 */
function adminGetRoutes(): string[] {
  const root = path.join('app', 'api', 'admin');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'route.ts' && /export\s+(async\s+)?(function|const)\s+GET/.test(readFileSync(full, 'utf8'))) {
        out.push(
          // 🔴 `path.relative('app', …)` 는 이미 `api/admin/…` 이다. 여기에
          // 호출부가 `/api` 를 한 번 더 붙여 스윕 160회가 전부 404 를 쳤고,
          // "누출 0건" 이라는 결과가 나왔다 — 아무것도 안 물어보고 통과한 것이다.
          // 그래서 경로는 여기서 완성해서 내보내고, 호출부는 그대로 쓴다.
          '/' +
            path
              .relative('app', path.dirname(full))
              .split(path.sep)
              .join('/')
              // [id] → 존재하지 않는 uuid. 인증이 먼저 돌면 리소스 유무는 무관하다.
              .replace(/\[\.\.\.[^\]]+\]/g, '00000000-0000-4000-8000-000000000000')
              .replace(/\[[^\]]+\]/g, '00000000-0000-4000-8000-000000000000'),
        );
      }
    }
  };
  walk(root);
  return [...new Set(out)].sort();
}

async function phaseAuth() {
  phaseLabel = 'auth · 권한 경계';

  const routes = adminGetRoutes();
  say('어드민 GET 라우트 열거', 'PASS', `${routes.length}개`);

  // 정적 확인: 가드 호출이 아예 없는 라우트가 있는가.
  const GUARDS = /requireAdmin|requireRole|requireMerchant|getAuthUser|withAuth|resolveOpsRoomActor|verifyRoomSession|resolveRoomActor|CRON_SECRET/;
  const unguarded: string[] = [];
  const walkGuard = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkGuard(full);
      else if (entry.name === 'route.ts' && !GUARDS.test(readFileSync(full, 'utf8'))) unguarded.push(full);
    }
  };
  walkGuard(path.join('app', 'api', 'admin'));
  say(
    '정적: 가드 호출이 없는 어드민 라우트',
    unguarded.length === 0 ? 'PASS' : 'FAIL',
    unguarded.length === 0 ? '0건' : unguarded.join(', '),
  );

  // 비권한 사용자 한 명. 실제로 로그인한 **customer** 여야 의미가 있다 —
  // 무토큰 401 은 미들웨어만 증명하고, 역할 검사는 증명하지 않는다.
  const email = `qa-nonadmin-${Date.now()}@atockorea.test`;
  const password = `Qa!${randomUUID().slice(0, 12)}Aa1`;
  let nonAdminId: string | null = null;
  let nonAdminJwt = '';
  try {
    const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    nonAdminId = created.user!.id;
    await service.from('user_profiles').upsert({ id: nonAdminId, full_name: 'QA Non Admin', role: 'customer' });
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
    nonAdminJwt = signIn?.session?.access_token ?? '';
  } catch (e) {
    say('비권한 사용자 생성', 'FAIL', (e as Error).message);
  }
  say('비권한 사용자 생성', nonAdminJwt ? 'PASS' : 'FAIL', nonAdminJwt ? `role=customer (${email})` : '토큰 없음');

  try {
    let anonLeaks = 0;
    let roleLeaks = 0;
    /**
     * 🔴 404 를 "통과" 로 세지 않는다. 이 스윕은 한 번 전부 404 를 친 채로
     * "누출 0건" 을 보고한 적이 있다(경로에 /api 를 두 번 붙였다). 라우트가
     * 존재하지 않으면 무엇도 증명되지 않으므로, 401/403 이 **아닌 것**은
     * 전부 따로 세서 마지막에 드러낸다.
     */
    const unexpected = new Map<number | string, string[]>();
    const note = (status: number | string, p: string) => {
      if (!unexpected.has(status)) unexpected.set(status, []);
      unexpected.get(status)!.push(p);
    };

    for (const p of routes) {
      const noAuth = await call(`무토큰 GET ${p}`, p, { expect: [401, 403], note: true, gap: 60 });
      if (noAuth.status === 200) {
        anonLeaks += 1;
        say('🔴 무인증 노출', 'FAIL', `${p} 가 200 을 돌려줌`, noAuth.status);
      } else if (![401, 403].includes(noAuth.status)) {
        note(noAuth.status, `무토큰 ${p}`);
      }

      if (nonAdminJwt) {
        const asUser = await call(`customer GET ${p}`, p, {
          headers: { authorization: `Bearer ${nonAdminJwt}` },
          expect: [401, 403],
          note: true,
          gap: 60,
        });
        if (asUser.status === 200) {
          roleLeaks += 1;
          say('🔴 권한 상승', 'FAIL', `${p} 가 customer 에게 200 을 돌려줌`, asUser.status);
        } else if (![401, 403].includes(asUser.status)) {
          note(asUser.status, `customer ${p}`);
        }
      }
    }

    const checked = routes.length * (nonAdminJwt ? 2 : 1);
    const odd = [...unexpected.values()].reduce((n, list) => n + list.length, 0);
    say(
      '스윕이 실제로 401/403 을 받았다',
      odd === 0 ? 'PASS' : 'FAIL',
      odd === 0
        ? `${checked}회 전부`
        : `${odd}/${checked} 회가 401·403 이 아니다 — ${[...unexpected]
            .map(([s, list]) => `${s}×${list.length} (예: ${list[0]})`)
            .join(' · ')}`,
    );
    say('무인증 누출 합계', anonLeaks === 0 ? 'PASS' : 'FAIL', `${anonLeaks}건 / ${routes.length}라우트`);
    say('권한 상승 누출 합계', roleLeaks === 0 ? 'PASS' : 'FAIL', `${roleLeaks}건 / ${routes.length}라우트`);

    // 프로필 자기 것만 고칠 수 있는가 (W0.1 계열)
    if (nonAdminJwt) {
      await call('자기 프로필 수정은 통과', '/api/auth/update-profile', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${nonAdminJwt}` },
        body: { full_name: 'QA Renamed' },
        expect: [200, 404],
        note: true,
      });
      await call('프로필로 역할 승격 시도(무시돼야)', '/api/auth/update-profile', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${nonAdminJwt}` },
        body: { role: 'admin', full_name: 'QA Renamed' },
        expect: [200, 404],
        note: true,
      });
      if (nonAdminId) {
        const { data: after } = await service.from('user_profiles').select('role').eq('id', nonAdminId).maybeSingle();
        say(
          '🔴 프로필 수정으로 admin 이 되지 않는다',
          after?.role === 'customer' ? 'PASS' : 'FAIL',
          `role=${after?.role ?? '(없음)'}`,
        );
      }
      await call('무토큰 프로필 수정 거부', '/api/auth/update-profile', {
        method: 'PATCH',
        body: { full_name: 'nope' },
        expect: 401,
      });
    }
  } finally {
    if (nonAdminId) {
      await service.from('user_profiles').delete().eq('id', nonAdminId);
      await service.auth.admin.deleteUser(nonAdminId).catch(() => undefined);
      say('임시 계정 정리', 'PASS', email);
    }
  }
}

// ── media: 한 번도 안 밟아본 경로 ──────────────────────────────────────────

/** 1×1 투명 PNG. 실제 이미지여야 서버의 형식 검사를 통과한다. */
function tinyPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

/** 무음 WAV 0.1초. STT 는 빈 결과를 주겠지만 **업로드 경로**가 검증 대상이다. */
function tinyWav(): Buffer {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * 0.1);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

async function phaseMedia(bookingId: string, session: string) {
  phaseLabel = 'media · 미디어 경로';
  const H = { 'x-tour-room-auth': session };

  // 첨부 (이미지)
  const img = new FormData();
  img.append('attachment', new Blob([tinyPng()], { type: 'image/png' }), 'qa.png');
  img.append('text', 'QA 첨부 이미지');
  await call('사진 첨부 업로드', `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: img,
    expect: [200, 201],
    assert: (b) => {
      const m = b?.message ?? b;
      const meta = m?.metadata ?? {};
      if (!m?.id) return '메시지 id 없음';
      if (!JSON.stringify(meta).match(/attachment|url|path/i)) return `첨부 메타데이터 없음: ${short(meta, 120)}`;
    },
  });

  // 첨부 (문서)
  const doc = new FormData();
  doc.append('attachment', new Blob([Buffer.from('QA voucher')], { type: 'application/pdf' }), 'qa.pdf');
  await call('파일 첨부 업로드', `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: doc,
    expect: [200, 201],
  });

  // 형식 거부
  const bad = new FormData();
  bad.append('attachment', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'qa.exe');
  await call('실행파일 첨부 거부', `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: bad,
    expect: [400, 415],
  });

  // 오디오 (STT 폴백 경로)
  const audio = new FormData();
  audio.append('audio', new Blob([tinyWav()], { type: 'audio/wav' }), 'qa.wav');
  await call('오디오 메시지 업로드', `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: audio,
    expect: [200, 201, 400],
    note: true,
  });

  const stt = new FormData();
  stt.append('audio', new Blob([tinyWav()], { type: 'audio/wav' }), 'qa.wav');
  await call('STT 라우트', `/api/tour-rooms/${bookingId}/stt`, {
    method: 'POST',
    headers: H,
    body: stt,
    expect: [200, 400, 422, 503],
    note: true,
  });

  /**
   * TTS 는 자유 텍스트가 아니라 **이미 있는 메시지**를 읽는다
   * (`?messageId=…&locale=…`, (message, locale) 당 한 번 생성해 룸이 공유).
   * `text=` 로 부르면 400 이 오는데 그건 설정 문제가 아니라 계약 오류다 —
   * 하니스가 그 400 을 "통과" 로 세면 아무것도 확인하지 않은 것이 된다.
   * 그래서 방금 올린 메시지의 id 를 실제로 넘긴다.
   *
   * prod 에 OPENAI_API_KEY + `tour-audio` 버킷이 없으면 여기서 5xx/404 가
   * 난다 — 그건 코드가 아니라 사람 게이트다(플랜 §3-2).
   */
  const feed = await call('메시지 목록(TTS 대상 확보)', `/api/tour-rooms/${bookingId}/messages`, { headers: H });
  const list: Array<{ id?: string }> = feed.body?.messages ?? feed.body?.data ?? [];
  const messageId = list.filter((m) => m?.id).at(-1)?.id ?? null;
  if (messageId) {
    await call('TTS 라우트(messageId)', `/api/tour-rooms/${bookingId}/tts?messageId=${messageId}&locale=ko`, {
      headers: H,
      expect: [200, 404, 500, 503],
      note: true,
      assert: (_b, res) => {
        const ct = res.headers.get('content-type') ?? '';
        if (res.status === 200 && !/audio|json/.test(ct)) return `예상 밖 content-type: ${ct}`;
      },
    });
  } else {
    say('TTS 라우트(messageId)', 'NOTE', '피드에 메시지가 없어 건너뜀');
  }
  await call('TTS messageId 없으면 400', `/api/tour-rooms/${bookingId}/tts?locale=ko`, {
    headers: H,
    expect: 400,
  });

  // 비전
  const vision = new FormData();
  vision.append('image', new Blob([tinyPng()], { type: 'image/png' }), 'qa.png');
  vision.append('question', 'What is this?');
  await call('비전 질문', `/api/tour-rooms/${bookingId}/vision-ask`, {
    method: 'POST',
    headers: H,
    body: vision,
    expect: [200, 400, 429],
    note: true,
  });

  // 빈 요청은 거부돼야 한다 — 업로드 경로의 검증이 실제로 도는지
  await call('첨부/오디오 없는 요청 거부', `/api/tour-rooms/${bookingId}/messages`, {
    method: 'POST',
    headers: H,
    body: new FormData(),
    expect: 400,
  });
}

// ── payment: 돈은 절대 움직이지 않는다 ────────────────────────────────────

async function phasePayment(adminJwt: string) {
  phaseLabel = 'payment · 결제 체인';

  say('안전 규약', 'NOTE', '이 단계는 capture/refund/settle 을 실행하지 않는다 — 거부·검증 경로만 친다');

  await call('무토큰 주문 목록 거부', '/api/admin/orders', { expect: [401, 403] });
  await call('어드민 주문 목록', '/api/admin/orders', {
    headers: { authorization: `Bearer ${adminJwt}` },
    expect: [200, 400],
    note: true,
  });

  const fakeId = '00000000-0000-4000-8000-000000000000';
  for (const [name, p] of [
    ['정산(settle)', `/api/admin/orders/${fakeId}/settle`],
    ['환불(refund)', `/api/admin/orders/${fakeId}/refund`],
  ] as const) {
    await call(`무토큰 ${name} 거부`, p, { method: 'POST', body: {}, expect: [401, 403] });
    // 어드민이라도 존재하지 않는 주문은 404/400 이어야 한다. 200 이면
    // "없는 주문에 대해 뭔가를 했다"는 뜻이고 그게 가장 나쁜 결과다.
    await call(`${name} 없는 주문(404/400 기대)`, p, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminJwt}` },
      body: {},
      expect: [400, 404, 409, 422],
      note: true,
    });
  }

  await call('무토큰 체크아웃 세션 생성 거부', '/api/stripe/checkout', {
    method: 'POST',
    body: {},
    expect: [400, 401, 403],
  });
  await call('서명 없는 Stripe 웹훅 거부', '/api/stripe/webhook', {
    method: 'POST',
    body: { type: 'payment_intent.succeeded' },
    expect: [400, 401, 403],
  });

  await call('무토큰 예약 조회 거부', `/api/bookings/${fakeId}`, { expect: [401, 403, 404], note: true });

  // 캡처 크론이 시뮬 예약을 대상에서 뺀다(A0.1). 코드가 아니라 데이터로 확인.
  const { count: simCapturable } = await service
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('sim_tag', 'sim')
    .not('stripe_payment_intent_id', 'is', null);
  say(
    '시뮬 예약에 결제수단이 붙어 있지 않다',
    (simCapturable ?? 0) === 0 ? 'PASS' : 'FAIL',
    `payment_intent 가 있는 sim 예약 ${simCapturable ?? 0}건`,
  );

  await call('무토큰 캡처 크론 거부', '/api/cron/capture-tour-day-payments', { expect: 401 });
}

// ── chat: RAG 수정 후 실제 응답 ───────────────────────────────────────────

async function phaseChat(bookingId: string, session: string) {
  phaseLabel = 'chat · 챗봇/컨시어지';
  const H = { 'x-tour-room-auth': session };

  const questions = [
    ['환불 정책 (정책 RAG)', 'What is your refund policy if I cancel two days before?'],
    ['픽업 (예약 컨텍스트)', 'Where and when do you pick me up?'],
  ] as const;

  for (const [label, q] of questions) {
    const r = await call(`컨시어지 — ${label}`, `/api/tour-rooms/${bookingId}/concierge`, {
      method: 'POST',
      headers: H,
      body: { question: q, locale: 'en' },
      expect: [200, 201, 429],
      note: true,
      gap: 1200,
      assert: (b) => {
        const text = b?.text ?? b?.answer ?? '';
        if (!text) return `본문 없음: ${short(b, 140)}`;
        if (String(text).length < 15) return `응답이 너무 짧음: ${short(text, 80)}`;
      },
    });
    if (r.status < 300) {
      const text = String(r.body?.text ?? r.body?.answer ?? '');
      say(`  ↳ ${label} 응답`, 'NOTE', `${r.body?.kind ?? '?'} · ${short(text, 150)}`, r.status);
    }
  }

  await call('빈 질문 거부', `/api/tour-rooms/${bookingId}/concierge`, {
    method: 'POST',
    headers: H,
    body: { question: '   ' },
    expect: 400,
  });

  /**
   * 상품 상세 어시스턴트(공개 표면) — 같은 RAG 를 쓴다.
   * 본문은 `{ tourProductSlug, messages: [{role, content}] }` 다. `question`/
   * `slug` 로 부르면 400 `invalid_body` 가 오는데 그건 제품이 아니라 하니스가
   * 틀린 것이다. 스키마는 app/api/tour-product/assistant/route.ts 의 bodySchema.
   */
  await call('상품 어시스턴트', '/api/tour-product/assistant', {
    method: 'POST',
    body: {
      tourProductSlug: 'jeju-grand-highlights-loop',
      messages: [{ role: 'user', content: 'Is hotel pickup included?' }],
    },
    expect: [200, 401, 429],
    note: true,
    gap: 1000,
    assert: (b) => {
      const s = JSON.stringify(b ?? {});
      if (s.length < 40) return `응답이 비어 보임: ${short(b, 120)}`;
    },
  });
  await call('상품 어시스턴트 검증(빈 본문→400)', '/api/tour-product/assistant', {
    method: 'POST',
    body: {},
    expect: 400,
  });
}

// ── 실행 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`대상: ${BASE} · 단계: ${phases.join(', ')}\n`);

  const fx = loadFixtures();
  const needsRoom = phases.includes('media') || phases.includes('chat');
  if (needsRoom && !fx) {
    console.error(
      'scripts/.sim-fixtures.json 이 없습니다. media/chat 단계는 시뮬 예약이 필요합니다:\n' +
        '  ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts',
    );
    process.exit(1);
  }

  let session: string | null = null;
  if (needsRoom && fx) {
    session = await guestSession(fx.booking1, fx.adminJwt);
    if (!session) {
      console.error('룸 세션 발급 실패 — 어드민 토큰이 만료됐을 수 있습니다. 시딩을 다시 하세요.');
      process.exit(1);
    }
  }

  if (phases.includes('auth')) await phaseAuth();
  if (phases.includes('media') && fx && session) await phaseMedia(fx.booking1, session);
  if (phases.includes('payment') && fx) await phasePayment(fx.adminJwt);
  if (phases.includes('chat') && fx && session) await phaseChat(fx.booking1, session);

  // ── 리포트 ──
  // 스윕은 라우트 수만큼 행을 만든다. 통과한 것은 한 줄로 접고, 문제만 펼친다.
  const byPhase = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byPhase.has(r.phase)) byPhase.set(r.phase, []);
    byPhase.get(r.phase)!.push(r);
  }
  for (const [p, list] of byPhase) {
    console.log(`\n── ${p} ──`);
    const sweep = list.filter((r) => /^(무토큰|customer) GET /.test(r.name));
    const rest = list.filter((r) => !/^(무토큰|customer) GET /.test(r.name));
    for (const r of rest) {
      console.log(`  ${r.verdict}  ${r.name}  [${r.status}${r.ms ? ` ${r.ms}ms` : ''}]${r.detail ? `\n        ↳ ${r.detail}` : ''}`);
    }
    if (sweep.length > 0) {
      const bad = sweep.filter((r) => r.verdict === 'FAIL');
      console.log(`  (스윕 ${sweep.length}회 — 접음. 문제 ${bad.length}건)`);
      for (const r of bad) console.log(`    FAIL  ${r.name} [${r.status}] ${r.detail}`);
    }
  }

  const pass = rows.filter((r) => r.verdict === 'PASS').length;
  const fail = rows.filter((r) => r.verdict === 'FAIL').length;
  const note = rows.filter((r) => r.verdict === 'NOTE').length;
  console.log(`\n총 ${rows.length}검사 — PASS ${pass} · FAIL ${fail} · NOTE ${note}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
