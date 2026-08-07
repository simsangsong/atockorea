#!/usr/bin/env node
/**
 * Puts the real course back into the English half of the Busan cruise-shore
 * private charter, and stops the charter describing itself as a coach.
 *
 * 🔴 WHAT WAS WRONG. `busan-private-car-charter-cruise-shore` carried TWO
 * different products in one row set. Five locales (ko/ja/zh/zh-TW/es) held the
 * real eight-stop course; five (en + the staged de/fr/it/ru, which are
 * translations of en) held the *city* charter's route MENU:
 *
 *   en:  Pickup → Route planning with your guide → East coast highlights option
 *        → History, village and downtown option → Return to Busan Cruise Port
 *        → Yongdusan → Jagalchi → Return to Busan Cruise Terminal
 *   ko:  픽업 → 유엔기념공원 → 태종대 → 점심 → 감천문화마을
 *        → 용두산 → 자갈치 → 귀환
 *
 * So an English reader met "Return to Busan Cruise Port" — the tour ending —
 * in the MIDDLE of the itinerary, with two more stops and a second return
 * underneath it.
 *
 * The overwrite was partial, and that is what makes the repair safe. Only the
 * scalar fields plus `highlights[0..2]` and `timeUsed[0]` were replaced;
 * `highlights[3..]` and `timeUsed[1..]` still hold the real stop's content and
 * still line up index-for-index with Spanish. The English original existed —
 * it was clipped, not deleted — so this restores it rather than inventing it.
 *
 * Facts are triangulated: where the same POI appears in the sibling coach and
 * small-group products, the English phrasing here matches theirs, so the three
 * Busan cruise products now say the same thing about the same place.
 *
 * TWO SMALLER THINGS in the same pass:
 *   - `_poi_meta.poi_key` on stops 1 and 4 read `OPS_route_planning` and
 *     `OPS_busan_cruise_return` in ALL TEN locales — leftovers from the menu.
 *     Stop 4 therefore shared a key with stop 7, so one itinerary had the same
 *     poi_key twice, and arrival content for the UN cemetery would have
 *     resolved to "route planning".
 *   - The five correct locales tell guests of a PRIVATE CAR charter to get off
 *     the 관광버스 / 観光バス / 大巴 / autocar. Copied from the coach product.
 *
 * NOT DONE HERE — de/fr/it/ru. They exist only as DB rows, are served as English
 * (`TOUR_PRODUCT_FALLBACK_URL_LOCALES`), and are machine translations of the
 * broken English. Re-translating them is the i18n pipeline's job, from the
 * English this script fixes. Their poi_keys are corrected by the DB applier.
 *
 *   node scripts/restore-busan-private-cruise-course-2026-08.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DRY = process.argv.includes("--dry-run");
const SLUG = "busan-private-car-charter-cruise-shore";
const DIR = `components/product-tour-static/${SLUG}`;
const file = (loc) => `${DIR}/${SLUG}.${loc}.json`;

/** Stops whose `_poi_meta.poi_key` still names the menu item it replaced. */
export const POI_KEY_FIX = {
  1: { from: "OPS_route_planning", to: "un_memorial_cemetery" },
  4: { from: "OPS_busan_cruise_return", to: "gamcheon_culture_village" },
};

/**
 * The English that was clipped. Only the fields the menu overwrote are listed —
 * `highlights` here replaces indices 0..2 and `timeUsed0` replaces index 0;
 * everything past that is already correct and is left alone.
 */
