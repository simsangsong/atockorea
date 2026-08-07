/**
 * qa-seat-dispatch-e2e — 배차 한 번에 세 화면이 따라오는가.
 *
 * 좌석은 **한 사실을 세 사람이 본다**: 관제가 차를 붙이고, 손님이 자리를 고르고,
 * 가이드가 현장에서 그 판을 본다. 각각은 이미 따로 검증돼 있었는데(피커 워크,
 * 관제 워크) 셋을 잇는 검사가 없었고, 잇는 자리가 바로 이 저장소가 반복해서
 * 깨지는 자리다 — 라이브 배차 1건·좌석 0건이 그 결과였다.
 *
 * 그래서 이 워크는 **관제 UI 로 진짜 배차를 하고**(SQL 주입이 아니라 버튼을
 * 누른다) 그 한 번의 배차가 손님 화면과 가이드 화면에 도달하는지 따라간다.
 *
 * 준비:
 *   ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   WALK_BASE=http://localhost:3192 node scripts/qa-seat-dispatch-e2e.mjs
 *
 * 🔴 `sim-seat-door.ts` 는 돌리지 마라 — 그건 차를 DB 에 직접 꽂는다. 이 워크의
 * 요점은 관제 화면이 그 일을 할 수 있는지다.
 *
 * ⚠ sim 어드민 세션 토큰은 리프레시가 회전해 **한 번 쓰면 만료**된다. 매 실행
 * 전에 `sim-tour-day.ts` 를 다시 돌려 픽스처를 새로 발급받아라.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';

/**
 * U1 coverage contract — read by `scripts/gen-uiux-coverage.mjs`.
 *
 * ⚠ 그 격자는 `app/(app)/tour-mode` **밖의 페이지를 모른다**. 이 워크는 관제
 * (`/admin/tour-ops`)도 실제로 몰지만, 여기 적으면 생성기가 "그런 페이지 없다"로
 * 던진다 — 그리고 그게 맞다. 격자의 뜻(손님·스태프 스마트앱 표면 커버리지)을
 * 관제까지 넓히는 건 이 트랙의 일이 아니다.
 */
export const COVERS = ['/tour-mode/room/[bookingId]', '/tour-mode/guide'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3192';
const OUT = process.env.WALK_OUT ?? 'scripts/.walk-seat-e2e';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  ✅' : '  🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const adminCookies = () => {
  const raw = `base64-${Buffer.from(JSON.stringify(fx.adminSession)).toString('base64')}`;
  const CHUNK = 3180;
  const parts =
    raw.length <= CHUNK
      ? [{ name: fx.supabaseStorageKey, value: raw }]
      : Array.from({ length: Math.ceil(raw.length / CHUNK) }, (_, i) => ({
          name: `${fx.supabaseStorageKey}.${i}`,
          value: raw.slice(i * CHUNK, (i + 1) * CHUNK),
        }));
  return parts.map((c) => ({ ...c, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
};

const browser = await chromium.launch();
const shot = async (page, n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => undefined);
};

/**
 * 🔴 붙박이 sleep 은 **마운트 중 화면**을 잰다 — 이 저장소가 반복해서 밟는 함정이다.
 * 관제 홈을 10초에 재니 「룸 0 · 연결 중」인 로딩 화면을 찍고 배지가 없다고 보고했다.
 * 조건이 참이 될 때까지 기다리되, 안 되면 그 사실을 알려 준다(조용히 초록 금지).
 */
async function settle(page, probe, { timeout = 45_000, every = 1000 } = {}) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await probe().catch(() => false)) return true;
    await page.waitForTimeout(every);
  }
  return false;
}

