#!/usr/bin/env node
/**
 * Re-parse poi-region-audit.csv with WORD-BOUNDARY region inference
 * (the original audit hit a false-positive: "Minsokchon" contained "sokcho"
 * which incorrectly triggered the gangwon branch).
 *
 * Output:
 *   - scripts/region-correction-final.csv (final action per poi)
 *   - Console table of changes only
 *   - scripts/region-correction-final.json (machine-readable for apply step)
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IN_CSV = join(ROOT, "scripts/poi-region-audit.csv");
const OUT_CSV = join(ROOT, "scripts/region-correction-final.csv");
const OUT_JSON = join(ROOT, "scripts/region-correction-final.json");

// Word-boundary regex per region keyword. Tested against tokens joined with " | ".
// Earlier substring matching failed because "Minsokchon-ro" hit /sokcho/.
const REGION_PATTERNS = [
  { region: "jeju", patterns: [/\bjeju\b/i, /\bcheju\b/i, /\bseogwipo\b/i] },
  { region: "busan", patterns: [/\bbusan\b/i] },
  { region: "yangsan", patterns: [/\byangsan\b/i] },
  { region: "gyeongju", patterns: [/\bgyeongju\b/i] },
  { region: "ulsan", patterns: [/\bulju\b/i, /\bulsan\b/i] },
  { region: "miryang", patterns: [/\bmiryang\b/i] },
  // gyeonggi BEFORE seoul because we want admin1 to win
  // (Seoul-region tours visit gyeonggi POIs whose formatted_address sometimes
  // mentions Seoul too; admin1 in audit is authoritative)
  { region: "gyeonggi", patterns: [
    /\bgyeonggi\b/i, /\bpaju\b/i, /\byongin\b/i, /\bsuwon\b/i,
    /\bpocheon\b/i, /\bgapyeong\b/i, /\bgwangmyeong\b/i,
  ]},
  // gangwon — note word boundaries so "minsokchon" doesn't trigger /sokcho/
  { region: "gangwon", patterns: [/\bsokcho\b/i, /\byangyang\b/i, /\bgangwon\b/i, /\binje\b/i, /\bchuncheon\b/i] },
  { region: "seoul", patterns: [/\bseoul\b/i, /서울/] },
  { region: "incheon", patterns: [/\bincheon\b/i] },
];

// Authoritative override: admin1 wins regardless of other keywords.
// This matches Korean administrative reality (e.g., Yongin-si is Gyeonggi-do).
const ADMIN1_TO_REGION = {
  "gyeonggi-do": "gyeonggi",
  "gangwon-do": "gangwon",
  "gangwon special self-governing province": "gangwon",
  "gyeongsangbuk-do": null, // need further locality check (Gyeongju vs other Gyeongsangbuk)
  "gyeongsangnam-do": null, // Yangsan/Miryang/Ulsan vs other
  "jeju-do": "jeju",
  "jeju special self-governing province": "jeju",
  seoul: "seoul",
  "서울특별시": "seoul",
  busan: "busan",
  incheon: "incheon",
  ulsan: "ulsan",
};

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

function inferRegion({ formatted_address, locality, admin1, admin2 }) {
  // Step 1: admin1 has highest authority
  const admin1Lower = (admin1 || "").toLowerCase();
  for (const key of Object.keys(ADMIN1_TO_REGION)) {
    if (admin1Lower === key && ADMIN1_TO_REGION[key]) return ADMIN1_TO_REGION[key];
  }

  // Step 2: For Gyeongsang provinces, decide by locality
  if (admin1Lower === "gyeongsangbuk-do") {
    const loc = (locality || "").toLowerCase();
    const fa = (formatted_address || "").toLowerCase();
    if (/\bgyeongju\b/.test(loc) || /\bgyeongju\b/.test(fa)) return "gyeongju";
    // Fall through to keyword scan
  }
  if (admin1Lower === "gyeongsangnam-do") {
    const loc = (locality || "").toLowerCase();
    const fa = (formatted_address || "").toLowerCase();
    if (/\byangsan\b/.test(loc) || /\byangsan\b/.test(fa)) return "yangsan";
    if (/\bmiryang\b/.test(loc) || /\bmiryang\b/.test(fa)) return "miryang";
    // Fall through
  }

  // Step 3: Word-boundary scan on combined tokens
  const tokens = [formatted_address, locality, admin1, admin2].join(" | ");
  for (const { region, patterns } of REGION_PATTERNS) {
    for (const p of patterns) {
      if (p.test(tokens)) return region;
    }
  }
  return null;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  const e = s.replace(/"/g, '""');
  return /[",\n]/.test(e) ? `"${e}"` : e;
}

function main() {
  const text = readFileSync(IN_CSV, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });

  const result = [];
  const changes = [];
  const reviews = [];
  let keep = 0;
  for (const r of rows) {
    const proposed = inferRegion({
      formatted_address: r.formatted_address,
      locality: r.locality,
      admin1: r.admin1,
      admin2: r.admin2,
    });
    let action;
    if (!proposed) {
      action = "MANUAL_REVIEW";
      reviews.push({ ...r, proposed_region: "" });
    } else if (proposed === r.current_region) {
      action = "KEEP";
      keep++;
    } else {
      action = "CHANGE";
      changes.push({ ...r, proposed_region: proposed });
    }
    result.push({ ...r, proposed_region: proposed || "", action_v2: action });
  }

  console.log(`Total: ${rows.length} | KEEP: ${keep} | CHANGE: ${changes.length} | REVIEW: ${reviews.length}`);
  if (changes.length) {
    console.log("\n=== CHANGES (v2 with word-boundary inference) ===");
    for (const c of changes) {
      console.log(
        `  ${c.poi_key.padEnd(38)} | ${String(c.current_region).padEnd(10)} → ${c.proposed_region.padEnd(10)} | ${c.admin1} / ${c.locality} / ${c.formatted_address.slice(0, 50)}`
      );
    }
  }
  if (reviews.length) {
    console.log("\n=== MANUAL REVIEW ===");
    for (const r of reviews) {
      console.log(`  ${r.poi_key.padEnd(38)} | region:${r.current_region} | ${r.admin1} / ${r.locality} / ${r.formatted_address}`);
    }
  }

  // Final region distribution
  const finalCounts = {};
  for (const r of result) {
    const final = r.proposed_region || r.current_region;
    finalCounts[final] = (finalCounts[final] || 0) + 1;
  }
  console.log("\nFinal region distribution after applying CHANGEs:", finalCounts);

  // Write CSV
  const headers2 = headers.concat(["proposed_region", "action_v2"]);
  const csvLines = [headers2.join(",")].concat(
    result.map((r) => headers2.map((h) => csvEscape(r[h])).join(","))
  );
  writeFileSync(OUT_CSV, csvLines.join("\n"), "utf8");

  // Write JSON proposal
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      { changes: changes.map((c) => ({ poi_key: c.poi_key, current: c.current_region, proposed: c.proposed_region })), reviews, finalCounts },
      null,
      2
    )
  );
  console.log(`\nFiles written: ${OUT_CSV}, ${OUT_JSON}`);
}

main();
