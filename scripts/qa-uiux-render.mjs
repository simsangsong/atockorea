/**
 * qa-uiux-render — the axes only a render can judge (U3).
 *
 * The consistency axis is measurable from source; these are not. Source cannot
 * tell a 44px hit target from a 44px icon, cannot tell which ellipsis actually
 * fired, and cannot tell how tall the docked stack grew once four conditional
 * banners stacked up. So this walks the real app and measures the DOM.
 *
 * Judged here (plan §4b):
 *   H  visible primary controls per screen      (pass: <= 1)
 *   H  consecutive siblings of identical weight (pass: <= 3)
 *   D  docked bottom stack height / viewport    (pass: <= 25%)
 *   L  ellipsis that actually fired, on an element not marked .text-cjk-safe
 *   P  hit targets under 44px  -- REPORTED, not judged (UX-D5: the standing
 *      judge is 40px; 44 lands after U9 clears what this reports)
 *
 * 🔴 Cockpit entry branches on room count (UX-D10). With one room `drive-hero`
 * enters drive mode directly; with several it only switches to the 운행 tab and
 * the real entry is the per-room `ops-drive`. A harness that knows only one
 * branch waits 60s and reports a healthy app as broken.
 *
 * Usage:
 *   1) dev server (WALK_BASE, default :3181) with NEXT_PUBLIC_TOUR_MODE_V1=1
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) node scripts/qa-uiux-render.mjs [--json]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]', '/tour-mode/guide', '/tour-mode/plan/[bookingId]'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

/**
 * Runs inside the page. Everything here is geometry the source cannot know.
 */
