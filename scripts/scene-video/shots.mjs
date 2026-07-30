/**
 * F3 — the screenshot stage. The most valuable thing in this pipeline.
 *
 * Cards in the guide video hold OUR APP, not drawings of it (plan §A-3 item 3,
 * §H "카드에 아이콘/일러스트 대체 금지"). We can drive the app with Playwright,
 * so we photograph the real thing.
 *
 * 🔴 A missing or stale shot FAILS the build. It never falls back to a
 * placeholder: a guide video showing a screen the app no longer has is worse
 * than no video, because nobody re-checks a video once it ships.
 *
 * Usage:
 *   dev server on WALK_BASE + ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *                            + npx tsx scripts/sim-populate.ts
 *   node scripts/scene-video/shots.mjs [--locale ko] [--out dir]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../video-guide/lib/deps.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const ROOT = process.cwd();

/**
 * The shot list. Each entry declares where to go, what to wait for, and what
 * to hide — never a bare "screenshot the page", because a guide video must not
 * publish a real guest's name or a live coordinate.
 *
 * `mask` selectors are blanked before the shutter. `crop` is a fraction of the
 * viewport so a shot can be the card, not the whole phone.
 */
/**
 * 🔴 Most of these are ELEMENT crops, not whole phones.
 *
 * The first cut shot every screen full-frame, and in a 1080-wide vertical the
 * whole phone shrinks to about 400px — the UI became unreadable texture. A card
 * the viewer cannot read is decoration, which is the exact thing §H forbids.
 * So each shot is the thing the sentence is about: the bubbles, the switch, the
 * stop cards. `focus` picks the element; only `home` stays a full screen,
 * because "this is the home screen" is genuinely what that beat says.
 */
export const SHOTS = [
  {
    id: 'home',
    what: '홈 — 화면 전체 (이 화면 자체가 주어인 씬용)',
    tab: null,
    wait: '[data-testid="home-tab"]',
  },
  {
    id: 'chat-bubbles',
    what: '번역된 말풍선 — 원문과 번역이 함께',
    tab: 'chat',
    wait: '[data-testid="chat-feed"]',
    focus: '[data-testid="chat-feed"]',
  },
  {
    id: 'share-switch',
    what: '위치 공유 스위치 — 도착 해설을 여는 그 스위치',
    tab: 'map',
    wait: '[data-testid="location-share-card"]',
    focus: '[data-testid="location-share-card"]',
  },
  {
    id: 'arrival-unlock',
    what: '홈의 「도착 해설 켜기」 카드',
    tab: null,
    wait: '[data-testid="arrival-unlock-card"]',
    focus: '[data-testid="arrival-unlock-card"]',
  },
  {
    id: 'now-card',
    what: '지금 여기 — 히어로 카드와 해설 듣기',
    tab: null,
    wait: '[data-testid="home-status-live"], [data-testid="home-status-lobby"]',
    focus: '[data-testid="home-status-live"], [data-testid="home-status-lobby"]',
  },
  {
    id: 'arrival-card',
    what: '도착 카드 — 스팟 해설과 시설 핀 (이 카드가 도착 해설이다)',
    tab: 'chat',
    wait: '[data-testid="spot-arrival-card"]',
    focus: '[data-testid="spot-arrival-card"]',
  },
  {
    id: 'signal-bar',
    what: '원탭 시그널 — 늦어요·정차·길잃음',
    tab: 'chat',
    wait: '[data-testid="quick-signal-bar"]',
    focus: '[data-testid="quick-signal-bar"]',
  },
  {
    id: 'emergency',
    what: '긴급 — 한 곳에 모인 연락처와 위치 첨부',
    tab: null,
    open: '[data-testid="emergency-open"]',
    wait: '[data-testid="emergency-card"]',
    focus: '[data-testid="emergency-card"]',
    clipTo: { maxRatio: 1.4 },
  },
  {
    id: 'schedule-cards',
    what: '오늘 일정 — 스톱 카드 (정해진 경로)',
    tab: 'schedule',
    wait: '[data-tr-panel="schedule"]',
    focus: '[data-tr-panel="schedule"]',
    /** The panel scrolls; the top three stops are the readable part. */
    clipTo: { maxRatio: 1.15 },
  },
  {
    id: 'settings',
    what: '설정 — 언어·글자 크기·소리로 읽어주기',
    tab: 'settings',
    wait: '[data-tr-panel="settings"]',
    focus: '[data-tr-panel="settings"]',
    clipTo: { maxRatio: 1.15 },
  },
];

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LOCALE = argOf('locale', 'ko');
const OUT = path.resolve(ROOT, argOf('out', path.join(HERE, '.shots')));

/** Personal data and anything that moves: hidden before the shutter. */
const MASK_CSS = `
  nextjs-portal{display:none!important}
  [data-testid="presence-bar"] span[title]{color:transparent!important}
`;

