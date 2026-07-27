/**
 * qa-ops-walk — headless real-browser walkthrough of the 투어 관제센터
 * (O0 / U-D8 of docs/ops-staff-design-unification-master-plan-2026-07-27.md).
 *
 * Why this exists: Part A rewrites the ops center's chrome, typography and
 * colour. None of that is visible to tsc or jest, so the plan bars declaring
 * the redesign done without shots. The smart app has had a walk since PR #481;
 * the ops center never did — §A-1 lists "관제 전용 walk 하니스 없음" as the
 * reason its drift went unnoticed for this long.
 *
 * The recorded blocker was auth: the ops center sits behind /admin and the
 * seeded session lives in a COOKIE (@supabase/ssr), not localStorage.
 * Injecting localStorage renders every page signed-out and the harness then
 * reports a cheerful zero. Same cookie adoption + same hard exit(2) as
 * scripts/qa-admin-cjk.ts.
 *
 * Usage:
 *   1) dev server on :3161
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) SHOT_DIR=<out> node scripts/qa-ops-walk.mjs
 * Cleanup: npx tsx scripts/sim-tour-day.ts --cleanup
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import path from 'path';

const OUT = path.join(process.env.SHOT_DIR ?? '.', 'ops-shots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
const OPS = '/admin/tour-ops';

let fx;
try {
  fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));
} catch {
  console.error('🔴 픽스처가 없다 — 먼저 `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts`');
  process.exit(2);
}

const browser = await chromium.launch();
// The ops device is a phone in the field; 390px is where the tables squeeze.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
});

// ---- admin session (cookie, not localStorage) ------------------------------
try {
  const raw = `base64-${Buffer.from(JSON.stringify(fx.adminSession)).toString('base64')}`;
  const CHUNK = 3180; // the SSR helper's chunk size
  const cookies =
    raw.length <= CHUNK
      ? [{ name: fx.supabaseStorageKey, value: raw }]
      : Array.from({ length: Math.ceil(raw.length / CHUNK) }, (_, i) => ({
          name: `${fx.supabaseStorageKey}.${i}`,
          value: raw.slice(i * CHUNK, (i + 1) * CHUNK),
        }));
  await ctx.addCookies(
    cookies.map((c) => ({
      ...c,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    })),
  );
} catch (error) {
  console.error('🔴 admin session not adopted —', String(error).slice(0, 140));
  process.exit(2);
}

const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 240)));

const shots = [];
const shoot = async (name) => {
  const file = path.join(OUT, `${String(shots.length).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  shots.push(name);
  console.log(`  shot ${name}`);
};
const settle = (ms = 900) => page.waitForTimeout(ms);

// ---- probes ---------------------------------------------------------------
// Drift is counted per tab and summed: a single end-of-run probe only ever
// sees the last screen's mounted nodes, understating it by roughly 6x.
const countDrift = () =>
  page.evaluate(() => {
    const inRoot = [...document.querySelectorAll('.tr-root *')];
    const cls = (el) => (typeof el.className === 'string' ? el.className : '');
    return {
      rawPx: inRoot.filter((el) => /text-\[\d+(\.\d+)?px\]/.test(cls(el))).length,
      hardColor: inRoot.filter((el) =>
        /(bg|text|border)-(amber|emerald|red|blue|slate|green|orange)-\d{3}/.test(cls(el)),
      ).length,
    };
  });

// Chrome facts are read in BOTH themes. The first cut of this harness probed
// only after the dark toggle and reported dark values as if they were light.
const chromeFacts = () =>
  page.evaluate(() => {
    const root = document.querySelector('.tr-root');
    const header = document.querySelector('header');
    const nav = document.querySelector('nav');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    // `--tr-chrome` is declared on `.tr-root`, not `:root` — reading it off
    // documentElement returns empty and reads as "the token doesn't exist".
    const chrome = root ? getComputedStyle(root).getPropertyValue('--tr-chrome').trim() : '';
    // Resolve it to a real rgb() the same way the header would, so "does the
    // header use it" compares like with like.
    let chromeRgb = '';
    if (root) {
      const probe = document.createElement('div');
      probe.style.background = 'var(--tr-chrome)';
      root.appendChild(probe);
      chromeRgb = getComputedStyle(probe).backgroundColor;
      probe.remove();
    }
    return {
      skinStamped: root?.getAttribute('data-tr-skin') ?? null,
      chromeVar: chrome,
      chromeRgb,
      headerBg: cs(header)?.backgroundColor ?? 'none',
      headerBlur: cs(header)?.backdropFilter ?? 'none',
      navBg: cs(nav)?.backgroundColor ?? 'none',
      headerUsesChrome: !!chromeRgb && cs(header)?.backgroundColor === chromeRgb,
    };
  });

// ---- boot ------------------------------------------------------------------
await page.goto(BASE + OPS, { waitUntil: 'domcontentloaded', timeout: 120000 });

// Signed-out means the whole walk is a no-op dressed as a pass. Fail loudly.
try {
  await page.waitForSelector('[data-testid="ops-tab-home"]', { timeout: 90000 });
} catch {
  console.error('🔴 관제 셸이 안 떴다 — 로그인으로 튕겼을 가능성. url =', page.url());
  console.error('   시드가 오래됐으면 `ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts` 재실행.');
  await page.screenshot({ path: path.join(OUT, 'FAILED-not-signed-in.png') });
  await browser.close();
  process.exit(2);
}
await page.addStyleTag({ content: 'nextjs-portal{display:none !important}' });
await settle(1600);

// ---- 1) the six tabs, light -----------------------------------------------
const perTab = {};
for (const tab of ['home', 'dashboard', 'bookings', 'map', 'sos', 'settings']) {
  await page.click(`[data-testid="ops-tab-${tab}"]`);
  await settle(tab === 'map' ? 2200 : 1000);
  await shoot(`tab-${tab}`);
  perTab[tab] = await countDrift();
}
const lightChrome = await chromeFacts();

// ---- 2) the overlays reached from the home tiles ---------------------------
const escapeTraps = [];
// tile key → overlay root testid. A derived name would silently "pass" the
// Escape check against a selector matching nothing — how the first run of this
// harness reported a close that never happened.
const overlays = [
  ['manager', 'ops-room-manager', '배정·룸·링크'],
  ['messaging', 'ops-guest-messaging', '손님 안내'],
  ['autopilot', 'ops-autopilot', '오토파일럿'],
];
for (const [key, rootId, label] of overlays) {
  await page.click('[data-testid="ops-tab-home"]');
  await settle(700);
  const tile = page.locator(`[data-testid="ops-tile-${key}"]`);
  if (!(await tile.count())) {
    console.log(`  skip overlay ${key} (tile absent)`);
    continue;
  }
  await tile.click();
  await settle(1800);
  await shoot(`overlay-${key}`);

  if (!(await page.locator(`[data-testid="${rootId}"]`).count())) {
    console.error(`🔴 ${key} 오버레이가 안 열렸다 (testid ${rootId}) — 하니스가 헛돌고 있다`);
    process.exitCode = 1;
    continue;
  }
  // 🔴 O0 finding: not one ops overlay listens for Escape (the smart app's
  // Sheet has since PR #481), so closing has to go through the 닫기 button.
  await page.keyboard.press('Escape').catch(() => {});
  await settle(400);
  const escClosed = (await page.locator(`[data-testid="${rootId}"]`).count()) === 0;
  if (!escClosed) {
    escapeTraps.push(key);
    await page
      .locator(`[data-testid="${rootId}"] button[aria-label="닫기"]`)
      .first()
      .click({ force: true })
      .catch(() => {});
    await settle(700);
  }
  console.log(`    (${label})${escClosed ? '' : ' — Esc 무시됨'}`);
}

// ---- 3) dark mode, the two densest surfaces -------------------------------
await page.click('[data-testid="ops-tab-home"]');
await settle(600);
await page.click('[data-testid="ops-theme-toggle"]');
await settle(800);
await shoot('dark-home');
await page.click('[data-testid="ops-tab-dashboard"]');
await settle(1000);
await shoot('dark-dashboard');
const darkChrome = await chromeFacts();

await browser.close();

// ---- 4) static drift, in the unit the plan's §A-1 diagnosis used -----------
// The runtime counts only see mounted nodes; a tab nobody opened still carries
// its drift, and O2/O3 have to clear both.
const staticCount = () => {
  const dir = 'components/tour-ops';
  const files = readdirSync(dir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  let rawPx = 0;
  let hardColor = 0;
  const worst = [];
  for (const f of files) {
    const src = readFileSync(path.join(dir, f), 'utf8');
    const px = (src.match(/text-\[\d+(\.\d+)?px\]/g) ?? []).length;
    const col = (src.match(/(bg|text|border)-(amber|emerald|red|blue|slate|green|orange)-\d{3}/g) ?? []).length;
    rawPx += px;
    hardColor += col;
    if (px + col > 0) worst.push({ f, px, col });
  }
  worst.sort((a, b) => b.px + b.col - (a.px + a.col));
  return { files: files.length, rawPx, hardColor, worst: worst.slice(0, 6) };
};
const stat = staticCount();
const runtimeRawPx = Object.values(perTab).reduce((n, t) => n + t.rawPx, 0);
const runtimeColor = Object.values(perTab).reduce((n, t) => n + t.hardColor, 0);

// The Maps referrer error is a localhost allowlist gap, not an app defect
// (recorded in project memory). Counting it would make every run look broken
// and train us to ignore the number.
const KNOWN_ENV = /RefererNotAllowedMapError|Your site URL to be authorized/;
const appErrors = errors.filter((e) => !KNOWN_ENV.test(e));

const line = (k, v) => console.log(`${k.padEnd(22)}${v}`);
console.log('\n--- O0 baseline — Part A acceptance numbers ---');
line('shots', `${shots.length} → ${OUT}`);
line('skin stamped', `${lightChrome.skinStamped ?? 'false'}   (O1 target: a skin key)`);
line('--tr-chrome', `${lightChrome.chromeVar || '(unset)'} → ${lightChrome.chromeRgb || 'n/a'}`);
line('header uses chrome', `${lightChrome.headerUsesChrome}   (O1 target: true, blur none)`);
line('  light header', `${lightChrome.headerBg}  blur=${lightChrome.headerBlur}`);
line('  light nav', lightChrome.navBg);
line('  dark header', `${darkChrome.headerBg}  blur=${darkChrome.headerBlur}`);
line('  dark nav', darkChrome.navBg);
line('raw px', `runtime ${runtimeRawPx} / static ${stat.rawPx}   (O2 target: 0 outside allowlist)`);
line('hardcoded colour', `runtime ${runtimeColor} / static ${stat.hardColor}   (O3 target: 0)`);
stat.worst.forEach((w) => line('  worst', `${w.f}  px=${w.px} colour=${w.col}`));
line('Esc 미지원 오버레이', `${escapeTraps.length ? escapeTraps.join(', ') : 'none'}   (target: none)`);
line('console errors', `${appErrors.length} app / ${errors.length - appErrors.length} known-env`);
appErrors.slice(0, 5).forEach((e) => console.log('   ! ' + e));
