/**
 * "제주 알아보기" 밴드와 전문 시트 실렌더 확인 — 오늘 일정 탭 상단.
 *
 * 타입 체크와 단위 테스트는 이 화면에 대해 아무것도 말해주지 않는다. 존재하지
 * 않는 CSS 클래스를 세 개 썼는데도 tsc가 초록이었던 게 바로 이 세션이다.
 * 그래서 사람 눈이 볼 것을 그대로 찍는다.
 *
 * 사전조건: `NEXT_PUBLIC_TOUR_MODE_V1=1 npx next dev`
 *          + `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts`
 * 실행:     node scripts/shot-region-scripts.mjs
 *
 * 이 스크립트가 조용히 틀렸던 세 자리를 게이트로 바꿨다(2026-08-02):
 *
 *   ① 방을 고르지 않았다. 시뮬이 room1에 **포천** 투어를 물리면 밴드는 정상적으로
 *      안 뜨는데, 그걸 "밴드가 죽었다"와 구분할 수 없었다. 이제 방을 돌며 카드가
 *      있는 방을 찾고, **어느 방에도 없으면 exit 2**로 시끄럽게 죽는다.
 *   ② 탭을 번역된 라벨('오늘 일정')로 집었다. 손님 로케일이 en/ja면 그 라벨이
 *      없어 10초 타임아웃으로 죽는다(실제로 죽었다). 이제 role=tab 순서로 집고
 *      aria-selected로 확인한다.
 *   ③ 카드를 nth(4)·nth(9) 번호로 집었다. 주제 하나만 끼어들어도 엉뚱한 카드를
 *      찍고 초록이었다. 이제 `data-topic` 키로 집는다.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000';
const OUT = path.join(process.env.SHOT_DIR ?? 'shots-region', '');
mkdirSync(OUT, { recursive: true });

const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
const ROOMS = [fx.room1Url, fx.room2Url].filter(Boolean);

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
let api = null;
page.on('response', async (res) => {
  if (!res.url().includes('/region-scripts')) return;
  try {
    const j = await res.json();
    api = {
      status: res.status(),
      regionKey: j.regionKey ?? null,
      locale: j.locale ?? null,
      cards: j.cards?.length ?? 0,
      stops: j.stops?.length ?? 0,
    };
  } catch {
    api = { status: res.status(), parse: 'failed' };
  }
});

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('shot', name);
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

let band = null;
for (const url of ROOMS) {
  api = null;
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 게이트 화면에서 그냥 타임아웃 나면 원인을 못 읽는다. 먼저 확인하고 이름을 댄다.
  const gated = await page.getByText('투어모드를 준비 중입니다').isVisible().catch(() => false);
  if (gated) {
    await die(
      '기능 플래그 게이트에 막혔습니다.\n' +
        '   NEXT_PUBLIC_TOUR_MODE_V1=1 을 준 채로 dev 서버를 띄워야 합니다.\n' +
        '   (빌드 타임에 인라인되므로 서버를 다시 시작해야 반영됩니다.)',
    );
  }

  // 앱 매뉴얼이 뜨면 화면을 가린다.
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

  // 밴드가 DOM에 있는가 + 화면 안에 있는가를 따로 본다. getComputedStyle이
  // visible이어도 화면 밖일 수 있다(2026-07 기록).
  const cards = page.locator('section[aria-label] li button[data-topic]');
  const count = await cards.count();
  const box = count ? await cards.first().boundingBox() : null;
  console.log(`  ${url.slice(0, 44)}…  api=${JSON.stringify(api)} cards=${count} box=${JSON.stringify(box)}`);
  if (count > 0) {
    band = { url, count };
    break;
  }
}

// 지역이 안 잡히는 방(서울·포천)에서 밴드가 없는 건 정상이다. 하지만 **모든**
// 방에 없으면 그건 배선이 끊긴 것이고, 그 상태로 초록을 돌려주면 안 된다.
if (!band) {
  await die(
    '어느 방에서도 지역 해설 카드를 못 찾았습니다.\n' +
      '   시뮬이 제주 상품 방을 하나도 안 물렸거나, 배선이 끊겼습니다.\n' +
      `   마지막 라우트 응답: ${JSON.stringify(api)}`,
  );
}

// 사진이 붙은 주제와 장소 목록이 붙은 주제 — 이번에 고친 두 곳이 여기 있다.
for (const [topic, names] of [
  ['haenyeo', ['03-sheet-haenyeo']],
  ['food', ['04-sheet-food-top', '05-sheet-food-places']],
]) {
  const card = page.locator(`li button[data-topic="${topic}"]`);
  if ((await card.count()) === 0) {
    console.log(`  · ${topic} 카드 없음 — 건너뜀`);
    continue;
  }
  await card.first().scrollIntoViewIfNeeded().catch(() => {});
  await card.first().click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await shot(names[0]);
  if (names[1]) {
    // 고정 픽셀로 굴리면 본문 길이가 바뀔 때마다 엉뚱한 데서 찍는다(실제로
    // 1400px은 음식편 본문 중간에서 멈췄다). 보고 싶은 요소를 직접 끌어온다.
    const mapLink = page.locator('a[href^="https://www.google.com/maps"]').first();
    if ((await mapLink.count()) === 0) {
      await die(`${topic} 시트에 지도 링크가 없습니다 — places 배선이 끊겼습니다.`);
    }
    await mapLink.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await shot(names[1]);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
}

console.log(`\ncards ${band.count} · console errors ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('  -', e);

await browser.close();
