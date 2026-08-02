/**
 * 「제주 알아보기」 문 → 리스트 → 전문을 실렌더로 찍고 **재본다**.
 *
 * 타입 체크와 단위 테스트는 이 화면에 대해 아무것도 말해주지 않는다. 존재하지
 * 않는 CSS 클래스를 세 개 썼는데도 tsc가 초록이었던 게 이 기능이다. 그래서
 * 사람 눈이 볼 것을 그대로 찍고, 픽셀로 재야 하는 것은 픽셀로 잰다.
 *
 * 사전조건: `NEXT_PUBLIC_TOUR_MODE_V1=1 npx next dev`
 *          + `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts`
 * 실행:     node scripts/shot-region-scripts.mjs
 *
 * 이 스크립트가 조용히 틀렸던 자리를 전부 게이트로 바꿨다(2026-08-02):
 *
 *   ① 방을 고르지 않았다. 시뮬이 room1에 **포천** 투어를 물리면 문은 정상적으로
 *      안 뜨는데, 그걸 "배선이 끊겼다"와 구분할 수 없었다. 이제 방을 돌며 문이
 *      있는 방을 찾고, **어느 방에도 없으면 exit 2**로 시끄럽게 죽는다.
 *   ② 탭을 번역된 라벨('오늘 일정')로 집었다. 손님 로케일이 en/ja면 그 라벨이
 *      없어 10초 타임아웃으로 죽는다(실제로 죽었다). 이제 role=tab 순서로 집는다.
 *   ③ 카드를 번호로 집었다. 주제 하나만 끼어들어도 엉뚱한 카드를 찍고 초록이었다.
 *      이제 `data-topic` 키로 집는다.
 *   ④ 스크롤을 고정 픽셀로 굴렸다. 본문 길이가 바뀌면 엉뚱한 데서 찍힌다.
 *      이제 보고 싶은 요소를 직접 끌어온다.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.join(process.env.SHOT_DIR ?? 'shots-region', '');
mkdirSync(OUT, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const ROOMS = [fx.room1Url, fx.room2Url].filter(Boolean);

/** 탭 타깃 하한. 알약이 이보다 작아도 되지만 **손가락이 닿는 영역**은 안 된다. */
const TAP_MIN = 44;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 240)));

let api = null;
/**
 * 🔴 `response` 핸들러 안에서 바디를 읽으면 안 된다.
 *
 * Playwright는 `page.on('response')` 콜백을 **await 하지 않는다.** 다음 내비게이션이
 * 시작되면 아직 안 읽은 바디는 버려지고 `res.json()` 이 던진다 — 그러면 여기서
 * `parse:'failed'` 가 되고 `cards`·`teasers` 가 통째로 비는데, 검사들이
 * `withPhoto === 0 ||` 같은 형태라 **조용히 초록**이 된다(실제로 그랬다).
 *
 * 그래서 응답이 오는 즉시 프라미스만 붙잡아 두고, 실제 대조는 방을 고른 뒤
 * `await` 로 한다. 실패하면 `cards: null` 로 남겨 아래 검사가 시끄럽게 죽는다.
 */
let apiBody = null;
page.on('response', (res) => {
  // 🔴 `/region-scripts` 만으로 거르면 **사진 파일도 걸린다** —
  // `tour-images/region-scripts/jeju/haenyeo.webp`. 표지에 사진이 붙은 순간
  // 마지막 응답이 WebP가 되어 `RIFF…WEBP` 를 JSON 으로 파싱하려 든다.
  // 라우트만 집는다.
  if (!/\/api\/tour-rooms\/[^/]+\/region-scripts/.test(res.url())) return;
  const status = res.status();
  apiBody = res
    .json()
    .then((j) => ({
      status,
      regionKey: j.regionKey ?? null,
      locale: j.locale ?? null,
      cards: j.cards?.length ?? 0,
      stops: j.stops?.length ?? 0,
      // 표지 검사용 — 문에 올라온 문장이 **정말 라우트가 준 티저인지** 대조한다.
      teasers: (j.cards ?? []).map((c) => c.teaser ?? ''),
      withPhoto: (j.cards ?? []).filter((c) => c.imageUrl).length,
    }))
    .catch((e) => ({ status, cards: null, parse: String(e).slice(0, 120) }));
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
};

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
};

const die = async (msg) => {
  console.error('\n🔴 ' + msg + '\n');
  await browser.close();
  process.exit(2);
};

