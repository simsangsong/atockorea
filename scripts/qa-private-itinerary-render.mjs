/**
 * Real-render check for the private-charter itinerary area.
 *
 * A headless Chromium composites frames, so lazy images load and React
 * hydrates — neither is true in a backgrounded pane tab, where an unhydrated
 * tab click looks exactly like a broken tab switch.
 *
 * Run: `node scripts/qa-private-itinerary-render.mjs <out-dir>` against a dev
 * server on :3180.
 *
 * ⚠ The bundle registry loads JSON through cached `import()`, so after editing
 * a bundle you MUST restart dev — a running server keeps serving the old
 * durations and prices, which reads as "the fix did not work".
 *
 * 🔴 Two shapes on these pages, and the check differs:
 *   - Jeju / Seoul-suburbs / Busan have entries in `privateImportedCourses.ts`,
 *     so they render `TourImportedCoursesSection` and mount the sample section
 *     `rulesOnly`. There is NO "Sample Itineraries" heading on those pages.
 *     What this file still owns there is the rules block, so that is what is
 *     asserted: six locales, and the corrected inclusions.
 *   - `incheon-seoul-private-car-shore-excursion-cruise` has no imported
 *     courses, so it still renders the full sample section.
 *
 * No `COVERS` declaration on purpose: `gen-uiux-coverage.mjs` only knows the
 * `app/(app)/tour-mode` surfaces and throws on a declaration outside them.
 * This harness drives `/tour-product/[slug]`, so it lands in that doc's
 * 판정 불가 bucket by construction. A scope mismatch, not a coverage hole.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3180";
const OUT = process.argv[2] ?? ".";

/** Hangul in a non-Korean locale means `pickLocalized` fell through to `ko`. */
const HANGUL = /[가-힣]/;
/** The corrected inclusions line, per locale — parking is inside the fee. */
const PARKING_INCLUDED = {
  ko: /주차료/,
  ja: /駐車料金/,
  zh: /停车费/,
  "zh-TW": /停車費/,
  es: /aparcamiento/i,
  en: /parking/i,
};