export async function captureShots({ base = BASE, locale = LOCALE, out = OUT } = {}) {
  const fixturesPath = path.join(ROOT, 'scripts/.sim-fixtures.json');
  if (!fs.existsSync(fixturesPath)) {
    throw new Error(
      'scripts/.sim-fixtures.json 이 없다. 먼저:\n'
      + '  ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts',
    );
  }
  const fx = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,          // retina source; the video downsamples it
    locale: `${locale}-KR`,
    colorScheme: 'dark',
    permissions: ['geolocation'],
    geolocation: { latitude: 33.4586, longitude: 126.9425 },
  });

  const manifest = {};
  try {
    const res = await page.goto(`${base}${fx.room1Url}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (!res || res.status() >= 400) throw new Error(`room unreachable: ${res?.status()}`);
    await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
    await page.evaluate(([id, l]) => window.localStorage.setItem(`tour_mode_locale:${id}`, l), [fx.booking1, locale]);
      // §V4-A — the app is captured in its DARK theme so the screens belong to
      // the deck instead of sitting on it as pasted paper. `classic` dark has a
      // canvas of #151818 against the film's #0d0e11 ground: one step lighter,
      // which is what makes a screen read as a lit object rather than a hole.
      await page.evaluate(() => {
        window.localStorage.setItem('tour_mode_settings', JSON.stringify({
          theme: 'dark', skin: 'classic', voiceConfirm: true, autoRead: false, textScale: 3,
        }));
      });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="home-tab"]', { timeout: 60_000 });
    await page.addStyleTag({ content: MASK_CSS });
    await page.waitForTimeout(1600);

    // D-1 onboarding is a modal on a lobby room; step past it before shooting.
    for (let i = 0; i < 8; i += 1) {
      if ((await page.locator('[data-testid="onboarding"]').count()) === 0) break;
      const next = page.locator('[data-testid="onboard-next"]');
      if ((await next.count()) === 0) break;
      await next.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(350);
    }

    for (const shot of SHOTS) {
      if (shot.tab) {
        await page.locator(`[data-testid="room-tab-${shot.tab}"]`).click();
      } else {
        await page.locator('[data-testid="room-tab-home"]').click();
      }
      await page.waitForTimeout(900);
      // Some surfaces live behind a control (the emergency sheet, for one).
      // Opening it here keeps "where this screen is" in the shot list rather
      // than in someone's memory.
      if (shot.open) {
        await page.locator(shot.open).first().click({ timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(700);
      }
      try {
        await page.waitForSelector(shot.wait, { timeout: 15_000 });
      } catch {
        // Leave evidence: a failed shot with no picture of the failure sends
        // the next person hunting selectors blind.
        const bust = path.join(out, `_FAILED_${shot.id}.png`);
        await page.screenshot({ path: bust, fullPage: true }).catch(() => undefined);
        throw new Error(
          `shot "${shot.id}" 의 대기 조건을 못 만났다: ${shot.wait}\n`
          + '  화면이 바뀌었거나 이 상태가 이 픽스처에 없다. 플레이스홀더로 넘어가지 않는다.\n'
          + `  실제 화면: ${path.relative(ROOT, bust)}`,
        );
      }
      await page.addStyleTag({ content: MASK_CSS });
      await page.waitForTimeout(400);

      const file = path.join(out, `${shot.id}.png`);
      const target = shot.focus ? page.locator(shot.focus).first() : page;
      // A scrolling panel screenshots to its full scroll height, which yields a
      // sliver 1:6 tall that no layout can use. Clip it to a usable ratio: the
      // top of the list is the readable part and the rest is repetition.
      let clip;
      if (shot.clipTo) {
        const box = await target.boundingBox();
        if (box && box.height / box.width > shot.clipTo.maxRatio) {
          clip = { x: box.x, y: box.y, width: box.width, height: box.width * shot.clipTo.maxRatio };
        }
      }
      await (clip ? page.screenshot({ path: file, clip }) : target.screenshot({ path: file }));

      const bytes = fs.statSync(file).size;
      if (bytes < 4000) throw new Error(`shot "${shot.id}" 가 사실상 비어 있다 (${bytes}B)`);
      // The scene layout needs the true aspect ratio: forcing a card crop into
      // a phone-shaped box is what turned the first cut's shots into slices.
      const dim = await page.evaluate((src) => new Promise((res) => {
        const i = new Image();
        i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
        i.onerror = () => res({ w: 0, h: 0 });
        i.src = src;
      }), `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
      if (!dim.w || !dim.h) throw new Error(`shot "${shot.id}" 의 크기를 못 읽었다`);

      // A sheet left open swallows the next tab click, and the failure surfaces
      // three shots later as an unrelated timeout.
      if (shot.open) {
        await page.keyboard.press('Escape').catch(() => undefined);
        await page.waitForSelector('[data-testid="room-sheet"]', { state: 'detached', timeout: 8_000 })
          .catch(() => undefined);
        await page.waitForTimeout(400);
      }

      manifest[shot.id] = {
        file: path.relative(ROOT, file), what: shot.what, bytes, locale,
        width: dim.w, height: dim.h, ratio: Number((dim.w / dim.h).toFixed(4)),
      };
      console.log(`  📸 ${shot.id.padEnd(16)} ${String(bytes / 1024 | 0).padStart(5)}KB  ${dim.w}×${dim.h}  ${shot.what}`);
    }
  } finally {
    await browser.close();
  }

  const manifestPath = path.join(out, 'shots.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ base, locale, capturedFor: 'scene-video', shots: manifest }, null, 2));
  console.log(`\n  ${Object.keys(manifest).length}/${SHOTS.length} shots → ${path.relative(ROOT, out)}`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('shots.mjs')) {
  captureShots().catch((e) => {
    console.error(`🔴 ${e.message}`);
    process.exit(1);
  });
}
