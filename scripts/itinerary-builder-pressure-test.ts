import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadLocalEnv();

type Region = "busan" | "jeju";

interface Case {
  id: string;
  region: Region;
  intent: string;
  maxHours?: number;
  track?: string;
  origin?: string;
  expectAny?: string[];
  expectAll?: string[];
  forbid?: string[];
  maxDriveMin?: number;
  maxStops?: number;
}

interface ApiResponse {
  ok: boolean;
  recommended_pois?: string[];
  total_drive_min?: number;
  total_minutes?: number;
  parsed?: {
    themes?: string[];
    personas?: string[];
    negative_signals?: string[];
    sub_regions?: string[];
  };
  diagnostics?: {
    candidates_after_floor?: number;
    score_floor?: number;
    origin?: string;
  };
  per_poi_score?: Array<{
    poi_key: string;
    name_en: string;
    total: number;
    rationale?: string[];
  }>;
  error?: string;
  message?: string;
}

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), fileName);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] == null) process.env[key] = value;
    }
  }
}

const CASES: Case[] = [
  {
    id: "B01",
    region: "busan",
    intent: "first-time Busan highlights, iconic landmarks, balanced pace",
    expectAny: ["haedong_yonggungsa", "gamcheon_culture_village", "jagalchi_market", "yongdusan_park"],
    forbid: ["un_memorial_cemetery"],
    maxDriveMin: 210,
  },
  {
    id: "B02",
    region: "busan",
    intent: "foodie day, seafood markets, street food, traditional market",
    expectAny: ["jagalchi_market", "gukje_market", "biff_square"],
    forbid: ["un_memorial_cemetery", "taejongdae"],
    maxDriveMin: 160,
  },
  {
    id: "B03",
    region: "busan",
    intent: "beaches, ocean views, cafes, relaxed pace",
    expectAny: ["songdo_beach", "cheongsapo_blue_line_park", "haedong_yonggungsa"],
    forbid: ["un_memorial_cemetery", "gukje_market"],
    maxDriveMin: 190,
  },
  {
    id: "B04",
    region: "busan",
    intent: "family with young kids, stroller friendly, easy walking, no hiking",
    expectAny: ["songdo_beach", "cheongsapo_blue_line_park", "yongdusan_park"],
    forbid: ["taejongdae", "hallasan_eorimok_trail"],
    maxDriveMin: 180,
  },
  {
    id: "B05",
    region: "busan",
    intent: "UNESCO heritage, temples, history and culture near Busan",
    expectAny: ["bulguksa_temple", "tongdosa_temple", "gyeongju_national_museum"],
    forbid: ["jagalchi_market", "songdo_beach"],
    maxDriveMin: 260,
  },
  {
    id: "B06",
    region: "busan",
    intent: "rainy day indoor culture, museum, history, not beach",
    expectAny: ["gyeongju_national_museum", "un_memorial_cemetery"],
    forbid: ["songdo_beach", "taejongdae"],
    maxDriveMin: 260,
  },
  {
    id: "B07",
    region: "busan",
    intent: "cruise passenger shore excursion, port pickup, easy first-time highlights",
    track: "cruise",
    origin: "busan_cruise_port",
    expectAny: ["gamcheon_culture_village", "jagalchi_market", "yongdusan_park"],
    forbid: ["bulguksa_temple", "yeongnam_alps_ice_valley_cable_car"],
    maxDriveMin: 190,
  },
  {
    id: "B08",
    region: "busan",
    intent: "active coastal cliffs and scenic walking, photos, ocean views",
    expectAny: ["taejongdae", "haedong_yonggungsa", "cheongsapo_blue_line_park"],
    forbid: ["gyeongju_national_museum"],
    maxDriveMin: 210,
  },
  {
    id: "B09",
    region: "busan",
    intent: "quiet memorial history stop, Korean war history, not shopping",
    expectAny: ["un_memorial_cemetery"],
    forbid: ["gukje_market", "biff_square"],
    maxDriveMin: 180,
  },
  {
    id: "B10",
    region: "busan",
    intent: "Gyeongju cherry blossom, easy walking, family, spring photos",
    expectAny: ["bomun_lake", "cheomseongdae", "woljeonggyo_bridge"],
    forbid: ["jagalchi_market", "taejongdae"],
    maxDriveMin: 380,
  },
  {
    id: "B11",
    region: "busan",
    intent: "Ulsan outskirts nature cable car and cave for family, not city market",
    expectAny: ["yeongnam_alps_ice_valley_cable_car", "amethyst_cave_themepark"],
    forbid: ["jagalchi_market", "biff_square"],
    maxDriveMin: 270,
  },
  {
    id: "B12",
    region: "busan",
    intent: "short 4 hour Nampo market food walk, seafood and street food",
    maxHours: 4,
    expectAny: ["jagalchi_market", "gukje_market", "biff_square", "yongdusan_park"],
    forbid: ["bulguksa_temple", "tongdosa_temple"],
    maxDriveMin: 120,
    maxStops: 5,
  },
  {
    id: "B13",
    region: "busan",
    intent: "senior couple, relaxed pace, city views, minimal walking",
    expectAny: ["yongdusan_park", "cheongsapo_blue_line_park", "songdo_beach"],
    forbid: ["taejongdae", "gamcheon_culture_village"],
    maxDriveMin: 180,
  },
  {
    id: "B14",
    region: "busan",
    intent: "photography colorful village and coastal temple, first time",
    expectAny: ["gamcheon_culture_village", "haedong_yonggungsa"],
    forbid: ["gyeongju_national_museum"],
    maxDriveMin: 220,
  },
  {
    id: "B15",
    region: "busan",
    intent: "shopping, street food, markets, city energy, no temples",
    expectAny: ["gukje_market", "biff_square", "jagalchi_market"],
    forbid: ["haedong_yonggungsa", "tongdosa_temple", "bulguksa_temple"],
    maxDriveMin: 170,
  },
  {
    id: "J01",
    region: "jeju",
    intent: "first-time Jeju highlights, UNESCO nature, ocean views",
    expectAny: ["seongsan_ilchulbong", "daepo_jusangjeolli_cliff", "jeongbang_falls"],
    forbid: ["jeju_cruise_port", "gangjeong_cruise_port"],
    maxDriveMin: 260,
  },
  {
    id: "J02",
    region: "jeju",
    intent: "beaches, ocean views, cafes, relaxed pace in Jeju",
    expectAny: ["hamdeok_seoubong_beach", "hyeopjae_beach", "aewol_cafe_street"],
    forbid: ["jeju_stone_park", "jeju_haenyeo_museum"],
    maxDriveMin: 240,
  },
  {
    id: "J03",
    region: "jeju",
    intent: "family with kids, stroller friendly, easy walking, no hiking",
    expectAny: ["hamdeok_seoubong_beach", "hallasan_1100_wetland", "camellia_hill", "hueree_natural_park"],
    forbid: ["hallasan_eorimok_trail", "hallasan_eoseungsaengak", "songaksan"],
    maxDriveMin: 260,
  },
  {
    id: "J04",
    region: "jeju",
    intent: "active hiking and mountain views, Hallasan trail",
    expectAny: ["hallasan_eorimok_trail", "hallasan_eoseungsaengak", "songaksan"],
    forbid: ["aewol_cafe_street", "jeju_tangerine_picking_experience"],
    maxDriveMin: 260,
  },
  {
    id: "J05",
    region: "jeju",
    intent: "rainy day indoor museum, haenyeo culture, tea museum",
    expectAny: ["jeju_haenyeo_museum", "osulloc_tea_museum", "jeju_stone_park"],
    forbid: ["hyeopjae_beach", "seopjikoji"],
    maxDriveMin: 300,
  },
  {
    id: "J06",
    region: "jeju",
    intent: "east Jeju UNESCO, Seongsan, folk village, haenyeo culture",
    expectAny: ["seongsan_ilchulbong", "seongeup_folk_village", "jeju_haenyeo_museum"],
    forbid: ["hyeopjae_beach", "aewol_cafe_street"],
    maxDriveMin: 220,
  },
  {
    id: "J07",
    region: "jeju",
    intent: "west Jeju beaches and cafes, tea culture, relaxed pace",
    expectAny: ["hyeopjae_beach", "aewol_cafe_street", "osulloc_tea_museum"],
    forbid: ["seongsan_ilchulbong", "jeju_haenyeo_museum"],
    maxDriveMin: 220,
  },
  {
    id: "J08",
    region: "jeju",
    intent: "south Jeju waterfalls, cliffs, ocean views, iconic nature",
    expectAny: ["jeongbang_falls", "cheonjeyeon_falls", "daepo_jusangjeolli_cliff"],
    forbid: ["hyeopjae_beach", "aewol_cafe_street"],
    maxDriveMin: 220,
  },
  {
    id: "J09",
    region: "jeju",
    intent: "cruise passenger from Jeju port, easy highlights, not too much driving",
    track: "cruise",
    origin: "jeju_cruise_port",
    expectAny: ["jeju_stone_park", "hamdeok_seoubong_beach", "jeju_haenyeo_museum"],
    forbid: ["songaksan", "camellia_hill"],
    maxDriveMin: 210,
  },
  {
    id: "J10",
    region: "jeju",
    intent: "cruise passenger from Gangjeong port, south waterfalls and cliffs",
    track: "cruise",
    origin: "gangjeong_cruise_port",
    expectAny: ["jeongbang_falls", "cheonjeyeon_falls", "daepo_jusangjeolli_cliff"],
    forbid: ["hamdeok_seoubong_beach", "jeju_haenyeo_museum"],
    maxDriveMin: 210,
  },
  {
    id: "J11",
    region: "jeju",
    intent: "winter tangerine picking family experience, easy walking",
    expectAny: ["jeju_tangerine_picking_experience"],
    forbid: ["hallasan_eorimok_trail", "songaksan"],
    maxDriveMin: 250,
  },
  {
    id: "J12",
    region: "jeju",
    intent: "spring cherry blossoms and canola flowers, scenic drive, photos",
    expectAny: ["noksan_ro_gasiri_blossom_road", "jeonnong_ro_cherry_blossom_street"],
    forbid: ["jeju_haenyeo_museum"],
    maxDriveMin: 250,
  },
  {
    id: "J13",
    region: "jeju",
    intent: "UNESCO geology, volcanic culture, stone park, not cafe",
    expectAll: ["jeju_stone_park"],
    expectAny: ["seongsan_ilchulbong", "daepo_jusangjeolli_cliff"],
    forbid: ["aewol_cafe_street", "osulloc_tea_museum"],
    maxDriveMin: 280,
  },
  {
    id: "J14",
    region: "jeju",
    intent: "short 4 hour north Jeju beach and cafe, easy route",
    maxHours: 4,
    expectAny: ["hamdeok_seoubong_beach", "aewol_cafe_street"],
    forbid: ["songaksan", "cheonjeyeon_falls", "camellia_hill"],
    maxDriveMin: 140,
    maxStops: 4,
  },
  {
    id: "J15",
    region: "jeju",
    intent: "senior couple relaxed Jeju garden, tea, beach, minimal walking",
    expectAny: ["osulloc_tea_museum", "camellia_hill", "hyeopjae_beach", "hallasan_1100_wetland"],
    forbid: ["hallasan_eorimok_trail", "seongsan_ilchulbong"],
    maxDriveMin: 250,
  },
];

