// Backfill ES glanceItems for the 12 tours that already had star-bar in
// en/ko/ja/zh/zh-TW but were missed for ES. Mirror each tour's EN levels +
// canonical ES labels/values from the standard tier dictionary.

import { readFileSync, writeFileSync } from "node:fs";

const TOURS = [
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "busan-top-attractions-day-tour",
  "from-incheon-seoul-day-tour-cruise-guests",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "jeju-grand-highlights-loop",
  "jeju-hydrangea-festival-tour-southwest-route",
  "jeju-island-private-car-charter-tour",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-west-south-full-day-authentic-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
];

const ES_LABELS = {
  camera: "Valor fotográfico",
  mountain: "Densidad escénica",
  footprints: "Caminata",
  "cloud-rain": "Aptitud lluvia",
  users: "Aptitud familia",
  gauge: "Equilibrio",
};

// EN value → ES value (per icon when value is shared label like "High" used by multiple icons)
function translateValue(icon, level, enValue) {
  // Generic ranks (shared across most icons)
  const generic = {
    "Excellent": "Excelente",
    "High": icon === "footprints" ? "Alto" : "Muy alto",
    "Flexible": "Flexible",
    "Good": "Bueno",
    "Balanced": "Equilibrado",
    "Moderate": "Moderado",
    "Focused": "Enfocado",
    "Fast": "Rápido",
    "Low": "Bajo",
  };
  return generic[enValue] ?? enValue;
}

let touched = 0;
for (const slug of TOURS) {
  const enPath = `components/product-tour-static/${slug}/${slug}.en.json`;
  const esPath = `components/product-tour-static/${slug}/${slug}.es.json`;
  const en = JSON.parse(readFileSync(enPath, "utf-8"));
  const es = JSON.parse(readFileSync(esPath, "utf-8"));
  const enGI = en.glanceItems || [];
  if (enGI.length !== 6 || !enGI.every((g) => typeof g.level === "number")) {
    console.log(`! ${slug} — EN doesn't have star-bar schema, skipping`);
    continue;
  }
  es.glanceItems = enGI.map((g) => ({
    icon: g.icon,
    label: ES_LABELS[g.icon] ?? g.label,
    value: translateValue(g.icon, g.level, g.value),
    level: g.level,
  }));
  writeFileSync(esPath, JSON.stringify(es, null, 2) + "\n", "utf-8");
  touched++;
  console.log(`✓ ${slug} — es.glanceItems mirrored from en (level: ${enGI.map((g) => g.level).join(",")})`);
}
console.log(`---\n${touched}/${TOURS.length} ES files updated`);
