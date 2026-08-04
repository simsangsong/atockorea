/**
 * qa-rally-stages — the rally ESCALATE ladder, rendered (G2 axis expansion).
 *
 * 🔴 Why this exists: `docs/audit/UIUX-COVERAGE.md` reported rallyStage as
 * **그물 안 0 / 전체 5** — the only axis with nothing in the net at all. And it
 * is the axis that matters most for layout, because `overdue` and `contact` are
 * the only states that take over the notice banner and suppress every other
 * card (P-D8's "1장 불변식", enforced in `SecondaryCardBanner`). Nobody had ever
 * seen four of the five on a screen.
 *
 * The ladder is a pure function of (meeting target, now) — `rallyStage()` in
 * `lib/tour-room/notices.ts`:
 *
 *     set      past < -10m        remind   -10m <= past < 0
 *     due      0 <= past <= 5m    overdue  5m < past <= 10m
 *     contact  past > 10m
 *
 * So each stage is reachable by seeding one meeting notice at the right offset.
 * Two things a naive harness gets wrong here, both deliberate in the app:
 *
 *   1) **`set` renders NO banner.** Before T-10 the countdown is deliberately
 *      hidden (user decision 2026-07-22 — "the countdown must NOT sit on screen
 *      for the whole free time"); the meeting time lives in the arrival card
 *      instead. A harness that demands a banner for all five reports a correct
 *      app as broken.
 *   2) **The banner dies at target + RALLY_GRACE_MS (15m).** `contact` starts
 *      at +10m, so its visible window is 10–15m. Seeding contact at +15m or
 *      later shows nothing and looks like a bug.
 *
 * Usage:
 *   1) dev server (WALK_BASE, default :3181) with NEXT_PUBLIC_TOUR_MODE_V1=1
 *   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
 *   3) node scripts/qa-rally-stages.mjs [--json]
 *
 * ⚠ This rewrites room 1's meeting notice five times and leaves the last stage
 * (`contact`) seeded. Re-run `sim-populate.ts` to put the room back.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

// A harness that cannot reach the database is not a gate — put the credentials
// in the environment here rather than trusting the caller to pass --env-file.
// (`__tests__/audit/harnessEnvLoading.test.ts` enforces this; it caught this
// very file on its first run.)
//
// ⚠ `@next/env` is CommonJS. The named-export form the `.ts` harnesses use
// works under tsx but throws `SyntaxError: Named export 'loadEnvConfig' not
// found` in a plain `.mjs` under Node's ESM loader — so import the default.
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
export const COVERS = ['/tour-mode/room/[bookingId]'];
export const RALLY_STAGES = ['set', 'remind', 'due', 'overdue', 'contact'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3181';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('🔴 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with `node --env-file=.env.local`.');
  process.exit(2);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/**
 * Offset of the meeting target from now, per stage. Chosen mid-band so a slow
 * page load cannot drift the run into the neighbouring stage — `contact` sits at
 * +12m, inside the 10–15m visible window rather than on either edge.
 */
const OFFSETS_MIN = { set: +20, remind: +5, due: -2, overdue: -7, contact: -12 };

/** `set` is the one stage whose correct rendering is the absence of a banner. */
const EXPECT_BANNER = { set: false, remind: true, due: true, overdue: true, contact: true };