/** D-1 온보딩은 전체 화면 모달이다. 넘기지 않으면 그 아래를 아무것도 못 본다. */
async function clearOnboarding(page) {
  for (let i = 0; i < 8; i += 1) {
    if ((await page.locator('[data-testid="onboarding"]').count()) === 0) return;
    const next = page.locator('[data-testid="onboard-next"]');
    if ((await next.count()) === 0) return;
    await next.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function openRoom(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('[data-testid="home-tab"], [data-testid="guide-console"], .tr-root', { timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => undefined);
  await clearOnboarding(page);
  await page.waitForTimeout(1200);
}

// ═══ 1. 관제 — 진짜 버튼으로 배차한다 ════════════════════════════════════════
console.log('\n[1] 관제 — 배차');
const opsCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
await opsCtx.addCookies(adminCookies());
const ops = await opsCtx.newPage();
let dispatchedPlate = null;

await ops.goto(`${BASE}/admin/tour-ops`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
// 오늘 룸 수가 0을 벗어나면 데이터가 도착한 것이다. 그 전에 재면 로딩 화면을 잰다.
// ⚠ dev 서버가 차가우면 이 라우트의 첫 컴파일만으로 수십 초가 간다 — 넉넉히.
const opsLoaded = await settle(ops, async () => !/룸\s*0(\D|$)/.test(await ops.locator('body').innerText()), { timeout: 120_000 });
if (!opsLoaded) console.log('  ⏳ 관제 데이터가 120초 안에 안 왔다 — 아래 판정은 그 상태에서 잰 것이다');
await ops.waitForTimeout(2000);
if (await ops.locator('header button:has-text("로그인")').count()) {
  console.error('🔴 어드민 세션 만료 — sim-tour-day.ts 를 다시 돌려 픽스처를 재발급하라 (exit 2)');
  process.exit(2);
}
const hub = ops.locator('button').filter({ hasText: /배정.*룸.*링크/ }).first();
// 카드가 **존재**할 때까지가 진짜 전제다. 없는 채로 클릭하면 하니스가 예외로 죽고,
// 죽은 하니스는 「기능 결함」과 구별이 안 된다.
if (!(await settle(ops, async () => (await hub.count()) > 0, { timeout: 90_000 }))) {
  await shot(ops, '00-ops-no-hub');
  console.error('🔴 관제 허브 카드가 90초 안에 안 떴다 — scripts/.walk-seat-e2e/00-ops-no-hub.png 를 보라 (exit 2)');
  process.exit(2);
}
await settle(ops, async () => /미배차\s*\d+팀/.test(await hub.innerText().catch(() => '')), { timeout: 30_000 });
ok('관제 홈이 미배차를 말한다', /미배차\s*\d+팀/.test(await hub.innerText().catch(() => '')), (await hub.innerText().catch(() => '')).replace(/\n/g, ' | '));
await shot(ops, '01-ops-hub');

await hub.click({ timeout: 20_000 });
// 목록도 자기 fetch 로 온다. 행이 하나라도 그려질 때까지 기다린 뒤에 잰다 —
// 로딩 스켈레톤을 재고 "요약이 없다"고 보고한 적이 있다.
const listLoaded = await settle(
  ops,
  async () => (await ops.locator('[data-testid^="manager-dispatch-badge-"]').count()) > 0,
  { timeout: 60_000 },
);
ok('목록이 로드된다', listLoaded, `${await ops.locator('[data-testid^="manager-dispatch-badge-"]').count()}행`);
ok('목록에 배차 요약이 있다', (await ops.locator('[data-testid="manager-dispatch-summary"]').count()) > 0);

/**
 * 🔴 이름으로 카드를 찾으면 안 된다. 이 DB 에는 **여러 세션의 시뮬 예약**이 함께
 * 살아 있고 전부 "Sim Alex" 다(`sim-tour-day --cleanup` 은 자기 태그만 지운다).
 * 첫 판에서 남의 세션 예약에 배차하고는 "이미 배차돼 있다"고 보고했다.
 * 행에는 예약 id 가 붙은 선택자가 이미 있다 — 그걸 쓴다.
 */
const badge = ops.locator(`[data-testid="manager-dispatch-badge-${fx.booking1}"]`);
const btn = ops.locator(`[data-testid="manager-vehicle-${fx.booking1}"]`);
await badge.scrollIntoViewIfNeeded().catch(() => undefined);
ok('시뮬 팀 카드를 찾았다', (await badge.count()) > 0);
if (await badge.count()) {
  /**
   * 🔴 이 워크는 반복 실행돼야 하고, 이 DB 에는 앞선 실행이나 **다른 세션**이
   * 남긴 배차가 살아 있을 수 있다(`--cleanup` 은 자기 태그만 지운다). 남아 있으면
   * 「미배차 → 배차」라는 이 워크의 본론을 볼 수 없으므로, UI 로 먼저 해제한다.
   * 겸사겸사 해제 경로도 검사된다.
   *
   * ⚠ 해제는 `window.confirm` 을 띄운다 — Playwright 는 처리되지 않은 다이얼로그를
   * 자동 취소하므로, 이 핸들러가 없으면 **해제가 조용히 아무 일도 안 한다**.
   */
  ops.on('dialog', (d) => d.accept().catch(() => undefined));
  if ((await badge.innerText()).trim() !== '미배차' && (await btn.count())) {
    await btn.click({ timeout: 10_000 });
    await ops.waitForTimeout(3500);
    const drawer = ops.locator('[role="dialog"]').last();
    const release = drawer.locator('button[aria-label="배차 해제"]').first();
    if (await release.count()) {
      await release.click({ timeout: 10_000 }).catch(() => undefined);
      await ops.waitForTimeout(4000);
    }
    await drawer.locator('button[aria-label="닫기"]').last().click({ timeout: 8000 }).catch(() => undefined);
    await settle(ops, async () => (await badge.innerText().catch(() => '')).trim() === '미배차', { timeout: 20_000 });
    ok('기존 배차를 UI 로 해제할 수 있다', (await badge.innerText().catch(() => '')).trim() === '미배차', (await badge.innerText().catch(() => '')).trim());
  }
  const before = (await badge.innerText()).trim();
  ok('그 팀이 미배차 상태에서 시작한다', before === '미배차', before || '(빈 배지)');
  ok('그 행에 [차량 배정] 버튼이 있다', (await btn.count()) > 0, (await btn.count()) ? '' : '룸이 없으면 버튼도 없다');
  if (await btn.count()) {
    await btn.click({ timeout: 10_000 });
    await ops.waitForTimeout(3500);
    const dialog = ops.locator('[role="dialog"]').last();
    const add = dialog.locator('button', { hasText: /^\+?\s*차량 배정$/ }).first();
    if (await add.count()) await add.click({ timeout: 10_000 });
    await ops.waitForTimeout(2500);
    const sel = dialog.locator('select').first();
    const vals = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
    if (vals.length) await sel.selectOption(vals[0]);
    dispatchedPlate = '31가 7788';
    const plate = dialog.locator('input[placeholder*="번호"], input[placeholder*="12가"], input[type="text"]').first();
    if (await plate.count()) await plate.fill(dispatchedPlate);
    await shot(ops, '02-ops-dispatch-form');
    const save = dialog.locator('button', { hasText: /^배정하기$/ }).first();
    ok('배차 폼에 [배정하기]가 있다', (await save.count()) > 0);
    if (await save.count()) {
      await save.click({ timeout: 10_000 });
      await ops.waitForTimeout(5000);
      await settle(ops, async () => (await dialog.innerText().catch(() => '')).includes(dispatchedPlate), { timeout: 20_000 });
      const panel = await dialog.innerText().catch(() => '');
      const line = panel.split('\n').map((t) => t.trim()).find((t) => t.includes(dispatchedPlate));
      ok('배차가 저장된다', panel.includes(dispatchedPlate), line ?? panel.replace(/\n/g, ' | ').slice(0, 120));
      await shot(ops, '03-ops-after-dispatch');

      // 드로어를 닫고 목록으로 돌아와, 그 행의 배지가 실제로 바뀌었는지 본다.
      await ops.locator('[role="dialog"] button[aria-label="닫기"]').last().click({ timeout: 8000 }).catch(() => undefined);
      await settle(ops, async () => (await badge.innerText().catch(() => '')).includes(dispatchedPlate), { timeout: 20_000 });
      ok('목록 배지가 차량으로 바뀐다', (await badge.innerText().catch(() => '')).includes(dispatchedPlate), (await badge.innerText().catch(() => '')).trim());
    }
  }
}
await opsCtx.close();

// ═══ 2. 손님 — 배차가 좌석 선택으로 이어지는가 ═════════════════════════════
console.log('\n[2] 손님');
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const guest = await guestCtx.newPage();
const guestErrors = [];
guest.on('console', (m) => { if (m.type() === 'error' && !/Google Maps|vibrate/.test(m.text())) guestErrors.push(m.text().slice(0, 140)); });

await openRoom(guest, fx.room1Url);
await guest.evaluate((id) => window.localStorage.setItem(`tour_mode_locale:${id}`, 'ko'), fx.booking1);
await guest.reload({ waitUntil: 'domcontentloaded' });
await guest.waitForSelector('[data-testid="home-tab"]', { timeout: 90_000 });
await guest.waitForTimeout(2500);
await clearOnboarding(guest);
// 좌석 카드는 자기 fetch(my-seat) 뒤에 나타난다 — 도착을 기다린 뒤에 센다.
await settle(guest, async () => (await guest.locator('[data-testid="room-seat-card"]').count()) > 0, { timeout: 25_000 });

const seatCard = guest.locator('[data-testid="room-seat-card"]');
ok('손님 홈에 좌석 카드가 있다', (await seatCard.count()) > 0,
   (await seatCard.count()) ? `state=${await seatCard.getAttribute('data-seat-state')} · ${(await seatCard.innerText()).replace(/\n/g, ' | ')}` : '');
ok('홈 타일에 [내 좌석]이 있다', (await guest.locator('[data-testid="home-tile-seat"]').count()) > 0);
await shot(guest, '04-guest-home');

// 카드로 피커를 열고 실제로 고른다.
if (await seatCard.count()) {
  await seatCard.first().click({ timeout: 10_000 }).catch(() => undefined);
  await guest.waitForTimeout(2500);
  const sheet = guest.locator('[data-testid="room-seat-sheet"]');
  ok('좌석 시트가 열린다', (await sheet.count()) > 0);
  // 판은 자기 fetch 로 오므로 도착한 뒤에 센다 — 안 그러면 동작하는 화면에서 0석을 보고한다.
  await guest.waitForSelector('[data-seat]', { timeout: 20_000 }).catch(() => undefined);
  const seats = guest.locator('[data-seat]');
  const seatCount = await seats.count();
  ok('좌석판이 그려졌다', seatCount > 0, `${seatCount}석`);
  await shot(guest, '05-guest-picker');
  // 비어 있는 자리를 일행 수(2)만큼 고른다. 번호를 박으면 앞 실행이 남긴
  // 배정과 부딪혀 「탭이 해제로 동작」하는 함정에 걸린다.
  let picked = 0;
  for (let i = 0; i < seatCount && picked < 2; i += 1) {
    const s = seats.nth(i);
    const st = (await s.getAttribute('data-state')) ?? (await s.getAttribute('data-seat-state'));
    if (st && st !== 'free' && st !== 'available') continue;
    await s.click({ timeout: 5000 }).catch(() => undefined);
    picked += 1;
    await guest.waitForTimeout(180);
  }
  const confirm = guest.locator('[data-testid="room-seat-confirm"]');
  ok('일행 수만큼 고르면 [좌석 확정]이 열린다', picked === 2 && (await confirm.isEnabled().catch(() => false)), `${picked}석 선택`);
  if (await confirm.isEnabled().catch(() => false)) {
    await confirm.click({ timeout: 10_000 });
    await guest.waitForTimeout(4000);
    ok('확정이 저장된다', (await guest.locator('[data-testid="room-seat-done"]').count()) > 0);
    await shot(guest, '06-guest-confirmed');
  }
}

// 다시 들어와서 배정된 좌석 + 배차한 차량번호가 보이는가.
await openRoom(guest, fx.room1Url);
await settle(guest, async () => (await guest.locator('[data-testid="room-seat-card"]').getAttribute('data-seat-state').catch(() => null)) === 'assigned', { timeout: 25_000 });
const after = guest.locator('[data-testid="room-seat-card"]');
const afterText = (await after.innerText().catch(() => '')).replace(/\n/g, ' | ');
ok('재입장 시 내 좌석이 보인다', (await after.getAttribute('data-seat-state').catch(() => null)) === 'assigned', afterText);
ok('관제에서 넣은 차량번호가 손님에게 보인다', dispatchedPlate ? afterText.includes(dispatchedPlate) : false, dispatchedPlate ?? '(배차 실패)');
// 타일로도 같은 답에 닿는가.
const tile = guest.locator('[data-testid="home-tile-seat"]');
if (await tile.count()) {
  await tile.first().scrollIntoViewIfNeeded();
  await tile.first().click({ timeout: 10_000 }).catch(() => undefined);
  await guest.waitForTimeout(2500);
  const opened = (await guest.locator('[data-testid="room-seat-sheet"], [data-testid="room-seat-summary"]').count()) > 0;
  ok('타일이 같은 좌석 시트를 연다', opened);
  await shot(guest, '07-guest-tile-sheet');
}
ok('손님 화면 콘솔 에러 0', guestErrors.length === 0, guestErrors.slice(0, 3).join(' / '));
await guestCtx.close();

// ═══ 3. 가이드 — 같은 판을 보는가 ═══════════════════════════════════════════
console.log('\n[3] 가이드');
const guideCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const guide = await guideCtx.newPage();
const guideErrors = [];
guide.on('console', (m) => { if (m.type() === 'error' && !/Google Maps|vibrate/.test(m.text())) guideErrors.push(m.text().slice(0, 140)); });

await openRoom(guide, fx.guideUrl);
await shot(guide, '08-guide-console');

/**
 * 🔴 가이드 링크는 룸 셸이 아니라 **스태프 콘솔**을 연다 — 바닥 탭이
 * [대화 · 좌석·명단 · 운행 · 설정] 이고 좌석판은 그 두 번째 탭이다. 룸 헤더의
 * `GuideSeatStrip` 을 찾던 첫 판정은 없는 문을 두드리며 🔴 를 찍고 있었다.
 * 하니스가 틀린 문을 두드리면 멀쩡한 기능이 결함으로 보고된다.
 */
await settle(guide, async () => (await guide.locator('[data-testid="staff-tab-chat"], [data-testid="staff-tab-seats"]').count()) > 0, { timeout: 30_000 });
const seatsTab = guide.locator('button').filter({ hasText: /좌석[·・]명단/ }).first();
ok('가이드 콘솔에 [좌석·명단] 탭이 있다', (await seatsTab.count()) > 0);
let openedRoster = false;
if (await seatsTab.count()) {
  await seatsTab.click({ timeout: 10_000 }).catch(() => undefined);
  // 🔴 판이 **존재**하는 것과 판에 **데이터가 도착한** 것은 다르다. 존재만
  // 기다렸더니 "0명 · 0팀 · 배정된 예약이 없어요" 를 찍고 멀쩡한 화면을 결함으로
  // 보고했다. 명단 수가 0을 벗어날 때까지 기다린다.
  openedRoster = await settle(
    guide,
    async () => /[1-9]\d*명\s*·\s*[1-9]\d*팀/.test(await guide.locator('[data-testid="guide-seat-dashboard"]').innerText().catch(() => '')),
    { timeout: 30_000 },
  );
}
ok('가이드가 좌석판을 연다(명단 도착)', openedRoster);
await shot(guide, '09-guide-roster');
if (openedRoster) {
  const board = guide.locator('[data-testid="guide-seat-dashboard"]');
  const rosterText = (await board.innerText()).replace(/\n/g, ' | ');
  // 손님이 고른 그 좌석이 가이드 명단에 찍히는가. 이 DB 엔 여러 세션의
  // "Sim Alex" 가 있으므로 이름이 아니라 **좌석 번호 표기**로 판정한다.
  ok('가이드 명단에 손님이 고른 좌석이 보인다', /좌석\s*\d+(\s*,\s*\d+)*/.test(rosterText),
     (rosterText.match(/좌석\s*\d+(\s*,\s*\d+)*/) ?? ['없음'])[0]);
  ok('가이드 명단에 [좌석 지정] 배지가 있다', rosterText.includes('좌석 지정'));

  // 좌석판 세그먼트로 넘어가면 배차한 차량이 보여야 한다(명단 세그먼트엔 없다).
  const boardSeg = guide.locator('[data-testid="seg-seats"], button').filter({ hasText: /^좌석판$/ }).first();
  if (await boardSeg.count()) {
    await boardSeg.click({ timeout: 8000 }).catch(() => undefined);
    await settle(guide, async () => (await guide.locator('[data-seat]').count()) > 0, { timeout: 20_000 });
    const seatsText = (await board.innerText()).replace(/\n/g, ' | ');
    ok('가이드 좌석판에 배차한 차량이 보인다', dispatchedPlate ? seatsText.includes(dispatchedPlate) : false,
       dispatchedPlate ? seatsText.slice(0, 120) : '(이번 실행에서 배차하지 않음)');
    ok('가이드 좌석판이 실제로 그려졌다', (await guide.locator('[data-seat]').count()) > 0, `${await guide.locator('[data-seat]').count()}석`);
    await shot(guide, '10-guide-seatmap');
  } else ok('가이드 판에 [좌석판] 세그먼트가 있다', false);
}
ok('가이드 화면 콘솔 에러 0', guideErrors.length === 0, guideErrors.slice(0, 3).join(' / '));
await guideCtx.close();

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} 통과 · 스크린샷 ${OUT}/`);
if (failed.length) {
  console.log('  실패:');
  for (const f of failed) console.log(`    🔴 ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
