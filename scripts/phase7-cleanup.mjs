/**
 * Tour-content Phase 7 EN — DMZ 220→150m + typos + DMZ refund tone +
 * "? photo" encoding cleanup + Silla Gold Crowns stale-exhibition removal +
 * jeju-cruise lunch inclusions wording.
 *
 * Surgical literal-string swaps per the master plan §7 punch list. Each
 * needle is verified before swap; the file's JSON.parse round-trip is
 * verified after the rewrite hits disk. EN-only per Phase 5a/5b pattern.
 *
 * Memory rule `feedback_data_preservation`: additive-only by default, but
 * the master plan explicitly authorized surgical corrections for this
 * track. Each removal is documented with its rationale inline below.
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/Users/sangsong/atockorea-content-fix/components/product-tour-static";

const EDITS = [
  // ─── DMZ Gamaksan Red Suspension Bridge: 220m → 150m (Source: VisitKorea) ──
  {
    slug: "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    needles: [
      [
        "220m Gamaksan Red Suspension Bridge",
        "150m Gamaksan Red Suspension Bridge",
      ],
      [
        "Gamaksan Red Suspension Bridge — 220 meters, Korea's longest red suspension bridge",
        "Gamaksan Red Suspension Bridge — 150 meters, Korea's longest red suspension bridge",
      ],
    ],
  },

  // ─── DMZ refund tone: rewrite the "no refund" / "no passport" notes ──────
  // Master plan §6.3 Phase 7: substance preserved (passport IS required,
  // military access changes ARE real), only tone softened to align with
  // standard cancellation policy framing.
  {
    slug: "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    needles: [
      [
        "Bring your physical passport. No passport, no DMZ entry, no refund. On Mondays, the 3rd Tunnel route is closed; the 2nd Tunnel may be substituted depending on military access. Last-minute military-driven access changes do not qualify for a refund; the driver-guide will offer the closest alternative on the day.",
        "Bring your physical passport — DMZ entry requires it. If you forget your passport on the day, the tour will substitute the closest accessible alternative (non-DMZ Paju area attractions); refunds for guest-caused issues follow the standard cancellation policy. On Mondays, the 3rd Tunnel route is closed; the 2nd Tunnel may be substituted depending on military access. Last-minute military-driven access changes are handled by the driver-guide with the closest alternative; the standard cancellation policy still governs the booking.",
      ],
    ],
  },

  // ─── east-signature-nature-core: "A easy" → "An easy" ─────────────────────
  {
    slug: "east-signature-nature-core",
    needles: [["A easy-to-follow East Jeju day route", "An easy-to-follow East Jeju day route"]],
  },

  // ─── jeju-cherry-blossom-tour-east-route: "the our ... tour tour" → "our" ─
  {
    slug: "jeju-cherry-blossom-tour-east-route",
    needles: [
      [
        "What's the difference vs the our year-round Eastern UNESCO tour tour?",
        "What's the difference vs our year-round Eastern UNESCO tour?",
      ],
    ],
  },

  // ─── ? photo encoding (Osulloc Tea Museum captions, em-dash was mojibake) ─
  {
    slug: "jeju-hydrangea-festival-tour-southwest-route",
    needles: [
      ["Tea Museum & Tea Fields ? photo", "Tea Museum & Tea Fields — photo"],
      ["Tea Museum & Tea Fields ? photo", "Tea Museum & Tea Fields — photo"], // safety dup
    ],
  },
  { slug: "jeju-southern-top-unesco-spots-tour", needles: [["? photo", "— photo"]] },
  { slug: "jeju-west-south-full-day-authentic-tour", needles: [["? photo", "— photo"]] },
  { slug: "southwest-hallasan-osulloc-aewol", needles: [["? photo", "— photo"]] },

  // ─── Silla Gold Crowns: stale exhibition (Oct 28 – Dec 14, 2025) ─────────
  // The exhibition ended; lines reference it in present-tense (description +
  // highlight + matching reasoning). Remove the stale sentence. The
  // surrounding museum description stays.
  {
    slug: "from-busan-gyeongju-ancient-capital-day-tour",
    needles: [
      // description (L501) and matching reasoning (L1868) carry the same sentence.
      [
        "The museum's **2025 special exhibition 'Silla Gold Crowns: Power and Prestige' (Oct 28 – Dec 14, 2025)** — held to commemorate the **2025 APEC Summit hosted in Gyeongju** — reunited **all 6 Silla gold crowns for the first time in 104 years** (since the original 1921 excavations). \\n\\n",
        "",
      ],
      [
        "The museum's **2025 special exhibition 'Silla Gold Crowns: Power and Prestige' (Oct 28 – Dec 14, 2025)** — held to commemorate the **2025 APEC Summit hosted in Gyeongju** — reunited **all 6 Silla gold crowns for the first time in 104 years** (since the original 1921 excavations). ",
        "",
      ],
      // Standalone highlight line — drop it from the array (comma + literal).
      [
        ',\n        "**2025 special exhibition** reunited all 6 Silla gold crowns for first time in 104 years (APEC commemoration)"',
        "",
      ],
    ],
  },

  // ─── jeju-cruise lunch wording in inclusions list ────────────────────────
  // Currently "Lunch (pay direct at restaurant)" sits inside the inclusions
  // array — a contradiction (it's not actually included). Rewrite to make
  // the own-expense status explicit without restructuring the schema.
  {
    slug: "jeju-cruise-shore-excursion-bus-tour",
    needles: [["Lunch (pay direct at restaurant)", "Lunch break — own expense at local restaurant (₩10–15k)"]],
  },
  {
    slug: "jeju-cruise-shore-excursion-small-group-tour",
    needles: [["Lunch (pay direct at restaurant)", "Lunch break — own expense at local restaurant (₩10–15k)"]],
  },
];

let total = 0;
const touched = new Set();
for (const { slug, needles } of EDITS) {
  const path = `${ROOT}/${slug}/${slug}.en.json`;
  let txt = readFileSync(path, "utf8");
  let local = 0;
  for (const [needle, replacement] of needles) {
    if (!txt.includes(needle)) {
      console.log(`  ${slug}: needle not found — "${needle.slice(0, 50)}…"`);
      continue;
    }
    const before = txt;
    txt = txt.split(needle).join(replacement);
    if (before !== txt) {
      const swaps = (before.length - txt.length) / Math.max(needle.length - replacement.length, 1);
      console.log(`  ${slug}: swapped "${needle.slice(0, 50)}…" (${Math.abs(swaps) || "≥1"})`);
      local++;
    }
  }
  if (local > 0) {
    try {
      JSON.parse(txt);
    } catch (e) {
      throw new Error(`${slug}: JSON parse failed after edits — ${e.message}`);
    }
    writeFileSync(path, txt, "utf8");
    touched.add(slug);
    total += local;
  }
}

console.log(`\ntotal needles applied: ${total} across ${touched.size} slug(s)`);
