/**
 * qa-cjk-render — does the CJK invariant hold ON SCREEN, and what did enforcing
 * it cost in layout?
 *
 * Every previous X1 pass judged this from source: a class is present, therefore
 * the text is safe. That is a claim about code, not about rendering. This walks
 * real pages in a real engine and asks the invariant directly:
 *
 *   for every text node containing CJK, did a line break land BETWEEN two CJK
 *   characters with no space between them?
 *
 * That is CLAUDE.md P1-5 stated as a measurement. It needs no heuristic about
 * which elements are "controls" and it cannot be satisfied by adding a class to
 * the wrong element.
 *
 * The same pass measures the cost, because `word-break: keep-all` raises a CJK
 * run's min-content width from one glyph to its longest 어절 (measured 14px →
 * 70px for 가이드에게 가기) and anything sized by its content can get wider:
 * horizontal overflow, at the document and at the element.
 *
 * A/B in one page load: the built CSS is the "after"; injecting a revert
 * stylesheet on `html` gives the "before", since inheritance only reaches
 * elements that declare nothing themselves — which is exactly the population
 * the default is aimed at. Elements carrying `.text-cjk-safe`/`.text-cjk-body`
 * keep their own value in both passes, so they neither flatter nor pollute it.
 *
 * Usage:
 *   1) dev server   2) ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
 *   3) WALK_BASE=http://localhost:3181 node scripts/qa-cjk-render.mjs
 * Exits 2 if a page could not be reached — a run that silently skips pages
 * reports a cheerful zero.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

/** U1 coverage contract — read by scripts/gen-uiux-coverage.mjs. */
// (also walks /admin/orders and /admin/guides — the coverage grid counts tour-mode surfaces only)
export const COVERS = ['/tour-mode/room/[bookingId]', '/tour-mode/guide'];

const BASE = process.env.WALK_BASE ?? 'http://localhost:3161';
const fx = JSON.parse(readFileSync('scripts/.sim-fixtures.json', 'utf8'));

const REVERT = `html{word-break:normal!important;overflow-wrap:normal!important}
td,th{overflow-wrap:normal!important}`;

/**
 * The cell companion is a genuine trade, so it is measured rather than argued:
 * `anywhere` lets a column shrink back to its old width, which also lets a
 * narrow cell break a CJK run mid-syllable again. Dropping it protects the run
 * and widens the table. This override reproduces "no companion" in the same
 * page load.
 */
const NO_CELL_COMPANION = `td,th{overflow-wrap:break-word!important}`;

/** Runs in the page. Returns the invariant count + the layout cost. */
const measure = () => {
  const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ]/;
  const samples = [];
  let broken = 0;
  let scanned = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue ?? '';
    if (text.length < 2 || text.length > 400 || !CJK.test(text)) continue;
    range.selectNodeContents(node);
    if (range.getClientRects().length < 2) continue; // single line — cannot have broken
    scanned += 1;
    let prevTop = null;
    for (let i = 0; i < text.length; i += 1) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (prevTop !== null && r.top > prevTop + 1) {
        const prev = text[i - 1];
        const cur = text[i];
        // A break here is legal if it sits at whitespace; illegal if it splits
        // two adjacent CJK characters — that is the vertical collapse.
        if (prev && !/\s/.test(prev) && !/\s/.test(cur) && CJK.test(prev) && CJK.test(cur)) {
          broken += 1;
          if (samples.length < 6) {
            samples.push(`${text.slice(Math.max(0, i - 8), i)}⏎${text.slice(i, i + 8)}`);
          }
        }
      }
      prevTop = r.top;
    }
  }

  const de = document.documentElement;
  let overflowing = 0;
  const overflowSamples = [];
  for (const el of document.querySelectorAll('*')) {
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox === 'auto' || ox === 'scroll') continue; // scrolling on purpose
    overflowing += 1;
    if (overflowSamples.length < 5) {
      overflowSamples.push(
        `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${el.scrollWidth}>${el.clientWidth}`,
      );
    }
  }
  return {
    broken,
    scanned,
    samples,
    docOverflow: de.scrollWidth > de.clientWidth,
    docScroll: de.scrollWidth,
    docClient: de.clientWidth,
    overflowing,
    overflowSamples,
  };
};

const PAGES = [
  { name: 'guest room', url: fx.room1Url, mobile: true },
  { name: 'guide console', url: fx.guideUrl, mobile: true },
  { name: 'ops center', url: '/tour-ops', mobile: false, admin: true },
  { name: 'admin orders', url: '/admin/orders', mobile: false, admin: true },
  { name: 'admin guides', url: '/admin/guides', mobile: false, admin: true },
  { name: 'public home (ko)', url: '/ko', mobile: true },
  { name: 'public tours (ko)', url: '/ko/tours/list', mobile: true },
];

const browser = await chromium.launch();

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
  return parts.map((c) => ({
    ...c,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }));
};

let unreachable = 0;
const rows = [];