type MatchPost = typeof import("../app/api/itinerary/match/route").POST;

async function runCase(post: MatchPost, testCase: Case) {
  const request = new Request("http://localhost/api/itinerary/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: testCase.intent,
      region: testCase.region,
      max_hours: testCase.maxHours ?? 8,
      track: testCase.track,
      origin: testCase.origin,
    }),
  });

  const response = await post(request);
  const data = (await response.json()) as ApiResponse;
  const recommended = data.recommended_pois ?? [];
  const failures: string[] = [];

  if (!response.ok || !data.ok) {
    failures.push(`api_error:${data.error ?? response.status}`);
  }

  if (testCase.expectAny?.length) {
    const hasAny = testCase.expectAny.some((poi) => recommended.includes(poi));
    if (!hasAny) failures.push(`missing_any:${testCase.expectAny.join("|")}`);
  }

  for (const poi of testCase.expectAll ?? []) {
    if (!recommended.includes(poi)) failures.push(`missing:${poi}`);
  }

  const forbiddenHits = (testCase.forbid ?? []).filter((poi) => recommended.includes(poi));
  if (forbiddenHits.length) failures.push(`forbidden:${forbiddenHits.join("|")}`);

  if (
    typeof testCase.maxDriveMin === "number" &&
    typeof data.total_drive_min === "number" &&
    data.total_drive_min > testCase.maxDriveMin
  ) {
    failures.push(`drive:${data.total_drive_min}>${testCase.maxDriveMin}`);
  }

  if (typeof testCase.maxStops === "number" && recommended.length > testCase.maxStops) {
    failures.push(`stops:${recommended.length}>${testCase.maxStops}`);
  }

  return { testCase, data, recommended, failures };
}