const CASES = [
  { slug: "jeju-island-private-car-charter-tour", locale: "zh-TW", imported: true },
  { slug: "jeju-island-private-car-charter-tour", locale: "es", imported: true },
  { slug: "busan-private-car-charter-cruise-shore", locale: "ja", imported: true },
  { slug: "busan-private-car-charter-cruise-shore", locale: "ko", imported: true },
  // ko only, deliberately. On 2026-08-07 this product rendered "404 Page Not
  // Found" on /zh/ and a blank body on /en/ while `tours.is_active` is true —
  // a separate live defect, raised as its own ticket. Adding those locales
  // here would make this harness permanently red for a reason it does not own.
  { slug: "incheon-seoul-private-car-shore-excursion-cruise", locale: "ko", imported: false },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

// The welcome-coupon dialog opens over every page and its overlay swallows all
// clicks, so nothing below the fold is reachable. Mark it dismissed-for-today
// the same way the popup's own close button does, rather than racing it.
// Key + format must match `localDayKey()` in components/welcome/WelcomeCouponPopup
// exactly — it is NOT zero-padded, and a padded value silently fails to suppress.
await page.addInitScript(() => {
  const d = new Date();
  try {
    localStorage.setItem(
      "atoc_welcome_hide_today",
      `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
    );
  } catch {}
});

const errors = [];
const failures = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

for (const c of CASES) {
  const url = `${BASE}/${c.locale}/tour-product/${c.slug}`;
  const tag = `${c.locale} :: ${c.slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  // `domcontentloaded` fires before the RSC payload paints, and a cold dev
  // compile can take a while. Without this the page probes as empty and every
  // assertion below reports a defect that is really a race.
  await page.waitForSelector("h2", { timeout: 90_000 }).catch(() => {});

  // Sections below the fold mount on scroll, so walk the page down first.
  for (let y = 0; y < 14; y++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(200);
  }

  // Without imported courses the whole section lives behind the itinerary view
  // toggle (Standard | Sample) and renders with `hidden` until the guest
  // switches — a check that only looks at the default view reports the section
  // as missing rather than as wrong.
  if (!c.imported) {
    const toggle = page.locator("#sample-itinerary");
    if (await toggle.count()) {
      await toggle.scrollIntoViewIfNeeded({ timeout: 60_000 });
      await toggle.locator("button").last().click({ timeout: 30_000 });
      await page.waitForTimeout(400);
    }
  }

  // The rules block is the one thing this file renders on every charter. Find
  // it by a rule that exists in every config rather than by a heading, so the
  // check survives a heading rename.
  const rules = await page.evaluate(() => {
    const li = [...document.querySelectorAll("li")].filter((el) => {
      const t = (el.textContent || "").trim();
      return t.length > 12 && t.length < 400;
    });
    const block = li.find((el) => /Included in the price|요금에 포함|料金に含まれる|费用包含|費用包含|Incluido en el precio/.test(el.textContent || ""));
    if (!block) return null;
    const ul = block.closest("ul");
    return ul ? [...ul.querySelectorAll("li")].map((x) => (x.textContent || "").replace(/\s+/g, " ").trim()) : null;
  });

  if (!rules) {
    // Say WHY, or the next reader re-derives it. "Not found" has three very
    // different causes here: the page never rendered the section, the section
    // rendered under a different shape, or the page is not this template.
    const why = await page.evaluate(() => ({
      finalUrl: location.pathname,
      h2s: [...document.querySelectorAll("h2")].map((h) => (h.textContent || "").trim()).slice(0, 12),
      sampleAnchor: !!document.querySelector("#sample-itinerary"),
      itinerarySection: !!document.querySelector("#itinerary"),
      liCount: document.querySelectorAll("li").length,
      bodyText: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 220),
    }));
    failures.push(`${tag}: rules block not found`);
    console.log(`\n=== ${tag}\n   rules block: NOT FOUND`);
    console.log(`   ${JSON.stringify(why)}`);
    continue;
  }

  const blob = rules.join(" ");
  const hangulLeak = c.locale !== "ko" && HANGUL.test(blob);
  const parkingOk = PARKING_INCLUDED[c.locale].test(blob);
  if (hangulLeak) failures.push(`${tag}: Hangul leaked into the ${c.locale} rules`);
  if (!parkingOk) failures.push(`${tag}: parking not listed as included`);

  // `durations[0]` leads the sticky bar, so a retired tier does not just sit in
  // a list. Read it from the rendered picker: `pricingTiers` comes from the DB
  // when the row has one and from the bundle only when it does not.
  const fourHour = await page.evaluate(() => {
    const re = /^\s*4\s*(h|시간|小时|小時|時間|horas?)\s*$/i;
    return [...document.querySelectorAll("button, option, label")]
      .map((el) => (el.textContent || "").trim())
      .filter((t) => t.length <= 8 && re.test(t));
  });
  if (fourHour.length) failures.push(`${tag}: retired 4h option still offered ${JSON.stringify(fourHour)}`);

  // Imported-course pages must show the real course switch; the one page
  // without imported courses must still show its own sample section.
  const importedPills = await page.locator('[data-testid="imported-course-pill"], [role="tab"]').count();

  const file = `${OUT}/private-${c.slug.slice(0, 14)}-${c.locale}.png`;
  await page.screenshot({ path: file, fullPage: false });

  console.log(`\n=== ${tag}`);
  console.log(`   shape: ${c.imported ? "imported courses + rulesOnly" : "sample itineraries"}`);
  console.log(`   rules: ${rules.length} lines · hangul leak: ${hangulLeak ? "YES" : "no"} · parking included: ${parkingOk ? "yes" : "NO"}`);
  console.log(`   retired 4h option: ${fourHour.length ? JSON.stringify(fourHour) : "no"}`);
  console.log(`   tab/pill controls on page: ${importedPills}`);
  console.log(`   shot: ${file}`);
}

console.log(`\nconsole/page errors: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log(`   ${e.slice(0, 160)}`);

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`   ✗ ${f}`);
}
await browser.close();
process.exitCode = failures.length ? 1 : 0;
