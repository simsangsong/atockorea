// Recover drawer fields (visitBasics / convenience / smartNotes) for tours where
// the data already exists in legacy `page_sections.props.itineraryStops` but is
// missing from top-level `itineraryStops` (which the new template reads).
//
// Match strategy: by stop number. We never overwrite an existing top-level
// field, only fill missing ones.

import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// 12 tours where legacy holds the recoverable drawer data
// (busan-private-car-charter-cruise-shore is excluded — its legacy is route-variant
//  data with different structure, not per-stop info)
const TOURS = [
  "east-signature-nature-core",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-west-south-full-day-authentic-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-cherry-blossom-tour-east-route",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
  "jeju-hydrangea-festival-tour-southwest-route",
  "jeju-grand-highlights-loop",
  "southwest-hallasan-osulloc-aewol",
];

const FIELDS = ["visitBasics", "convenience", "smartNotes"];

let totalFilesTouched = 0;
let totalStopsRecovered = 0;

for (const slug of TOURS) {
  for (const L of LOCALES) {
    const path = `components/product-tour-static/${slug}/${slug}.${L}.json`;
    const json = JSON.parse(readFileSync(path, "utf-8"));
    const top = json.itineraryStops || [];
    const itinerarySection = (json.page_sections || []).find((s) => s.id === "itinerary");
    const legacy = itinerarySection?.props?.itineraryStops || [];
    if (legacy.length === 0) continue;

    let stopsTouchedThisFile = 0;
    for (const ts of top) {
      const ls = legacy.find((l) => l.number === ts.number);
      if (!ls) continue;
      let touched = false;
      for (const field of FIELDS) {
        // Only fill missing — never overwrite an existing top-level field
        if (!ts[field] && ls[field]) {
          ts[field] = ls[field];
          touched = true;
        }
      }
      if (touched) stopsTouchedThisFile++;
    }
    if (stopsTouchedThisFile > 0) {
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf-8");
      totalFilesTouched++;
      totalStopsRecovered += stopsTouchedThisFile;
    }
  }
  console.log(`✓ ${slug} — processed`);
}

console.log("---");
console.log(`files written: ${totalFilesTouched}`);
console.log(`total stop-recoveries: ${totalStopsRecovered}`);
