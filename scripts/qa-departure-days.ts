#!/usr/bin/env node
/**
 * Does the booking calendar actually grey out the days the tour does not run?
 *
 *   node --import tsx scripts/qa-departure-days.ts --base=http://localhost:3000
 *
 * 🔴 Reads the rendered calendar, not the API. The route can answer
 * `available:false` correctly while the calendar still offers the day — that
 * gap is the whole reason this harness exists. It opens the real date picker
 * and counts which cells react-datepicker marked disabled.
 *
 * Exits 2 (not 0) when it could not open a calendar at all, so "0 wrong days"
 * can never be reported by a run that never looked at one.
 */
import { chromium, type Page } from 'playwright';
import { getDepartureDays, weekdayOfDateString } from '../lib/tour-departure-days';

const argv = process.argv.slice(2);
const flag = (n: string, d: string): string => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const SLUGS = (flag('slugs', 'pocheon-sanjeong-lake-herb-island-art-valley')).split(',').filter(Boolean);

/**
 * `--offline` — run with `/api/tours/.../availability/...` aborted.
 *
 * 🔴 Why this mode exists. The range endpoint applies the departure rule
 * server-side, so a healthy-API run paints the calendar correctly whether or
 * not the product's bundle carries `departureWeekdays`. Measured 2026-08-07:
 * deleting the field from a bundle and restarting dev changed nothing in the
 * default run — this harness reported a clean pass on a product whose bundle
 * field was gone.
 *
 * `loadMonth` fails OPEN (bookingShared.tsx returns early on !res.ok and on
 * throw, leaving nothing blocked), so with the fetch dead the bundle's
 * `filterDate` is the only guard left. Same product, same day, offline: with
 * the field, 10 future days offered and all correct; without it, all 24 —
 * 14 of them non-departure days. That is the gap this mode measures and the
 * default mode cannot see.
 */
const OFFLINE = argv.includes('--offline');

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** "August 2026" → "2026-08-01". Returns null rather than guessing. */
function monthHeaderToDate(header: string): string | null {
  const m = /([A-Za-z]+)\s+(\d{4})/.exec(header.trim());
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]!.toLowerCase());
  if (idx < 0) return null;
  return `${m[2]}-${String(idx + 1).padStart(2, '0')}-01`;
}

async function openCalendar(page: Page): Promise<boolean> {
  // The right-rail booking card renders an `inline` DatePicker, so on lg+ the
  // calendar is already in the DOM — nothing to click. Wait for it rather than
  // assuming: the rail gates its availability fetch on the lg media query, so
  // a narrow viewport would silently give us a calendar with no blackouts.
  const inline = page.locator('.react-datepicker').first();
  try {
    await inline.waitFor({ state: 'attached', timeout: 15_000 });
    return true;
  } catch {
    /* fall through to the drawer path below */
  }
  // Mobile/sticky-bar path: the CTA mounts a picker behind a text field.
  for (const name of [/check availability/i, /select date/i, /book/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      const input = page.locator('.react-datepicker__input-container input').first();
      if (await input.count()) await input.click({ timeout: 5000 }).catch(() => {});
      if (await page.locator('.react-datepicker').count()) return true;
    }
  }
  return false;
}

type Cell = { ymd: string; day: string; disabled: boolean };
type Result = {
  slug: string;
  error?: string;
  month?: string;
  schedule?: ReturnType<typeof getDepartureDays>;
  cells?: Cell[];
};

