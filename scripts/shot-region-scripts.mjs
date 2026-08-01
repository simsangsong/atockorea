/**
 * "제주 알아보기" 밴드 실렌더 확인 — 오늘 일정 탭 상단.
 *
 * 타입 체크와 단위 테스트는 이 화면에 대해 아무것도 말해주지 않는다. 존재하지
 * 않는 CSS 클래스를 세 개 썼는데도 tsc가 초록이었던 게 바로 이 세션이다.
 * 그래서 사람 눈이 볼 것을 그대로 찍는다.
 *
 * 사전조건: dev 서버 + `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts`
 *          + 시뮬 예약이 제주 상품에 붙어 있을 것(아니면 섹션이 안 뜬다).
 * 실행:     node scripts/shot-region-scripts.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.join(process.env.SHOT_DIR ?? 'shots-region', '');
mkdirSync(OUT, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

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

// 라우트가 실제로 무엇을 돌려주는지 따로 잡아둔다. 화면이 비었을 때
// "데이터가 없다"와 "그렸는데 안 보인다"를 구분하지 못하면 디버깅이 두 배가 된다.
let apiSummary = null;
page.on('response', async (res) => {
  if (!res.url().includes('/region-scripts')) return;
  try {
    const j = await res.json();
    apiSummary = { status: res.status(), cards: j.cards?.length ?? 0, stops: j.stops?.length ?? 0 };
  } catch {
    apiSummary = { status: res.status(), parse: 'failed' };
  }
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
};

await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// 앱 매뉴얼이 뜨면 화면을 가린다.
const dismiss = page.locator('[data-testid="app-manual-dismiss"]');
if (await dismiss.isVisible().catch(() => false)) {
  await dismiss.click().catch(() => {});
  await page.waitForTimeout(600);
}
await shot('01-room-landing');

// 게이트 화면에서 그냥 타임아웃 나면 원인을 못 읽는다. 먼저 확인하고 이름을 댄다.
const gated = await page.getByText('투어모드를 준비 중입니다').isVisible().catch(() => false);
if (gated) {
  console.error(
    '\n🔴 기능 플래그 게이트에 막혔습니다.\n' +
      '   NEXT_PUBLIC_TOUR_MODE_V1=1 을 준 채로 dev 서버를 띄워야 합니다.\n' +
      '   (이 값은 빌드 타임에 인라인되므로 서버를 다시 시작해야 반영됩니다.)\n',
  );
  await browser.close();
  process.exit(2);
}

// 🔴 탭은 라벨(텍스트)로 고른다. 헤드리스에서 좌표 클릭은 조용히 빗나간다
//    — 콕핏 진입에서 이미 한 번 당한 실패 유형이다.
const scheduleTab = page.getByRole('button', { name: '오늘 일정' }).first();
await scheduleTab.click({ timeout: 10000 });
await page.waitForTimeout(2500);
await shot('02-schedule-tab');

// 밴드가 DOM에 있는가 + 화면 안에 있는가를 따로 본다. getComputedStyle이
// visible이어도 화면 밖일 수 있다(2026-07 기록).
const band = page.locator('section[aria-label="제주 알아보기"]');
const bandCount = await band.count();
const box = bandCount ? await band.first().boundingBox() : null;
const cardCount = bandCount ? await band.first().locator('li button').count() : 0;

console.log(JSON.stringify({ api: apiSummary, bandCount, cardCount, box }, null, 1));

if (cardCount > 0) {
  // 카드 하나 열어서 시트 안(본문·장소칩·거리·지도)을 본다.
  await band.first().locator('li button').nth(4).click({ timeout: 10000 }); // 해녀
  await page.waitForTimeout(1500);
  await shot('03-sheet-haenyeo');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // 음식편 — 장소 칩이 붙어 있는 유일한 카드 중 하나.
  const foodIdx = 9;
  await band.first().locator('li button').nth(foodIdx).click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await shot('04-sheet-food-top');
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(800);
  await shot('05-sheet-food-places');
}

console.log('console errors:', errors.length);
for (const e of errors.slice(0, 8)) console.log('  -', e);

await browser.close();
