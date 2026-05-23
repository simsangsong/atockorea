// One-off Phase 2 EN sweep: cruise pickup_dropoff → correct cruise terminals.
// Run from repo root: node scripts/phase2-en-cruise.mjs
// Safe to re-run (idempotent: replaces structured pickup_dropoff and FAQ pickup answer).

import fs from "node:fs";
const root = "components/product-tour-static";

// === Canonical cruise terminal entries ===

const JEJU_TERMINALS_DEPARTURE = [
  {
    order: 1,
    time: "Confirmed at booking (≈30 min after ship docking)",
    name: "Jeju International Passenger Terminal (제주항 — north Jeju)",
    type: "cruise_terminal",
    note: "For ships docking at Jeju Port. Meet your guide at the cruise terminal arrival hall — guide holds an AtoC Korea sign with your name.",
    lat: 33.5286,
    lng: 126.5868,
  },
  {
    order: 2,
    time: "Confirmed at booking (≈30 min after ship docking)",
    name: "Gangjeong Civil-Military Cruise Terminal (강정항 — south Jeju, Seogwipo)",
    type: "cruise_terminal",
    note: "For ships docking at Gangjeong Port. Meet your guide at the cruise terminal arrival hall — guide holds an AtoC Korea sign with your name.",
    lat: 33.2247,
    lng: 126.5512,
  },
];

const JEJU_TERMINALS_RETURN = [
  { order: 1, name: "Jeju International Passenger Terminal (제주항)", type: "cruise_terminal", lat: 33.5286, lng: 126.5868 },
  { order: 2, name: "Gangjeong Civil-Military Cruise Terminal (강정항)", type: "cruise_terminal", lat: 33.2247, lng: 126.5512 },
];

const BUSAN_TERMINALS_DEPARTURE = [
  {
    order: 1,
    time: "Confirmed at booking (≈30 min after ship docking)",
    name: "Busan International Cruise Terminal (영도 크루즈항 — Dongsam, Yeongdo)",
    type: "cruise_terminal",
    note: "Primary terminal for large cruise ships. Meet your guide at the arrival hall — guide holds an AtoC Korea sign with your name.",
    lat: 35.0747,
    lng: 129.0884,
  },
  {
    order: 2,
    time: "Confirmed at booking (≈30 min after ship docking)",
    name: "Busan Port International Passenger Terminal (부산항국제여객터미널 — Choryang)",
    type: "cruise_terminal",
    note: "For smaller cruise ships and ferries that dock at the Choryang passenger terminal. Meet your guide at the arrival hall.",
    lat: 35.1149,
    lng: 129.0455,
  },
];

const BUSAN_TERMINALS_RETURN = [
  { order: 1, name: "Busan International Cruise Terminal (영도 크루즈항)", type: "cruise_terminal", lat: 35.0747, lng: 129.0884 },
  { order: 2, name: "Busan Port International Passenger Terminal (Choryang)", type: "cruise_terminal", lat: 35.1149, lng: 129.0455 },
];

const JEJU_CRUISE_PICKUP_FAQ =
  "At the cruise terminal arrival hall — Jeju Port (north) or Gangjeong Port (south) depending on where your ship docks. Your guide waits at the gangway-side arrival hall with an AtoC Korea sign and your name. Exact pickup time is confirmed the evening before, based on your ship's posted arrival.";

const BUSAN_CRUISE_PICKUP_FAQ =
  "At the cruise terminal arrival hall. Large cruise ships dock at the Busan International Cruise Terminal (Yeongdo, Dongsam); smaller cruise ships and ferries dock at the Busan Port International Passenger Terminal (Choryang). The pickup terminal is determined by your ship — confirm at booking. Your guide waits with an 'AtoC Korea' sign in the arrival hall, and the coach is parked in the terminal coach lot.";

