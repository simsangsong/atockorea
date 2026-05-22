/**
 * One-off: geocode the canonical pickup/drop-off places via Google Geocoding API
 * and compare against the coordinates currently stored in tour_product_pages.
 * Output is reviewed by a human before any DB/JSON write (Phase 3).
 *
 *   node scripts/geocode-pickup-points.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvKey() {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(root, f), "utf8");
      for (const name of ["GOOGLE_MAPS_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]) {
        const m = txt.match(new RegExp("^\\s*" + name + "\\s*=\\s*(.+)\\s*$", "m"));
        if (m) return m[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* ignore */
    }
  }
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

const KEY = loadEnvKey();
if (!KEY) {
  console.error("No Google Maps API key found in .env.local / env");
  process.exit(1);
}

// Canonical places (de-duplicated). `q` uses Korean names for geocoding precision; `stored`
// is the coordinate currently in the DB so we can flag large deltas.
const PLACES = [
  { key: "ocean_suites_jeju", q: "오션스위츠 제주호텔", stored: "33.4944,126.4808" },
  { key: "jeju_airport", q: "제주국제공항", stored: "33.5108,126.4932" },
  { key: "lotte_city_hotel_jeju", q: "롯데시티호텔 제주", stored: "33.4963,126.4865" },
  { key: "shilla_duty_free_jeju", q: "신라면세점 제주점", stored: "33.4958,126.5252" },
  { key: "dongmun_market", q: "제주 동문재래시장", stored: "33.5136,126.5296" },
  { key: "seomyeon_station", q: "서면역 부산", stored: "35.1577,129.0592" },
  { key: "busan_station", q: "부산역", stored: "35.1152,129.0421" },
  { key: "haeundae_station", q: "해운대역 부산 도시철도 2호선", stored: "35.1628,129.1603" },
  { key: "jagalchi_nampo", q: "자갈치시장", stored: "35.0978,129.0286" },
  { key: "busan_port_terminal", q: "부산항국제여객터미널", stored: "35.1067,129.0365" },
  { key: "nopo_station", q: "노포역 부산", stored: "35.2285,129.0784" },
  { key: "hongik_univ_station", q: "홍대입구역", stored: "37.5573,126.925" },
  { key: "myeongdong_station", q: "명동역 서울", stored: "37.5636,126.9847" },
  { key: "incheon_cruise_terminal", q: "인천항국제여객터미널 송도", stored: "37.4703,126.64" },
  { key: "incheon_airport", q: "인천국제공항", stored: "37.4602,126.4407" },
];

function haversine(a, b) {
  const [la1, lo1] = a.split(",").map(Number);
  const [la2, lo2] = b.split(",").map(Number);
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLa = toR(la2 - la1);
  const dLo = toR(lo2 - lo1);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(toR(la1)) * Math.cos(toR(la2)) * Math.sin(dLo / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const out = [];
for (const p of PLACES) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(p.q)}&region=kr&language=en&key=${KEY}`;
  let j;
  try {
    const res = await fetch(url);
    j = await res.json();
  } catch (e) {
    console.log(`${p.key}\tFETCH_ERR\t${e.message}`);
    continue;
  }
  if (j.status !== "OK" || !j.results?.length) {
    console.log(`${p.key}\tSTATUS=${j.status}\t${j.error_message || ""}`);
    out.push({ key: p.key, status: j.status });
    continue;
  }
  const r = j.results[0];
  const lat = +r.geometry.location.lat.toFixed(5);
  const lng = +r.geometry.location.lng.toFixed(5);
  const got = `${lat},${lng}`;
  const dist = haversine(p.stored, got);
  const flag = dist > 700 ? "  <-- WRONG" : dist > 250 ? "  <- off" : "";
  console.log(
    `${p.key.padEnd(24)} stored=${p.stored.padEnd(20)} geocoded=${got.padEnd(20)} Δ${String(dist).padStart(5)}m  ${r.geometry.location_type.padEnd(12)} ${r.formatted_address}${flag}`,
  );
  out.push({ key: p.key, q: p.q, stored: p.stored, lat, lng, distance_m: dist, location_type: r.geometry.location_type, address: r.formatted_address });
}
console.log("\n----JSON----\n" + JSON.stringify(out, null, 2));
