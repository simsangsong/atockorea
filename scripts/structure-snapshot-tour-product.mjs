#!/usr/bin/env node
/**
 * Tour-product structure snapshot (master plan W6 / §F-2 section cap).
 *
 * Counts top-level <section> elements and overlay dialogs in the prerendered
 * HTML of the 4 QA slugs. Guards the IA compression: if a change grows the
 * always-on section count past the cap, --check exits 1.
 *
 * Usage: node scripts/structure-snapshot-tour-product.mjs [--check]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT = join(process.cwd(), ".next");
const SLUGS = [
  "jeju-grand-highlights-loop",
  "jeju-island-private-car-charter-tour",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "seoul-private-nami-morning-calm-petite-france",
];
// §F-2: always-on top-level sections ≤12, ≤14 with conditional ones.
const SECTION_CAP = 14;
const check = process.argv.includes("--check");

let failed = false;
for (const slug of SLUGS) {
  const htmlPath = join(NEXT, "server", "app", "tour-product", `${slug}.html`);
  if (!existsSync(htmlPath)) {
    console.log(`  ${slug}: html not found (build first)`);
    continue;
  }
  const html = readFileSync(htmlPath, "utf8");
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const sections = (main.match(/<section\b/g) || []).length;
  const dialogs = (html.match(/role="dialog"/g) || []).length;
  const over = sections > SECTION_CAP;
  if (over) failed = true;
  console.log(
    `  ${slug}: sections=${sections}${over ? ` > cap ${SECTION_CAP} ❌` : ""} dialogs=${dialogs}`,
  );
}
if (check && failed) {
  console.error(`  STRUCTURE CAP EXCEEDED (cap ${SECTION_CAP})`);
  process.exit(1);
}