export const EN_STOPS = {
  0: {
    expectName: "Pickup at Busan Cruise Port",
    category: "Departure",
    time: "Cruise arrival + 30 min",
    duration: "30 min",
    description:
      "Your private driver meets you at one of three pickup points: **Busan Port International Cruise Terminal** in Dongsam-dong, Yeongdo — the dedicated berth for large ships such as Royal Caribbean Quantum-class and Princess vessels that exceed the **64 m air draft of Busan Harbour Bridge**; **Busan Port International Passenger Terminal** at 206 Chungjang-daero, Choryang-dong — opened **31 August 2015**, the second-largest passenger terminal in Asia after Shanghai, handling **2.78 million** passengers a year across five buildings totalling 92,945 m²; or a city hotel / Busan KTX station.\n\nPickup is set **30 minutes after your ship's official clearance time**, which absorbs the variation in immigration processing. The driver carries a name board in English and Korean and a **printed itinerary card** listing every stop time, the Korean-script addresses (usable for a taxi in an emergency), and the operator's 24-hour contact. The vehicle is a **sedan or van for your group only** — no other passengers — and luggage stays in the boot for the day.",
    whyOnRoute:
      "The three pickup points cover both kinds of Busan cruise terminal — the large-ship cruise berth in Dongsam-dong and the ferry / mid-size cruise International Passenger Terminal in Choryang — plus city hotels and KTX. The 30-minute buffer after arrival absorbs the immigration delay that is normal when 3,000+ passengers disembark at once.",
    highlights: [
      "**Three pickup options**: Cruise Terminal (Yeongdo), International Passenger Terminal (Choryang), or hotel / KTX",
      "**Private vehicle** — your group only, no shared passengers",
      "Driver holds a name board + a Korean/English itinerary card",
    ],
  },
  1: {
    expectName: "Route planning with your guide",
    name: "UN Memorial Cemetery (Korean War)",
    category: "Memorial & History",
    time: "≈ 09:30",
    duration: "60 min",
    description:
      "**The UN Memorial Cemetery in Korea (UNMCK) — the only United Nations memorial cemetery in the world** — was established by the UN Command on **18 January 1951** during the Korean War, dedicated by **General Matthew Ridgway on 6 April 1951**, and **donated by the Republic of Korea to the United Nations in 1959** under a UN General Assembly resolution. It honours the fallen of the **22 sending nations** under UN Command (16 combat, 6 medical) and today holds **2,300 graves from 11 nations** — most remains were repatriated in the late 1950s.\n\nThe 14-hectare grounds hold the **Main Gate** designed by Korean modernist architect **Kim Joong-up (1966)**, a **Memorial Service Hall** screening a 12-minute English documentary, the **Symbolic Area** flying the flags of all 22 sending nations, the **US Korean War Monument** by Frank Gaylord (American Battle Monuments Commission, 2013), and the **Wall of Remembrance** dedicated in 2006 — **40,896 names on 140 marble panels**, one for every UN combatant who died in Korea.\n\nEvery year on 11 November at 11:00, the **'Turn Toward Busan' ceremony** is held here and simultaneously at memorials in all 22 nations — the one moment in the year when every sending nation's flag is lowered together. **Admission is free**, hours are **09:00–18:00 (May–Sep) / 09:00–17:00 (Oct–Apr)**, and the whole site is **wheelchair-accessible** on paved paths.\n\nThe cemetery is administered by the **Commission for the UN Memorial Cemetery in Korea** and is protected as sovereign territory under UN jurisdiction by **UN General Assembly Resolution 977(X) of 15 December 1955**.",
    whyOnRoute:
      "UNMCK is **the most globally significant Korean War heritage site in Busan** and a sober counterweight to the coastal and cultural stops that follow. Arriving at 09:30 stays ahead of the group-coach peak around 11:00, and 60 minutes is enough for the documentary, the Wall of Remembrance and a quiet pause without rushing. It is wheelchair-accessible and the least physically demanding stop of the day, so it is placed first on purpose, as a gentle start. For cruise passengers on a tight all-aboard time this 60-minute stop is the most flexible in the day — it compresses to about 30 minutes (documentary + Symbolic Area + Wall of Remembrance) or extends to 75 with the Sculpture Park.",
    highlights: [
      "**Only UN memorial cemetery in the world** — established 18 January 1951; donated by Korea to the UN in 1959",
      "**22 sending nations** honoured; **2,300 graves from 11 nations** today",
      "**Wall of Remembrance (2006)** — 40,896 names on 140 marble panels",
    ],
    timeUsed0: "Symbolic Area + flag plaza of the 22 sending nations (~10 min)",
  },
  2: {
    expectName: "East coast highlights option",
    name: "Taejongdae Coastal Cliffs",
    category: "Coast",
    time: "≈ 10:45",
    duration: "75 min",
    description:
      "**Taejongdae (태종대) — Busan Monument No. 28** (designated jointly with the Oryukdo Islands) — is a **natural park at the southern tip of Yeongdo Island**, named after **King Taejong Muyeol of Silla (604–661 CE)**, the 29th king and unifier of the Three Kingdoms, who is said to have practised archery here. Its signature feature is **Sinseon Rock, a wave-cut platform** below Yeongdo Lighthouse; geologists date its formation to **about 120,000 years ago in the 4th interglacial period** — sedimentary rock with visible concentric patterns and fault zones shaped by long marine erosion.\n\n**Yeongdo Lighthouse**, on the cliff above, was **Busan's first, built in 1906** (the 10th in Korea), with a modern tower added in 2004. Its original light guided ships into Busan for over a century; the 2004 renovation turned the site into a maritime culture complex (See & Sea gallery + natural history museum + observatory + café).\n\nWalking the full 4.3 km loop is strenuous, so most visitors take the **Danubi Train** (about ₩4,000 return for adults, from the entrance plaza), which stops at Taewon Pebble Beach → Gumyeongsa Temple → Observatory → Yeongdo Lighthouse → Taejongsa Temple. The **3-storey observatory** gives a panorama out to **Saengdo (Teapot Island)** and, on clear days, to **Tsushima Island in Japan, 50 km to the south-east**.\n\nTwo legends define the place: **Mangbuseok Rock** — a faithful wife who waited for a husband taken by Japanese pirates until she turned to stone — and the **'Light Beyond Limitation' sculpture** by Korean artist Ji Sul Won Kyung-Lee (blue rings = sea and sky, red = earth, silver apex = the lighthouse beam). **Taejongsa Temple** inside the park holds a hydrangea festival from late June to early July.\n\nPark hours: **04:00–24:00 (Mar–Oct) / 05:00–24:00 (Nov–Feb)**, **free admission**.",
    whyOnRoute:
      "Taejongdae is **the canonical Busan natural-landscape stop** and pairs ideally with the Gamcheon–Yongdusan–Jagalchi city cluster that follows. The day runs solemn (UN cemetery) → rugged coast (Taejongdae) → colour (Gamcheon) → city view (Yongdusan Tower) → market (Jagalchi). Seventy-five minutes covers the observatory and lighthouse loop comfortably without forcing the strenuous full 4.3 km circuit, and the Danubi Train removes the climb. For cruise passengers the 75-minute Danubi Train + observatory + lighthouse route is the most efficient way into Busan's wild coastline — without the train, seeing this site properly takes over two hours.",
    highlights: [
      "**Busan Monument No. 28** — wave-cut platform formed ~120,000 years ago (4th interglacial)",
      "Named after **King Taejong Muyeol of Silla** (604–661 CE, unifier of the Three Kingdoms)",
      "**Yeongdo Lighthouse — Busan's first, built 1906** (10th in Korea); renovated 2004",
    ],
    timeUsed0: "Private car drop-off + Danubi Train tickets (~10 min)",
  },
  3: {
    expectName: "History, village and downtown option",
    name: "Lunch (local Busan restaurant)",
    category: "Meal",
    time: "≈ 12:30",
    duration: "60 min",
    description:
      "Lunch at a guide-recommended **local Busan restaurant** in Yeongdo or Nampo-dong — the choice depends on your group's preference. The main options are **Dwaeji Gukbap** (Busan's signature pork-and-rice soup, at its best in the old shops of Seomyeon's Dwaeji Gukbap Street), **Milmyeon** (the Busan wheat-noodle version of North Korean cold noodles, created around 1950 in Korean War refugee kitchens), or **Hoe** (raw fish from Jagalchi, if your group likes seafood).\n\n**Lunch is not included in the tour price** — the driver recommends to your budget (typically ₩10,000–25,000 per person). Vegetarian, halal and allergy requests can be arranged **with advance notice (24 hours recommended)**.",
    whyOnRoute:
      "The 12:30 lunch slot sits between Taejongdae (coastal) and Gamcheon (hillside) — the most natural break in the day's rhythm. The driver's local recommendations beat the restaurants around the sights; you can follow the recommendation or ask for a cuisine at the morning pickup briefing.",
    highlights: [
      "Driver recommends to your group's preference (Korean / seafood / international)",
      "Signature Busan options: **Dwaeji Gukbap**, **Milmyeon**, **Hoe (raw fish)**",
      "**Lunch is at your own expense** (typically ~₩10,000–25,000 per person)",
    ],
  },
  4: {
    expectName: "Return to Busan Cruise Port",
    name: "Gamcheon Culture Village",
    category: "Hillside Art Village",
    time: "≈ 14:00",
    duration: "75 min",
    description:
      "**Gamcheon Culture Village — Busan's 'Korea's Machu Picchu' / 'Korea's Santorini'** — is a hillside community of **about 10,000 residents in pastel-coloured houses**, founded as a 1955 refugee settlement when **around 800 families (~4,000 people)** of the Taegeukdo faith, led by Jo Cheol-je, resettled here after the Korean War. Its defining feature — the famous stepped rainbow view, in which **no house's roof blocks the view of the one behind it** — comes directly from the **Taegeukdo philosophy of 'allowing others to prosper'**.\n\nTwo government art projects turned the village into a destination: **'Dreaming of Machu Picchu' (2009)** and **'Miro Miro' (2010)**, commissioned by the Ministry of Culture, which placed murals, sculptures and installations through the maze of alleys. The village won the **UN-HABITAT Asian Townscape Award in 2012** and now receives **about 1.4 million visitors a year**.\n\nThe signature photo spots are the **Little Prince and Fox bench** at Sky Garden (long queue, free), the **rainbow-roof panorama** from the Star Viewing Hall, and the **Stamp Tour map** (about ₩2,000) guiding you to nine numbered installations. **People live here** — keep your voice down, no drones, no flash in the alleys, and take your rubbish with you.\n\nHours **09:00–18:00 (Mar–Oct) / 09:00–17:00 (Nov–Feb)**, **free to enter the village**, but the steep stairs and narrow alleys make much of it **difficult with a stroller or wheelchair** — wear non-slip shoes.",
    whyOnRoute:
      "Gamcheon is **the central visual stop of any Busan day tour** and connects naturally to Yongdusan next — both are hilltop viewpoints 4 km apart, one residential and artistic, the other a civic park. Seventy-five minutes is the right stay: enough for Sky Garden, the Little Prince bench queue and the walk down through the alleys, without exhausting the group in the midday heat and gradient before Yongdusan. For cruise travellers, 75 minutes at Gamcheon is the highest photo-value block of the day — Sky Garden + Star Viewing Hall + the maze-alley descent is more Instagram-ready than anywhere else on this route in Busan.",
    highlights: [
      "**1955 Taegeukdo refugee settlement** — ~800 families / ~4,000 people; founded by Jo Cheol-je",
      "**Taegeukdo philosophy of 'allowing others to prosper'** = no roof blocks a neighbour's view",
      "**'Dreaming of Machu Picchu' (2009)** + **'Miro Miro' (2010)** Ministry of Culture art projects",
    ],
    timeUsed0: "Private car drop-off at the upper entrance (~5 min)",
    /** ES carries three Gamcheon photos on this stop; the menu version had none. */
    galleryFrom: "es",
    galleryLocation: "Gamcheon Culture Village",
  },
};