// tsx transforms these scripts to CJS, where top-level await is a hard error.
async function main(): Promise<number> {
const results: Result[] = [];
/** Availability requests intercepted in `--offline` mode. */
let aborted = 0;
if (OFFLINE) {
  console.log('◆ --offline: 가용성 API 를 끊고 잰다 (번들 departureWeekdays 만 남는 상태)');
}
const browser = await chromium.launch();
try {
  for (const slug of SLUGS) {
    const schedule = getDepartureDays(slug);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const url = `${BASE}/tour-product/${slug}`;
    let opened = false;
    if (OFFLINE) {
      await page.route('**/api/tours/**/availability/**', (route) => {
        aborted += 1;
        return route.abort();
      });
    }
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2500); // let the idle-callback availability fetch land
      opened = await openCalendar(page);
      if (!opened) { results.push({ slug, error: '캘린더를 못 열었다' }); continue; }
      // The availability fetch is kicked on idle; give the disabled classes a beat.
      await page.waitForTimeout(1500);

      const cells = await page.$$eval('.react-datepicker__day', (nodes) =>
        nodes
          .filter((n) => !n.classList.contains('react-datepicker__day--outside-month'))
          .map((n) => ({
            ymd: n.getAttribute('aria-label') || n.textContent || '',
            day: (n.textContent || '').trim(),
            disabled: n.classList.contains('react-datepicker__day--disabled'),
          })),
      );
      const month = await page
        .$eval('.react-datepicker__current-month', (n) => (n.textContent || '').trim())
        .catch(() => '');
      results.push({ slug, month, schedule, cells });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

let bad = 0, checked = 0, blind = 0;
for (const r of results) {
  console.log(`\n━━ ${r.slug} ━━`);
  if (r.error) { console.log(`  ✗ ${r.error}`); blind += 1; continue; }
  if (!r.schedule) { console.log('  (운행 요일 규칙 없는 상품 — 전부 열려 있어야 한다)'); }
  console.log(`  ${r.month} · 규칙 ${r.schedule ? r.schedule.label : '없음'} · 셀 ${r.cells.length}개`);
  if (!r.cells || r.cells.length < 20) { console.log('  ✗ 달력 셀이 너무 적다 — 렌더를 못 읽었다'); blind += 1; continue; }

  // react-datepicker's aria-label is prose ("Choose Thursday, August 6th, 2026")
  // and its exact wording is locale- and version-dependent, so the date comes
  // from the month header plus the cell's own day number instead. Outside-month
  // cells were already dropped when the cells were collected, so a day number
  // here belongs to the displayed month.
  const monthStart = monthHeaderToDate(r.month ?? '');
  if (!monthStart) { console.log(`  ✗ 월 헤더를 못 읽었다: "${r.month}"`); blind += 1; continue; }

  const wrong: string[] = [];
  let futureOpen = 0, futureClosed = 0;
  for (const c of r.cells) {
    const dayNum = parseInt(c.day, 10);
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) continue;
    const iso = `${monthStart.slice(0, 8)}${String(dayNum).padStart(2, '0')}`;
    const wd = weekdayOfDateString(iso);
    if (wd == null) continue;
    checked += 1;
    const shouldRun = !r.schedule || r.schedule.weekdays.includes(wd);
    // Past dates are disabled by the picker's own minDate — not our concern.
    const isPast = iso < new Date().toISOString().slice(0, 10);
    if (isPast) continue;
    if (c.disabled) futureClosed += 1; else futureOpen += 1;
    if (shouldRun && c.disabled) wrong.push(`${iso}(${WEEK[wd]}) 운행일인데 회색`);
    if (!shouldRun && !c.disabled) wrong.push(`${iso}(${WEEK[wd]}) 비운행일인데 선택 가능`);
  }
  // 🔴 양성 대조. "어긋난 날 0" 은 규칙이 먹은 것과 달력을 아예 안 읽은 것을
  // 구별하지 못한다. 운행 요일 규칙이 있는 상품이면 회색이 된 미래 날짜가
  // 반드시 있어야 한다 — 하나도 없으면 그 초록은 공허하다.
  if (r.schedule && futureOpen + futureClosed > 0) {
    console.log(`  미래 ${futureOpen + futureClosed}일 중 선택 가능 ${futureOpen} · 회색 ${futureClosed}`);
    if (futureClosed === 0) {
      console.log('  ✗ 회색이 된 날이 하나도 없다 — 규칙이 달력에 닿지 않았다');
      bad += 1;
    }
  }
  if (!wrong.length && (!r.schedule || futureClosed > 0)) console.log(`  ✓ 미래 날짜 전부 규칙대로다`);
  for (const w of wrong) { console.log(`  ✗ ${w}`); bad += 1; }
}

console.log('\n════ 요약 ════');
console.log(`  판정한 날짜 ${checked} · 어긋난 날짜 ${bad} · 못 읽은 상품 ${blind}`);
if (OFFLINE) {
  console.log(`  끊은 가용성 요청 ${aborted}건`);
  // Same rule as the blind counter: an offline run that never intercepted a
  // request did not test offline behaviour, so its pass means nothing.
  if (aborted === 0) {
    console.log('\n🔴 --offline 인데 가로챈 요청이 0건이다 — 이 실행은 아무것도 증명하지 않는다.');
    return 2;
  }
}
if (blind) { console.log('\n🔴 달력을 못 연 상품이 있다 — 0 을 초록으로 읽지 마라.'); return 2; }
if (!checked) { console.log('\n🔴 아무 날짜도 판정하지 않았다.'); return 2; }
return bad ? 1 : 0;
}

main()
  .then((code) => { process.exit(code); })
  .catch((err) => { console.error(err); process.exit(2); });