for (const p of PAGES) {
  const ctx = await browser.newContext({
    viewport: p.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    isMobile: p.mobile,
    hasTouch: p.mobile,
    deviceScaleFactor: 1,
  });
  await ctx.addInitScript(() => {
    const apply = () => {
      const el = document.createElement('style');
      el.textContent = 'nextjs-portal{display:none!important}';
      document.head?.appendChild(el);
    };
    if (document.head) apply();
    else document.addEventListener('DOMContentLoaded', apply);
  });
  if (p.admin) await ctx.addCookies(adminCookies());
  const page = await ctx.newPage();
  try {
    // Progress goes to stderr as it happens. A harness that prints nothing for
    // half an hour cannot be told apart from a hung one — this one was, once.
    const t0 = Date.now();
    const step = (s) => process.stderr.write(`   ${p.name}: ${s} (+${Math.round((Date.now() - t0) / 1000)}s)\n`);
    step('loading');
    await page.goto(BASE + p.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // ⚠ A fixed wait is not enough for the table pages: one run caught
    // /admin/orders with 15 CJK text nodes and the next with 1, because the rows
    // arrive from an API after mount. A page measured before its content exists
    // reports a cheerful zero, which is the failure mode this whole harness is
    // supposed to avoid — so wait for the network to settle, then a beat more.
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    step('measuring after');
    const after = await page.evaluate(measure);
    await page.addStyleTag({ content: NO_CELL_COMPANION });
    await page.waitForTimeout(400);
    step('measuring no-cell-rule');
    const noCells = await page.evaluate(measure);
    await page.addStyleTag({ content: REVERT });
    await page.waitForTimeout(400);
    step('measuring before');
    const before = await page.evaluate(measure);
    step(`done — broken ${before.broken}→${after.broken}`);
    rows.push({ name: p.name, before, after, noCells });
  } catch (error) {
    unreachable += 1;
    console.error(`🔴 ${p.name} — ${String(error).slice(0, 140)}`);
  }
  await ctx.close();
}
await browser.close();

console.log('\n== P1-5 invariant: line breaks landing BETWEEN two CJK characters ==');
console.log('   (lower is better; 0 means the invariant holds on that screen)\n');
console.log(`   ${'screen'.padEnd(20)} ${'before'.padStart(7)} ${'after'.padStart(7)} ${'no-cell-rule'.padStart(13)}   nodes`);
for (const r of rows) {
  const arrow = r.after.broken < r.before.broken ? ' ✅' : r.after.broken > r.before.broken ? ' 🔴' : '';
  console.log(
    `   ${r.name.padEnd(20)} ${String(r.before.broken).padStart(7)} ${String(r.after.broken).padStart(7)} ` +
      `${String(r.noCells.broken).padStart(13)}   ${r.after.scanned}${arrow}`,
  );
}
for (const r of rows) {
  if (r.before.samples.length) console.log(`\n   ${r.name} — broken before: ${r.before.samples.join('  ·  ')}`);
  if (r.after.samples.length) console.log(`   ${r.name} — 🔴 still broken after: ${r.after.samples.join('  ·  ')}`);
}

console.log('\n== the cost: horizontal overflow (keep-all widens min-content) ==\n');
console.log(
  `   ${'screen'.padEnd(20)} ${'doc before'.padStart(12)} ${'doc after'.padStart(11)} ${'doc no-cell'.padStart(12)}   elements b→a→nc`,
);
for (const r of rows) {
  const flag = r.after.overflowing > r.before.overflowing ? ' 🔴' : '';
  console.log(
    `   ${r.name.padEnd(20)} ${String(`${r.before.docScroll}/${r.before.docClient}`).padStart(12)} ` +
      `${String(`${r.after.docScroll}/${r.after.docClient}`).padStart(11)} ` +
      `${String(`${r.noCells.docScroll}/${r.noCells.docClient}`).padStart(12)}   ` +
      `${r.before.overflowing}→${r.after.overflowing}→${r.noCells.overflowing}${flag}`,
  );
}
for (const r of rows) {
  const fresh = r.after.overflowSamples.filter((s) => !r.before.overflowSamples.includes(s));
  if (r.after.overflowing > r.before.overflowing && fresh.length) {
    console.log(`\n   🔴 ${r.name} — newly overflowing: ${fresh.join('  ·  ')}`);
  }
}

// 🔴 "0 broken" and "nothing was there to break" print the same. Say which.
const thin = rows.filter((r) => r.after.scanned < 2);
if (thin.length) {
  console.log('\n   ⚠ measured with almost no multi-line CJK on screen — a zero here proves little:');
  for (const r of thin) console.log(`     ${r.name} (${r.after.scanned} wrapping CJK node(s))`);
}

const totalBefore = rows.reduce((n, r) => n + r.before.broken, 0);
const totalAfter = rows.reduce((n, r) => n + r.after.broken, 0);
const overflowBefore = rows.reduce((n, r) => n + r.before.overflowing, 0);
const overflowAfter = rows.reduce((n, r) => n + r.after.overflowing, 0);
console.log(`\n   TOTAL broken CJK breaks  ${totalBefore} → ${totalAfter}`);
console.log(`   TOTAL overflowing els    ${overflowBefore} → ${overflowAfter}`);

if (unreachable > 0) {
  console.error(`\n🔴 ${unreachable} page(s) unreachable — this run does not prove anything about them.`);
  process.exit(2);
}