/** A private car charter told guests to get off the coach. */
export const COACH_FIX = {
  ko: {
    2: ["관광버스 하차 + 다누비 열차 승차권 구매 (약 10분)", "전용 차량 하차 + 다누비 열차 승차권 구매 (약 10분)"],
    4: ["상부 입구 관광버스 하차 (~5분)", "상부 입구 전용 차량 하차 (~5분)"],
  },
  ja: {
    2: ["観光バスでの乗降＋ダヌビ列車チケット購入（約10分）", "専用車から下車＋ダヌビ列車チケット購入（約10分）"],
    4: ["上部入口で観光バス下車（約5分）", "上部入口で専用車から下車（約5分）"],
  },
  zh: {
    2: ["大巴下客 + 购买多努比小火车票（约10分钟）", "专车下客 + 购买多努比小火车票（约10分钟）"],
    4: ["大巴在上方入口处下客（约5分钟）", "专车在上方入口处下客（约5分钟）"],
  },
  "zh-TW": {
    2: ["巴士下車＋購買多努比列車車票（約10分鐘）", "專車下車＋購買多努比列車車票（約10分鐘）"],
    4: ["大型車輛在上方入口下客（約5分鐘）", "專車在上方入口下客（約5分鐘）"],
  },
  es: {
    2: [
      "Desembarco del autocar + compra de billetes del Tren Danubi (~10 min)",
      "Bajada del vehículo privado + compra de billetes del Tren Danubi (~10 min)",
    ],
    4: ["Bajada del autobús en la entrada superior (~5 min)", "Bajada del vehículo privado en la entrada superior (~5 min)"],
  },
};

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

