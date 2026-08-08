#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(scriptDir, "..");
const sourceRoot = path.join(repo, "components", "product-tour-static");

const slugs = [
  "jeju-grand-highlights-loop",
  "jeju-cruise-shore-excursion-small-group-tour",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "busan-top-attractions-day-tour",
  "southwest-hallasan-osulloc-aewol",
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip",
  "seoul-seoraksan-nami-island-morning-calm-day-tour",
  "seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour",
  "busan-cruise-shore-excursion-bus-tour",
  "busan-private-car-charter-cruise-shore",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "busan-small-group-yonggungsa-skycapsule-gamcheon-tour",
  "busan-private-car-charter-city-tour",
  "jeju-island-private-car-charter-tour",
  "seoul-suburbs-private-chartered-car-10hr",
  "from-busan-gyeongju-ancient-capital-day-tour",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-southern-top-unesco-spots-tour",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
  "seoul-suwon-hwaseong-waujeongsa-starfield",
];

async function updateSlug(slug) {
  const dir = path.join(sourceRoot, slug);
  const files = (await fs.readdir(dir)).filter(
    (file) => file.startsWith(`${slug}.`) && file.endsWith(".json"),
  );
  const thumbnail = `/images/tours/catalog-thumbnails/${slug}-premium-v2.webp`;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = await fs.readFile(filePath, "utf8");
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const data = JSON.parse(raw);
    if (!data.catalog_card) {
      throw new Error(`Missing catalog_card in ${filePath}`);
    }
    data.catalog_card.heroImage = thumbnail;
    data.catalog_card.thumbnail = thumbnail;
    const formatted = `${JSON.stringify(data, null, 2)}\n`.replaceAll("\n", eol);
    await fs.writeFile(filePath, formatted, "utf8");
  }

  console.log(`[thumbnail-data] ${slug}: ${files.length} locales`);
  return files.length;
}

async function main() {
  let updated = 0;
  for (const slug of slugs) updated += await updateSlug(slug);
  console.log(`[thumbnail-data] updated ${updated} localized product files`);
}

main().catch((error) => {
  console.error("[thumbnail-data] failed", error);
  process.exitCode = 1;
});