/** 오늘 일정 탭. 라벨은 10개 로케일로 번역되므로 role=tab 순서로 집는다. */
async function openScheduleTab() {
  const tabs = page.locator('[data-testid="room-tabbar"] button[role="tab"]');
  const n = await tabs.count();
  if (n === 0) return false;
  // 홈이 있는 배치는 Home·Chat·Map·Today·Settings, 없으면 Chat·Map·Today·Settings.
  const idx = n >= 5 ? 3 : 2;
  await tabs.nth(idx).click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  return (await tabs.nth(idx).getAttribute('aria-selected')) === 'true';
}

// ── 문이 있는 방 찾기 ────────────────────────────────────────────────────────
let found = null;
for (const url of ROOMS) {
  apiBody = null;
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const gated = await page.getByText('투어모드를 준비 중입니다').isVisible().catch(() => false);
  if (gated) {
    await die(
      '기능 플래그 게이트에 막혔습니다.\n' +
        '   NEXT_PUBLIC_TOUR_MODE_V1=1 을 준 채로 dev 서버를 띄워야 합니다.\n' +
        '   (빌드 타임에 인라인되므로 서버를 다시 시작해야 반영됩니다.)',
    );
  }

  const dismiss = page.locator('[data-testid="app-manual-dismiss"]');
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  await shot('01-room-landing');

  if (!(await openScheduleTab())) {
    console.log(`  ${url.slice(0, 44)}…  오늘 일정 탭을 못 열었다 — 다음 방`);
    continue;
  }
  await shot('02-schedule-tab');

  const door = page.locator('[data-testid="region-scripts-door"]');
  const hasDoor = (await door.count()) > 0;
  // 바디는 여기서 처음 읽는다 — 핸들러 안이 아니라(위 주석).
  api = apiBody ? await apiBody : null;
  console.log(`  ${url.slice(0, 44)}…  api=${JSON.stringify(api)} door=${hasDoor}`);
  if (hasDoor) {
    found = { url, cards: api?.cards, teasers: api?.teasers, withPhoto: api?.withPhoto };
    break;
  }
}

// 라우트 응답을 못 읽었으면 아래 대조가 전부 공허해진다 — 0 vs 0 은 초록이다.
if (found && (typeof found.cards !== 'number' || !Array.isArray(found.teasers))) {
  await die(
    '라우트 응답을 파싱하지 못했습니다 — 이 상태로는 어떤 대조도 의미가 없습니다.\n' +
      `   ${JSON.stringify(api)}`,
  );
}

// 지역이 안 잡히는 방(서울·포천)에 문이 없는 건 정상이다. 하지만 **모든** 방에
// 없으면 배선이 끊긴 것이고, 그 상태로 초록을 돌려주면 안 된다.
if (!found) {
  await die(
    '어느 방에서도 「제주 알아보기」 문을 못 찾았습니다.\n' +
      '   시뮬이 제주 상품 방을 하나도 안 물렸거나, 배선이 끊겼습니다.\n' +
      `   마지막 라우트 응답: ${JSON.stringify(api)}`,
  );
}

// ── 문 → 리스트 ──────────────────────────────────────────────────────────────
const door = page.locator('[data-testid="region-scripts-door"]');

// U1 — 문은 이제 표지 카드다. 예전 상한(84px, "한 줄에 들어가는가")은 설정
// 메뉴 행을 지키던 자다. 지금 지켜야 할 것은 두 가지고 방향이 반대다:
// ① 표지가 성립할 만큼 크다 ② 일정 탭을 잡아먹지 않는다(옛 가로 띠 330px).
const doorBox = await door.boundingBox();
check(
  doorBox !== null && doorBox.height >= 132 && doorBox.height <= 200,
  `문 높이 ${doorBox?.height?.toFixed(0)}px ∈ [132, 200] (표지로 성립 · 일정 안 잡아먹음)`,
);

// U1b — 표지에 **안의 문장 하나**가 실제로 올라와 있는가. 이게 없으면 그냥
// 큰 설정 행이다. 라우트가 준 티저 중 하나와 글자 그대로 일치해야 한다.
const doorText = (await door.innerText()).replace(/\s+/g, '');
const teaserOnDoor = found.teasers.some(
  (te) => te && doorText.includes(te.replace(/\s+/g, '').slice(0, 12)),
);
check(teaserOnDoor, `표지에 티저 한 줄이 실려 있다`);

