/**
 * Real-render check for the private-charter "Sample Itineraries" section.
 * A headless Chromium composites frames, so lazy images load and React hydrates
 * — neither is true in a backgrounded pane tab.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3180";
const OUT = process.argv[2] ?? ".";

const CASES = [
  { slug: "jeju-island-private-car-charter-tour", locale: "zh-TW", heading: /範例行程/, tab: "南部" },
  { slug: "busan-private-car-charter-cruise-shore", locale: "ja", heading: /サンプル行程/, tab: "慶州" },
  { slug: "jeju-island-private-car-charter-tour", locale: "es", heading: /Itinerarios de ejemplo/, tab: "Jeju Suroeste" },
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
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

for (const c of CASES) {
  const url = `${BASE}/${c.locale}/tour-product/${c.slug}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });

  await page.waitForTimeout(1200);
  const overlay = page.locator('[data-slot="dialog-overlay"]');
  const popupText = (await overlay.count())
    ? (await page.locator('[role="dialog"]').first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 60)
    : null;

  // Sections below the fold mount on scroll, so walk the page down first —
  // otherwise the heading exists in the tree but no copy is ever visible.
  for (let y = 0; y < 14; y++) {
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(220);
  }

  // The section sits behind the itinerary view toggle (Standard | Sample) and
  // renders with `hidden` until the guest switches. Anything that only checks
  // the default view will report this section as missing, not as wrong.
  const toggle = page.locator("#sample-itinerary");
  await toggle.scrollIntoViewIfNeeded({ timeout: 60_000 });
  const options = toggle.locator("button");
  const optionLabels = await options.allInnerTexts();
  await options.last().click({ timeout: 30_000 });
  await page.waitForTimeout(400);

  // The detail page renders the section twice (desktop rail + mobile stack) and
  // hides one with CSS. Screenshotting the hidden copy yields a blank image, so
  // take whichever one the viewport is actually showing.
  const all = page.locator("h2").filter({ hasText: c.heading });
  await all.first().waitFor({ state: "attached", timeout: 90_000 });
  let h2 = null;
  for (let i = 0; i < (await all.count()); i++) {
    if (await all.nth(i).isVisible()) { h2 = all.nth(i); break; }
  }
  if (!h2) throw new Error(`${c.locale} ${c.slug}: heading present but no visible copy`);
  await h2.scrollIntoViewIfNeeded({ timeout: 60_000 });
  const section = h2.locator("xpath=../..");

  // Tab switch — proves the section is hydrated and every course is reachable.
  const tab = section.getByRole("tab", { name: c.tab, exact: true });
  const firstBefore = (await section.innerText()).slice(0, 400);
  await tab.click({ timeout: 30_000 });
  await page.waitForTimeout(600);
  const selected = await tab.getAttribute("aria-selected");
  const firstAfter = (await section.innerText()).slice(0, 400);

  // Every stop photo must actually decode — a 404 would render blank.
  await page.waitForTimeout(1200);
  const imgs = await section.locator("img").evaluateAll((els) =>
    els.map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth })),
  );

  const file = `${OUT}/private-${c.slug.slice(0, 12)}-${c.locale}.png`;
  await section.screenshot({ path: file });

  console.log(`\n=== ${c.locale} :: ${c.slug}`);
  console.log(`   welcome popup: ${popupText === null ? "(none)" : JSON.stringify(popupText)}`);
  console.log(`   view toggle: ${JSON.stringify(optionLabels)}`);
  console.log(`   tab "${c.tab}" aria-selected=${selected}  contentChanged=${firstBefore !== firstAfter}`);
  console.log(`   images: ${imgs.length}, broken(naturalWidth=0): ${imgs.filter((i) => !i.w).length}`);
  for (const i of imgs.filter((x) => !x.w)) console.log(`      BROKEN ${i.src}`);
  console.log(`   shot: ${file}`);
}

console.log(`\nconsole/page errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log(`   ${e.slice(0, 200)}`);
await browser.close();
