/**
 * Phase 7.5c — User directive 2026-05-23: jeju-grand-highlights-loop and
 * east-signature-nature-core are small-group day tours. Their detail pages
 * already carry "Small Group Day Tour" prominently, but catalog_card.badges
 * (the slim array the catalog generator + shelves matcher consume) was
 * missing the small-group marker.
 *
 * Prepend a locale-specific small-group badge to each tour's catalog_card.
 * badges array, so the shelves matcher (which now reads the multi-locale
 * SMALL_GROUP_BADGE_RE) catches them on every locale.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SLUGS = ["jeju-grand-highlights-loop", "east-signature-nature-core"];
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const BADGE_FOR_LOCALE = {
  en: "Small group",
  ko: "소그룹",
  ja: "スモールグループ",
  zh: "小团",
  "zh-TW": "小團體",
  es: "Grupo pequeño",
};

for (const slug of SLUGS) {
  for (const loc of LOCALES) {
    const path = `C:/Users/sangsong/atockorea-shelves/components/product-tour-static/${slug}/${slug}.${loc}.json`;
    const raw = readFileSync(path, "utf8");
    const j = JSON.parse(raw);
    if (!j.catalog_card) continue;
    const badges = Array.isArray(j.catalog_card.badges) ? [...j.catalog_card.badges] : [];
    const wanted = BADGE_FOR_LOCALE[loc];
    if (badges.includes(wanted)) {
      console.log(`  skip ${slug} ${loc} — already has "${wanted}"`);
      continue;
    }
    j.catalog_card.badges = [wanted, ...badges];
    writeFileSync(path, JSON.stringify(j, null, 2) + "\n", "utf8");
    console.log(`  ${slug} ${loc} → prepended "${wanted}"`);
  }
}