const KST = 9 * 60 * 60 * 1000;
const hhmmKst = (ms) => {
  const d = new Date(ms + KST);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/**
 * 🔴 `created_at` must precede the target. A notice created after its own target
 * is a staff typo announcing a past time, and the app refuses to fire it
 * (`RallyResolutionState`'s backdate guard). Seeding due/overdue/contact
 * "now" would trip that guard and render nothing — which reads as a bug in the
 * banner rather than a bug in the seed.
 */
async function seedStage(stage) {
  const targetMs = Date.now() + OFFSETS_MIN[stage] * 60_000;
  const createdMs = targetMs - 30 * 60_000;
  await sb.from('tour_room_messages').delete().eq('room_id', fx.room1).eq('metadata->>kind', 'meeting_notice');
  const { error } = await sb.from('tour_room_messages').insert({
    room_id: fx.room1,
    booking_id: fx.booking1,
    sender_role: 'guide',
    input_kind: 'text',
    source_text: `집합: ${hhmmKst(targetMs)}`,
    source_locale: 'ko',
    translations: { en: `Meet at ${hhmmKst(targetMs)}` },
    metadata: { kind: 'meeting_notice', meeting_time: hhmmKst(targetMs), place: 'Main gate' },
    created_at: new Date(createdMs).toISOString(),
  });
  if (error) throw new Error(`seed ${stage}: ${error.message}`);
  return { targetMs, createdMs };
}

const measure = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    return !(cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.05);
  };
  const banner = document.querySelector('[data-testid="notice-banner"]');
  const stageLine = document.querySelector('[data-testid="rally-stage-line"]');
  const secondary = document.querySelector('[data-testid="secondary-card"], [data-testid="secondary-card-banner"]');
  return {
    banner: banner && vis(banner)
      ? {
          h: Math.round(banner.getBoundingClientRect().height),
          pct: Math.round((banner.getBoundingClientRect().height / window.innerHeight) * 100),
          text: (banner.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        }
      : null,
    stageLine: stageLine && vis(stageLine) ? (stageLine.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
    countdown: document.querySelector('[data-testid="notice-countdown"]')?.innerText?.trim() ?? null,
    secondaryCard: Boolean(secondary && vis(secondary)),
    controls: [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(vis).length,
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const results = [];
for (const stage of RALLY_STAGES) {
  let row;
  try {
    const seeded = await seedStage(stage);
    const page = await ctx.newPage();
    await page.goto(BASE + fx.room1Url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('[data-testid="room-tabbar"]', { timeout: 90000, state: 'attached' });
    await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {});
    const dismiss = page.locator('[data-testid="app-manual-dismiss"]');
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1800);
    row = { stage, offsetMin: OFFSETS_MIN[stage], seededAt: seeded.targetMs, ...(await page.evaluate(measure)) };
    await page.close();
  } catch (e) {
    row = { stage, error: String(e).slice(0, 160) };
  }
  results.push(row);
}
await browser.close();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ base: BASE, results }, null, 2));
} else {
  for (const r of results) {
    if (r.error) {
      console.log(`\n[${r.stage}] 🔴 ${r.error}`);
      continue;
    }
    const want = EXPECT_BANNER[r.stage];
    const got = Boolean(r.banner);
    const verdict = want === got ? '' : want ? '🔴 배너가 떠야 하는데 없다' : '🔴 배너가 뜨면 안 되는데 떴다';
    console.log(`\n[${r.stage}] target ${r.offsetMin > 0 ? '+' : ''}${r.offsetMin}m · ${r.controls} controls ${verdict}`);
    console.log(`  banner    ${r.banner ? `${r.banner.h}px = ${r.banner.pct}% — "${r.banner.text}"` : '없음 (기대: ' + (want ? '있음' : '없음') + ')'}`);
    console.log(`  stageLine ${r.stageLine ?? '—'}   countdown ${r.countdown ?? '—'}`);
    console.log(`  secondary card visible: ${r.secondaryCard}`);
  }
}

// ── judgement ───────────────────────────────────────────────────────────────
const failures = [];
for (const r of results) {
  if (r.error) {
    failures.push(`${r.stage}: ${r.error}`);
    continue;
  }
  if (Boolean(r.banner) !== EXPECT_BANNER[r.stage]) {
    failures.push(`${r.stage}: banner ${r.banner ? 'present' : 'absent'}, expected ${EXPECT_BANNER[r.stage] ? 'present' : 'absent'}`);
  }
  /**
   * P-D8 — one card at a time. `overdue` and `contact` are the states that take
   * the screen; a secondary card surviving underneath is the invariant breaking.
   */
  if ((r.stage === 'overdue' || r.stage === 'contact') && r.secondaryCard) {
    failures.push(`${r.stage}: a secondary card is still visible under a screen-taking notice (P-D8)`);
  }
}

/**
 * 🔴 Non-vacuity. If the seed silently failed, every stage would report "no
 * banner" and four of five expectations would fail loudly — but `set` alone
 * passing must never be read as coverage. Assert that the ladder actually
 * rendered somewhere.
 */
const bannersSeen = results.filter((r) => r.banner).length;
if (bannersSeen === 0) {
  console.error('\n🔴 no stage rendered a banner at all — the seed or the room never loaded, not a finding.');
  process.exit(2);
}

console.log(`\n${RALLY_STAGES.length} stages rendered · banners seen ${bannersSeen}/4 expected`);
if (failures.length) {
  console.error(`🔴 ${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('rally ladder: all five stages behave as designed.');