// U1c — 사진이 붙은 편이 있으면 표지는 그중에서 골라야 한다(사진 표지 우선).
const doorImg = await door.locator('img').count();
check(
  found.withPhoto === 0 || doorImg === 1,
  `표지 사진 ${doorImg}장 (사진 있는 편 ${found.withPhoto}개)`,
);

await door.click({ timeout: 10000 });
await page.waitForTimeout(900);
await shot('03-list-sheet');

const rows = page.locator('[data-testid="room-sheet"] li button[data-topic]');
const rowCount = await rows.count();
check(rowCount === found.cards, `리스트 행 ${rowCount} = 라우트 카드 ${found.cards}`);

// ── 리스트 → 전문(사진 있는 주제) ───────────────────────────────────────────
const openTopic = async (topic) => {
  const card = page.locator(`li button[data-topic="${topic}"]`);
  if ((await card.count()) === 0) return false;
  await card.first().scrollIntoViewIfNeeded().catch(() => {});
  await card.first().click({ timeout: 10000 });
  await page.waitForTimeout(1200);
  return true;
};
const back = async () => {
  await page.locator('[data-testid="region-scripts-back"]').click({ timeout: 10000 });
  await page.waitForTimeout(800);
};

if (await openTopic('haenyeo')) {
  await shot('04-detail-haenyeo');

  // U3 — 강조가 실제로 그려졌는가. 파서가 죽으면 본문은 멀쩡해 보이는데
  // 별표가 그대로 남거나 굵은 글자가 통째로 사라진다.
  const strongs = await page.locator('[data-testid="room-sheet"] p strong').count();
  check(strongs > 0, `본문 강조 <strong> ${strongs}개 > 0`);
  const literalStars = await page
    .locator('[data-testid="room-sheet"]')
    .innerText()
    .then((s) => (s.match(/\*\*/g) ?? []).length);
  check(literalStars === 0, `화면에 남은 별표 ${literalStars}개 = 0`);

  // 전환 후 시트가 맨 위로 되감겼는가(B1). 위로 안 감기면 전문이 중간부터 열린다.
  const scrolled = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="room-sheet"] [role="dialog"] > div:last-child');
    return box ? box.scrollTop : -1;
  });
  check(scrolled <= 4, `전문 진입 시 시트 스크롤 ${scrolled}px ≈ 0`);

  await back();
  await shot('05-list-after-back');
}

// ── 장소 목록이 붙은 주제 — 지도 알약 실측 ─────────────────────────────────
if (await openTopic('food')) {
  await shot('06-detail-food');

  const mapLink = page.locator('a[href^="https://www.google.com/maps"]').first();
  if ((await mapLink.count()) === 0) {
    await die('음식편 시트에 지도 링크가 없습니다 — places 배선이 끊겼습니다.');
  }
  await mapLink.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot('07-food-places');

  // U4 — 알약은 작게, 손가락이 닿는 영역은 44px. 둘은 같을 필요가 없고,
  // 눈으로는 구분이 안 되므로 **재야** 한다.
  const pill = await mapLink.boundingBox();
  check(pill !== null && pill.height <= 30, `지도 알약 높이 ${pill?.height?.toFixed(1)}px ≤ 30 (글자 대비 과대하지 않다)`);
  const hit = await mapLink.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, '::after');
    const top = parseFloat(cs.top) || 0;
    const bottom = parseFloat(cs.bottom) || 0;
    return r.height - top - bottom; // top/bottom 이 음수면 영역이 넓어진다
  });
  check(hit >= TAP_MIN, `지도 탭 타깃 ${hit.toFixed(1)}px ≥ ${TAP_MIN}`);

  const tel = page.locator('a[href^="tel:"]').first();
  if ((await tel.count()) > 0) {
    const telHit = await tel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el, '::after');
      return r.height - (parseFloat(cs.top) || 0) - (parseFloat(cs.bottom) || 0);
    });
    check(telHit >= TAP_MIN, `전화 탭 타깃 ${telHit.toFixed(1)}px ≥ ${TAP_MIN}`);
  }
}

console.log(`\ncards ${found.cards} · console errors ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('  -', e);
if (errors.length > 0) failures.push(`콘솔 에러 ${errors.length}건`);

await browser.close();
if (failures.length > 0) {
  console.error('\n🔴 실렌더 게이트 실패:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('\n✅ 실렌더 게이트 전부 통과');