/**
 * Applies every fix to one parsed bundle. Exported so the DB applier runs the
 * SAME transform against `detail_payload` instead of copying a bundle over —
 * other sessions write to those rows, and a wholesale copy discards their work.
 */
export function restore(doc, locale, esDoc) {
  const log = [];
  const stops = doc?.itineraryStops;
  if (!Array.isArray(stops) || stops.length !== 8) {
    return { log, skipped: `expected 8 stops, found ${Array.isArray(stops) ? stops.length : "none"}` };
  }

  for (const [idx, fix] of Object.entries(POI_KEY_FIX)) {
    const meta = stops[Number(idx)]?._poi_meta;
    if (meta && meta.poi_key === fix.from) {
      meta.poi_key = fix.to;
      log.push(`${locale} stop${idx}.poi_key ${fix.from} → ${fix.to}`);
    }
  }

  const coach = COACH_FIX[locale];
  if (coach) {
    for (const [idx, [from, to]] of Object.entries(coach)) {
      const used = stops[Number(idx)]?.timeUsed;
      if (Array.isArray(used) && used[0] === from) {
        used[0] = to;
        log.push(`${locale} stop${idx}.timeUsed[0] coach → private car`);
      }
    }
  }

  // Only English (and, in the DB, the locales that were translated from it)
  // carries the menu text. The other five are already correct.
  if (locale === "en") {
    for (const [idx, spec] of Object.entries(EN_STOPS)) {
      const stop = stops[Number(idx)];
      if (!stop) continue;
      // 🔴 The guard. If the name is no longer the menu's, someone has already
      // fixed this stop (or changed it deliberately) and we must not overwrite.
      if (stop.name !== spec.expectName) {
        log.push(`${locale} stop${idx} already restored or renamed — left alone`);
        continue;
      }
      for (const key of ["name", "category", "time", "duration", "description", "whyOnRoute"]) {
        if (spec[key] !== undefined) stop[key] = spec[key];
      }
      if (spec.highlights && Array.isArray(stop.highlights)) {
        stop.highlights.splice(0, spec.highlights.length, ...spec.highlights);
      }
      if (spec.timeUsed0 && Array.isArray(stop.timeUsed) && stop.timeUsed.length) {
        stop.timeUsed[0] = spec.timeUsed0;
      }
      if (spec.galleryFrom && esDoc && !stop.galleryItems?.length) {
        const donor = esDoc.itineraryStops?.[Number(idx)];
        if (donor?.galleryItems?.length) {
          stop.galleryItems = donor.galleryItems.map((g, i) => ({
            ...g,
            location: spec.galleryLocation,
            alt: `${spec.galleryLocation} — gallery image ${i + 1}`,
            caption: `${spec.galleryLocation} — photo ${i + 1}`,
          }));
          if (donor.imageCredits) stop.imageCredits = donor.imageCredits;
          log.push(`${locale} stop${idx} gallery restored (${stop.galleryItems.length} photos)`);
        }
      }
      log.push(`${locale} stop${idx} "${spec.expectName}" → "${stop.name}"`);
    }
  }

  return { log };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("restore-busan-private-cruise")) {
  const esDoc = existsSync(file("es")) ? JSON.parse(readFileSync(file("es"), "utf8")) : null;
  let changed = 0;
  const all = [];
  for (const loc of LOCALES) {
    const p = file(loc);
    if (!existsSync(p)) {
      console.log(`  (no ${loc} bundle)`);
      continue;
    }
    const raw = readFileSync(p, "utf8");
    const doc = JSON.parse(raw);
    const { log, skipped } = restore(doc, loc, esDoc);
    if (skipped) {
      console.error(`🔴 ${loc}: ${skipped}`);
      process.exit(2);
    }
    all.push(...log);
    const out = `${JSON.stringify(doc, null, 2)}\n`;
    if (out !== raw) {
      changed += 1;
      if (!DRY) writeFileSync(p, out);
    }
  }
  console.log(all.length ? all.join("\n") : "(nothing to change — already restored)");
  console.log(`\n${DRY ? "[dry-run] would rewrite" : "rewrote"} ${changed} bundle(s)`);
}
