/**
 * Standing guards over the authored tour-product JSON bundles.
 *
 * Both defects here shipped to guests and were only caught by someone looking
 * at a phone screenshot:
 *
 *  1. The translation pass wrote its own commentary into display strings
 *     ("출발 전 12시간 > **Notes:** Items 20, 23, and 26 (`bg-emerald-50/80` …)
 *     are CSS class names and have been left untranslated…"). It rendered under
 *     "예약 후 안내" on the Traditional-Chinese page.
 *  2. Charters offered a 4-hour booking that is no longer sold; `durations[0]`
 *     is what the sticky bar defaults to, so the page led with a dead option.
 */
import fs from "node:fs";
import path from "node:path";
import { getPrivateSampleItineraryConfig } from "@/components/product-tour-static/_shared/privateSampleItinerary";

const ROOT = path.join(process.cwd(), "components", "product-tour-static");

type Doc = Record<string, unknown>;

function bundlePaths(): string[] {
  const out: string[] = [];
  for (const dir of fs.readdirSync(ROOT)) {
    const full = path.join(ROOT, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) {
      if (f.endsWith(".json")) out.push(path.join(full, f));
    }
  }
  return out;
}

/** Every string value in the document, with a readable path. */
function strings(node: unknown, at = ""): Array<[string, string]> {
  if (typeof node === "string") return [[at, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${at}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node as Doc).flatMap(([k, v]) => strings(v, `${at}.${k}`));
  }
  return [];
}

const BUNDLES = bundlePaths();

describe("tour-product JSON content hygiene", () => {
  it("finds bundles to check", () => {
    expect(BUNDLES.length).toBeGreaterThan(50);
  });

  it("no translator meta-note is left inside a display string", () => {
    // A bold run opening with Note/Notes is never authored copy in these
    // bundles — it is always the translation pass talking to itself.
    const NOTE = /\*\*Notes?\b[^*]{0,80}\*\*/;
    const offenders: string[] = [];
    for (const p of BUNDLES) {
      const doc = JSON.parse(fs.readFileSync(p, "utf8")) as Doc;
      for (const [at, s] of strings(doc)) {
        if (NOTE.test(s)) offenders.push(`${path.basename(p)}${at}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no `**english source** → translation` artifact is left in a label", () => {
    // Narrow on purpose: real copy uses the arrow mid-sentence
    // ("**Busan Tower 1973** → rebranded **Busan Diamond Tower 2021**").
    const ARROW = /^\*\*[\x20-\x7e]{1,60}\*\*\s*(?:→|⇒|->)\s*[^*\n→⇒]{1,80}$/;
    const offenders: string[] = [];
    for (const p of BUNDLES) {
      const doc = JSON.parse(fs.readFileSync(p, "utf8")) as Doc;
      for (const [at, s] of strings(doc)) {
        if (ARROW.test(s.trim())) offenders.push(`${path.basename(p)}${at} :: ${s}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every sample-itinerary photo exists on disk", () => {
    // A typo'd path renders as a broken tile in the one section whose whole job
    // is showing the guest what the day looks like.
    const slugs = [
      "jeju-island-private-car-charter-tour",
      "busan-private-car-charter-cruise-shore",
      "seoul-suburbs-private-chartered-car-10hr",
      "incheon-seoul-private-car-shore-excursion-cruise",
    ];
    const missing: string[] = [];
    for (const slug of slugs) {
      const cfg = getPrivateSampleItineraryConfig(slug);
      for (const sample of cfg?.samples ?? []) {
        for (const slot of sample.slots) {
          if (!slot.image) continue;
          const onDisk = path.join(process.cwd(), "public", slot.image);
          if (!fs.existsSync(onDisk)) missing.push(`${slug}/${sample.id} :: ${slot.image}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("charter pricing starts at 5 hours", () => {
    const offenders: string[] = [];
    for (const p of BUNDLES) {
      const doc = JSON.parse(fs.readFileSync(p, "utf8")) as Doc;
      const tiers = doc.pricingTiers as
        | { durations?: string[]; tiers?: Array<{ prices?: Record<string, number> }> }
        | undefined;
      if (!tiers?.durations) continue;
      if (tiers.durations.includes("4h")) offenders.push(`${path.basename(p)} durations`);
      for (const t of tiers.tiers ?? []) {
        if (t.prices && "4h" in t.prices) offenders.push(`${path.basename(p)} tier prices`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