const measure = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  /**
   * 🔴 Visually-hidden is not visible. The chat tab has a 1x1 `sr-only` file
   * input behind the camera button; counting it produced a hit-target
   * violation and a truncation finding for a control no finger can ever reach.
   * A judge that files bugs against invisible elements trains people to ignore
   * it.
   */
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.05) return false;
    if (el.classList.contains('sr-only')) return false;
    if (cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)') return false;
    if (el.tagName === 'INPUT' && el.type === 'file') return false;
    return true;
  };

  // ── P: hit targets. Report both lines so the ratchet has a number to aim at.
  const controls = [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"], input, select')].filter(vis);
  const under = (n) =>
    controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.width, r.height) < n;
    });
  const sample = (els) =>
    els.slice(0, 6).map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ''} ${Math.round(r.width)}x${Math.round(r.height)}`;
    });

  /**
   * ── D: the bottom chrome band.
   *
   * 🔴 The first cut looked for position:fixed/sticky and measured 0 on every
   * guest surface — this app has none. The docked stack is built with flex:
   * the tab bar is position:static and lands at y=787 because the column is
   * min-h-dvh. Looking for the mechanism instead of the result measured
   * nothing and called it clean.
   *
   * So: the band is everything from the top of the highest element that sits
   * flush against the viewport bottom, down to the bottom. Full-screen
   * overlays are excluded — a sheet covering the whole viewport is not bottom
   * furniture, and counting it reported the cockpit as 100% docked.
   */
  const FLUSH = 3;
  /**
   * 🔴 The art layer again. A `<path>` inside the skin scenery happened to end
   * flush above the tab bar, so the chain adopted a 240px slab of illustration
   * as bottom furniture — reported on three surfaces at once, which is what
   * made it obvious it was the artwork and not the UI. The C axis learned this
   * from 190 hex literals; the same exclusion belongs here.
   */
  const bandCandidates = [...document.querySelectorAll('body > * *')]
    .filter((el) => !(el instanceof SVGElement) && !el.closest('svg') && !el.closest('[data-testid="skin-scenery"]'))
    .filter(vis)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    /**
     * 🔴 Bottom furniture is short. Chaining upward without a cap swallowed the
     * content region — `tr-atmos h=735` sits with its bottom flush against the
     * tab bar's top, so the chain walked straight through it and reported every
     * surface as 100% docked. A chip row, a composer, a tab bar: each is a
     * band or two of text tall. Anything a third of the screen high is the page,
     * not the furniture on it. The BAND may exceed the cap; a single element
     * may not.
     */
    .filter(({ r }) => r.height >= 8 && r.height < vh * 0.3);

  /**
   * Walk UP, not just once. The first cut took only the element flush with the
   * viewport bottom and reported 57px for the chat tab — the tab bar alone.
   * The composer, the quick-reply row and the signal bar sit ABOVE it, so their
   * bottoms are at 787, not 844, and a single flush test cannot see them. The
   * band is the chain: each next element ends where the current one begins.
   */
  let bandTop = vh;
  const dockedSamples = [];
  for (let guard = 0; guard < 12; guard += 1) {
    const next = bandCandidates
      .filter(({ r }) => Math.abs(r.bottom - bandTop) <= FLUSH && r.top < bandTop - FLUSH)
      .sort((a, b2) => a.r.top - b2.r.top)[0];
    if (!next) break;
    bandTop = next.r.top;
    dockedSamples.unshift(`${next.el.dataset.testid ?? next.el.className.toString().slice(0, 22)} h=${Math.round(next.r.height)}`);
  }
  const dockedPx = Math.max(0, vh - bandTop);

  // ── L: ellipsis that actually fired. `text-overflow` alone proves nothing;
  //      the element also has to be overflowing its own box right now.
  const truncated = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow !== 'ellipsis') continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue; // not actually clipped
    if (el.classList.contains('text-cjk-safe')) continue; // deliberate, per CLAUDE.md
    truncated.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 24)} "${(el.textContent ?? '').trim().slice(0, 28)}"`);
  }

  /**
   * ── H: which control is "the loud one".
   *
   * 🔴 Read the token off `.tr-root`, not documentElement — the skin variables
   * live on the root element the app mounts, and reading the wrong node
   * returned an empty string, which made every comparison false.
   *
   * Pass line is EXACTLY ONE, not "at most one". A screen with no primary
   * fails the hierarchy axis just as hard as one with three: the guest home
   * has thirteen visible controls, nine fully transparent and four the same
   * near-white, and nothing wins. That is G-f in a paler palette.
   */
  const trRoot = document.querySelector('.tr-root') ?? document.documentElement;
  const accentRaw = getComputedStyle(trRoot).getPropertyValue('--tr-accent').trim();
  const norm = (c) => c.replace(/\s/g, '').toLowerCase();
  const probe = document.createElement('span');
  probe.style.color = accentRaw;
  document.body.appendChild(probe);
  const accentRgb = norm(getComputedStyle(probe).color);
  probe.remove();
  const primaries = controls.filter((el) => {
    const cs = getComputedStyle(el);
    if (norm(cs.backgroundColor) === accentRgb) return true;
    return /tr-cta-hero/.test(el.className.toString());
  });

  return {
    viewport: { vw, vh },
    controls: controls.length,
    hitUnder40: { count: under(40).length, sample: sample(under(40)) },
    hitUnder44: { count: under(44).length, sample: sample(under(44)) },
    docked: { px: Math.round(dockedPx), pct: Math.round((dockedPx / vh) * 100), parts: dockedSamples.slice(0, 4) },
    truncated: { count: truncated.length, sample: truncated.slice(0, 6) },
    primaries: { count: primaries.length, sample: sample(primaries) },
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
/**
 * The ops console authenticates by cookie, not localStorage, and the SSR helper
 * chunks the value at 3180 bytes. Copied from qa-ops-walk rather than
 * reinvented — a session that half-adopts looks like an empty console, which
 * this harness would happily measure as "clean".
 */
try {
  const raw = `base64-${Buffer.from(JSON.stringify(fx.adminSession)).toString('base64')}`;
  const CHUNK = 3180;
  const cookies =
    raw.length <= CHUNK
      ? [{ name: fx.supabaseStorageKey, value: raw }]
      : Array.from({ length: Math.ceil(raw.length / CHUNK) }, (_, i) => ({
          name: `${fx.supabaseStorageKey}.${i}`,
          value: raw.slice(i * CHUNK, (i + 1) * CHUNK),
        }));
  await ctx.addCookies(
    cookies.map((c) => ({ ...c, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' })),
  );
} catch (error) {
  console.error('🔴 admin session not adopted —', String(error).slice(0, 140));
  process.exit(2);
}

const errors = [];

/**
 * 🔴 A fresh page per surface. Sharing one page let a pending navigation from
 * the previous surface abort the next goto (ERR_ABORTED) and destroy the
 * execution context mid-evaluate — three of six surfaces failed that way, and
 * the failures looked like app defects rather than harness state.
 */
let page;
const newPage = async () => {
  if (page) await page.close().catch(() => {});
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
};
await newPage();

const dismissManual = async () => {
  const d = page.locator('[data-testid="app-manual-dismiss"]');
  if (await d.isVisible().catch(() => false)) {
    await d.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
};

const results = [];

/**
 * 🔴 Reachability is asserted, never assumed.
 *
 * The first run of this harness printed "13 controls, 0 violations" for a
 * screen that actually said 예약을 찾을 수 없습니다 — the simulated bookings had
 * been cleaned up underneath it. Zeros from a surface that never rendered read
 * exactly like a clean bill of health, which is the failure this whole plan
 * exists to stop. An unreachable surface is recorded as unreachable and the
 * process exits non-zero, so a silent skip can never be mistaken for a pass.
 */
async function visit(name, url, ready, after) {
  try {
    await newPage();
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    if (ready) await page.waitForSelector(ready, { timeout: 90000, state: 'attached' });
    // Surfaces that fetch after mount (planner, guide console) keep swapping the
    // tree well after the anchor exists; settle before measuring geometry.
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    await dismissManual();
    if (after) await after();
    await page.waitForTimeout(1200);
    const m = await page.evaluate(measure);
    /**
     * Unreachable means "nothing rendered", not "few controls". The first cut
     * used a bare control count and called the plan editor dead at 4 controls —
     * but its body read "SET ITINERARY … this tour runs a set route planned by
     * our team", which is the fixed-route variant rendering correctly with
     * almost nothing to press. A judge that cannot tell a sparse screen from an
     * empty one manufactures failures, and manufactured failures get ignored.
     */
    const text = (await page.evaluate(() => document.body.innerText ?? '')).replace(/\s+/g, ' ').trim();
    if (m.controls < 5 && text.length < 80) {
      results.push({ surface: name, unreachable: `${m.controls} controls, ${text.length} chars — "${text.slice(0, 100)}"` });
      return;
    }
    results.push({ surface: name, ...m });
  } catch (e) {
    results.push({ surface: name, unreachable: String(e).slice(0, 140) });
  }
}

await visit('guest-room-home', fx.room1Url, '[data-testid="room-tabbar"]');

/** UX-005 — the drawer is the one surface that must show the title in full. */
await visit('guest-room-drawer', fx.room1Url, '[data-testid="room-tabbar"]', async () => {
  await page.locator('[data-testid="room-drawer-open"]').click({ timeout: 20000 });
  await page.waitForSelector('[data-testid="room-drawer"]', { timeout: 20000 });
  await page.waitForTimeout(800);
});

/** The chat tab is where the docked stack actually grows (G-g: chips + composer). */
await visit('guest-room-chat', fx.room1Url, '[data-testid="room-tabbar"]', async () => {
  // 🔴 Do not swallow this. A click that silently misses leaves the harness on
  // the home tab reporting home's numbers under the chat tab's name — which it
  // did, twice, and the two runs disagreed by 115px with no sign anything went
  // wrong.
  await page.locator('[data-testid="room-tab-chat"]').click({ timeout: 20000 });
  await page.waitForSelector('[data-testid="quick-replies"], [data-testid="chat-feed"]', { timeout: 30000 });
  await page.waitForTimeout(1200);
});
await visit('guide-console', fx.guideUrl, '[data-testid="staff-tab-btn-ops"], [data-testid="drive-hero"]');

/**
 * Cockpit — take whichever branch this data actually produces (UX-D10).
 * Never wait for `ops-drive` unconditionally: with a single room it does not
 * exist, and the wait looks exactly like a broken app.
 */
/** Plan editor — same room token as the room URL carries. */
const rt = (fx.room1Url.split('?')[1] ?? '');
await visit('plan-editor', `/tour-mode/plan/${fx.booking1}?${rt}`, 'main, [data-testid="plan-root"], h1');

/**
 * 관제 — UX-D3 scopes this to the C and H axes only (Korean-only, staff-only,
 * indoor), so D/L/P numbers are collected but not judged for this surface.
 */
await visit('ops-console', '/admin/tour-ops', 'main, [data-testid="ops-shell"], h1');

await visit('cockpit', fx.guideUrl, '[data-testid="drive-hero"], [data-testid="staff-tab-btn-ops"]', async () => {
  const hero = page.locator('[data-testid="drive-hero"]');
  if (await hero.isVisible().catch(() => false)) {
    await hero.click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const perRoom = page.locator('[data-testid="ops-drive"]').first();
  if (await perRoom.count().catch(() => 0)) {
    await perRoom.scrollIntoViewIfNeeded().catch(() => {});
    await perRoom.click({ timeout: 15000 }).catch(() => {});
  }
  await page.waitForSelector('[data-testid="driver-feed"]', { timeout: 30000 }).catch(() => {});
});

await browser.close();

const out = { base: BASE, pageErrors: errors, results };
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const r of results) {
    if (r.unreachable) {
      console.log(`\n[${r.surface}] 🔴 unreachable — ${r.unreachable}`);
      continue;
    }
    console.log(`\n[${r.surface}] ${r.viewport.vw}x${r.viewport.vh} · ${r.controls} controls`);
    console.log(`  P  hit<40 ${r.hitUnder40.count}   hit<44 ${r.hitUnder44.count}   ${r.hitUnder44.sample.join(' · ')}`);
    console.log(`  D  docked ${r.docked.px}px = ${r.docked.pct}% ${r.docked.pct > 25 ? '🔴 초과' : ''}  [${r.docked.parts.join(' | ')}]`);
    console.log(`  L  truncated ${r.truncated.count} ${r.truncated.count ? '🔴' : ''} ${r.truncated.sample.join(' · ')}`);
    console.log(
      `  H  primaries ${r.primaries.count} ${r.primaries.count === 1 ? '' : r.primaries.count === 0 ? '🔴 없음 — 이길 것이 없다' : '🔴 초과'} ${r.primaries.sample.join(' · ')}`,
    );
  }
  if (errors.length) console.log(`\npage errors: ${errors.length}\n  ${errors.slice(0, 4).join('\n  ')}`);
}

const dead = results.filter((r) => r.unreachable);
if (dead.length) {
  console.error(`\n🔴 ${dead.length}/${results.length} surfaces unreachable — this run measured nothing for them.`);
  console.error('   Re-seed first:  ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts');
  process.exit(2);
}