async function main() {
  const { POST: post } = await import("../app/api/itinerary/match/route");
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const verbose = process.argv.includes("--verbose");
  const only = onlyArg
    ? new Set(onlyArg.slice("--only=".length).split(",").map((id) => id.trim()).filter(Boolean))
    : null;
  const cases = only ? CASES.filter((testCase) => only.has(testCase.id)) : CASES;

  console.log(`[itinerary-pressure] running ${cases.length} cases`);

  const results = [];
  for (const testCase of cases) {
    const result = await runCase(post, testCase);
    results.push(result);
    const status = result.failures.length ? "FAIL" : "PASS";
    console.log(
      `${status} ${testCase.id} ${testCase.region} drive=${result.data.total_drive_min ?? "?"} stops=${result.recommended.length} floor=${result.data.diagnostics?.score_floor ?? "?"}`,
    );
    console.log(`  intent: ${testCase.intent}`);
    console.log(`  picks: ${result.recommended.join(", ")}`);
    if (verbose) {
      console.log(`  parsed: ${JSON.stringify(result.data.parsed)}`);
      console.log(
        `  scores: ${(result.data.per_poi_score ?? [])
          .map((s) => `${s.poi_key}:${s.total}`)
          .join(", ")}`,
      );
    }
    if (result.failures.length) console.log(`  issues: ${result.failures.join(", ")}`);
  }

  const failed = results.filter((result) => result.failures.length);
  console.log(`\n[itinerary-pressure] ${cases.length - failed.length}/${cases.length} passed`);
  if (failed.length) {
    console.log("[itinerary-pressure] failed cases:");
    for (const result of failed) {
      console.log(`  ${result.testCase.id}: ${result.failures.join(", ")}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[itinerary-pressure] fatal", error);
  process.exit(99);
});