const tours = {
  // === JEJU CRUISE ===
  "jeju-cruise-shore-excursion-bus-tour": (j) => {
    j.pickup_dropoff = {
      departure: JEJU_TERMINALS_DEPARTURE,
      return: JEJU_TERMINALS_RETURN,
      notes:
        "Return is to the same cruise terminal your tour started from, with comfortable buffer before sail-away. We have never missed a sail-away — on-time return is the core of the cruise shore-excursion product.",
    };
    for (const q of j.staticQuestions || []) {
      if (q.id === "pickup" || /pick.{0,3}up/i.test(q.question || "")) q.answer = JEJU_CRUISE_PICKUP_FAQ;
    }
    return j;
  },
  "jeju-cruise-shore-excursion-small-group-tour": (j) => {
    j.pickup_dropoff = {
      departure: JEJU_TERMINALS_DEPARTURE,
      return: JEJU_TERMINALS_RETURN,
      notes:
        "Return is to the same cruise terminal your tour started from, with comfortable buffer before sail-away. We have never missed a sail-away — on-time return is the core of the cruise shore-excursion product.",
    };
    for (const q of j.staticQuestions || []) {
      if (q.id === "pickup" || /pick.{0,3}up/i.test(q.question || "")) q.answer = JEJU_CRUISE_PICKUP_FAQ;
    }
    return j;
  },
  // === BUSAN CRUISE ===
  "busan-cruise-shore-excursion-bus-tour": (j) => {
    j.pickup_dropoff = {
      primary: {
        name: "Busan International Cruise Terminal (영도 크루즈항 — Dongsam, Yeongdo)",
        address: "Dongsam-dong, Yeongdo-gu, Busan",
        time: "Confirmed at booking (≈30 min after ship docking) / Return ≈90 min before sail-away",
        instructions:
          "For large cruise ships. Meet the guide at the terminal arrival hall — look for the 'AtoC Korea' sign. Coach parked in the terminal coach lot.",
      },
      alternates: [
        {
          name: "Busan Port International Passenger Terminal (부산항국제여객터미널 — Choryang)",
          address: "Chungjang-daero 206, Jung-gu, Busan",
          time: "Alternate pickup for ships docking at Choryang",
          instructions:
            "If your cruise line docks at the Choryang International Passenger Terminal rather than the Yeongdo Cruise Terminal, notify at booking — the coach will pick up at the Choryang terminal arrival hall instead.",
        },
      ],
    };
    for (const q of j.staticQuestions || []) {
      if (q.id === "pickup" || /pick.{0,3}up/i.test(q.question || "")) q.answer = BUSAN_CRUISE_PICKUP_FAQ;
    }
    return j;
  },
  "busan-small-group-sightseeing-tour-cruise-passengers": (j) => {
    j.pickup_dropoff = {
      departure: BUSAN_TERMINALS_DEPARTURE,
      return: BUSAN_TERMINALS_RETURN,
      notes: [
        "Provide ship name, port-call date, expected disembarkation time, and all-aboard time at booking. Pickup terminal (Yeongdo Cruise Terminal or Choryang Passenger Terminal) is set by where your ship docks. Shared van with other cruise passengers; on-time return is the product.",
      ],
    };
    return j;
  },
  "busan-private-car-charter-cruise-shore": (j) => {
    j.pickup_dropoff = {
      type: "multi_point_pickup",
      meeting_points: [
        {
          name: "Busan International Cruise Terminal (영도 크루즈항 — Dongsam, Yeongdo)",
          time: "Within 30 min of cruise disembarkation",
          note: "Primary terminal for large cruise ships. Driver waits at the arrival hall with an 'AtoC Korea' sign — please share your cruise name and docking timeline at booking.",
        },
        {
          name: "Busan Port International Passenger Terminal (부산항국제여객터미널 — Choryang)",
          time: "Within 30 min of cruise disembarkation",
          note: "Secondary terminal for smaller cruise ships and ferries. Driver waits at the arrival hall with an 'AtoC Korea' sign — please share your cruise name and docking timeline at booking.",
        },
      ],
      dropoff_points: [
        {
          name: "Back to your originating cruise terminal (Yeongdo or Choryang)",
          approx_time: "≈ 90 min before your ship's all-aboard call",
          note: "Return planned around your ship's posted departure time. On-time return is guaranteed — we have never missed a sail-away across 4 seasons of cruise charters.",
        },
      ],
      hotel_pickup_available: false,
      notes: [
        "This is a cruise shore-excursion product — pickup is at the cruise terminal, not a hotel. Hotel pickup is not offered on this SKU; for hotel-based pickup, see our separate private Busan day-charter.",
      ],
    };
    return j;
  },
  // === INCHEON CRUISE === (terminal already correct; fix Yeongjong-do confusion in notes)
  "from-incheon-seoul-day-tour-cruise-guests": (j) => {
    j.pickup_dropoff.notes = [
      "Provide ship name, port-call date, expected disembarkation time, and all-aboard time at booking. Pickup is at the Incheon Cruise Terminal in Songdo (the dedicated ocean-cruise terminal; do NOT confuse with the Incheon International Ferry Terminal or with Incheon Airport on Yeongjong Island). Shared van with other cruise passengers from various ships; if multiple ships sail at different times, earliest-sailing passengers are dropped first. On-time return is the product.",
    ];
    return j;
  },
  "incheon-seoul-private-car-shore-excursion-cruise": (j) => {
    j.pickup_dropoff.notes = [
      "Provide ship name, port-call date, expected arrival, and all-aboard time at booking. Pickup is at the Incheon Cruise Terminal in Songdo (the dedicated ocean-cruise terminal; do NOT confuse with the Incheon International Ferry Terminal or with Incheon Airport on Yeongjong Island). Driver maintains a 60-minute traffic buffer before all-aboard. On-time return is guaranteed — never missed a sail-away.",
    ];
    return j;
  },
};

let totalTours = 0;
for (const [tour, mutate] of Object.entries(tours)) {
  const f = `${root}/${tour}/${tour}.en.json`;
  if (!fs.existsSync(f)) {
    console.log("SKIP:", f);
    continue;
  }
  const txt = fs.readFileSync(f, "utf8");
  const j = JSON.parse(txt);
  const updated = mutate(j);
  const out = JSON.stringify(updated, null, 2);
  JSON.parse(out);
  fs.writeFileSync(f, out + "\n", "utf8");
  console.log("✓", tour);
  totalTours++;
}
console.log(`\n=== ${totalTours} cruise tours updated ===`);

console.log("\nResidual hotel-pickup check (cruise tours only):");
for (const t of Object.keys(tours)) {
  const f = `${root}/${t}/${t}.en.json`;
  if (!fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, "utf8");
  for (const p of ["Ocean Suites", "LOTTE City Hotel", "Shilla Duty Free", "From your hotel lobby", "Yeongjong-do or Songdo"]) {
    const c = txt.split(p).length - 1;
    if (c) console.log(`  ⚠ ${t}: "${p}" × ${c}`);
  }
}
