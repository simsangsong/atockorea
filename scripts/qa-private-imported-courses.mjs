#!/usr/bin/env node
/**
 * Does the private-charter itinerary section actually SHOW its imported course?
 *
 * 🔴 Why this exists as a script and not a browser check. The in-app browser
 * pane renders a hidden tab: `document.hidden === true`, React never hydrates,
 * `TourImportedCoursesSection` stays on its loading skeleton forever, and a
 * clicked pill does nothing. Read that way it looks exactly like a broken
 * feature. It is not — it is the recorded hidden-tab false alarm
 * (`reference_react_hidden_tab_hydration`). Playwright gives a visible page,
 * so a skeleton here means a skeleton for a guest.
 *
 * The section loads the course bundle client-side by slug, so server HTML never
 * contains it — only a real, hydrated, visible render can answer this.
 *
 *   node scripts/qa-private-imported-courses.mjs [--base http://localhost:3182]
 *
 * exit 0 = every charter showed a course; 1 = at least one stuck or empty;
 * 2 = the harness could not measure (server down, no charter pages) — never
 * report a cheerful zero when nothing was measured.
 */
import { chromium } from "playwright";

const baseArg = process.argv.indexOf("--base");
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : "http://localhost:3182";

/** Charter pages that import courses, and how many pills each should offer. */
const PAGES = [
  { slug: "jeju-island-private-car-charter-tour", pills: 3 },
  { slug: "busan-private-car-charter-cruise-shore", pills: 5 },
  { slug: "busan-private-car-charter-city-tour", pills: 4 },
  { slug: "incheon-seoul-private-car-shore-excursion-cruise", pills: 1 },
  { slug: "seoul-suburbs-private-chartered-car-10hr", pills: 2 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// The welcome popup overlays the page and swallows clicks.
await ctx.addInitScript(() => {
  const d = new Date();
  localStorage.setItem("atoc_welcome_hide_today", `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
});

let measured = 0;
const rows = [];

for (const page of PAGES) {
  const p = await ctx.newPage();
  let res;
  try {
    res = await p.goto(`${BASE}/tour-product/${page.slug}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (e) {
    rows.push({ slug: page.slug, verdict: "UNREACHABLE", detail: String(e).slice(0, 80) });
    await p.close();
    continue;
  }
  if (!res || res.status() >= 400) {
    rows.push({ slug: page.slug, verdict: "UNREACHABLE", detail: `HTTP ${res?.status()}` });
    await p.close();
    continue;
  }

  const section = p.locator("[data-testid=imported-courses-section]");
  if ((await section.count()) === 0) {
    rows.push({ slug: page.slug, verdict: "NO SECTION", detail: "charter does not import courses" });
    await p.close();
    continue;
  }

  // Give the lazy bundle chunk time to compile in dev and resolve.
  await p
    .locator("[data-testid=imported-courses-section] [data-testid=tour-timeline-section], [data-testid=imported-courses-section] .animate-pulse")
    .first()
    .waitFor({ timeout: 45_000 })
    .catch(() => {});
  await p.waitForTimeout(3_000);

  const state = await p.evaluate(() => {
    const s = document.querySelector("[data-testid=imported-courses-section]");
    if (!s) return null;
    const text = s.innerText.replace(/\s+/g, " ").trim();
    return {
      hidden: document.hidden,
      skeletons: s.querySelectorAll(".animate-pulse").length,
      pills: s.querySelectorAll("button[role=radio], [role=radiogroup] button").length,
      // A rendered course timeline puts stop headings inside the section.
      headings: [...s.querySelectorAll("h3, h4")].map((h) => h.textContent.trim()).filter(Boolean).slice(0, 8),
      chars: text.length,
    };
  });

  measured += 1;
  const ok = state && state.skeletons === 0 && state.headings.length > 0;
  rows.push({
    slug: page.slug,
    verdict: ok ? "SHOWS COURSE" : state?.skeletons ? "STUCK ON SKELETON" : "EMPTY",
    detail: state
      ? `hidden=${state.hidden} pills=${state.pills} skeletons=${state.skeletons} chars=${state.chars} first=${state.headings[0] ?? "—"}`
      : "no section",
  });
  await p.close();
}

await browser.close();

for (const r of rows) console.log(`${r.verdict.padEnd(19)} ${r.slug.slice(0, 48).padEnd(50)} ${r.detail}`);

if (measured === 0) {
  console.error(`\n🔴 measured nothing — is the dev server up at ${BASE}?`);
  process.exit(2);
}
const bad = rows.filter((r) => r.verdict === "STUCK ON SKELETON" || r.verdict === "EMPTY");
console.log(`\n${measured} charter page(s) measured, ${bad.length} not showing a course`);
process.exit(bad.length ? 1 : 0);
