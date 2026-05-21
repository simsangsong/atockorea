#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TOURS_DIR = join(ROOT, "components/product-tour-static");
const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const INCHON_BASICS = {
  en: {
    visitBasics: {
      hours: "Cruise-call dependent; pickup is after immigration clearance at the terminal.",
      closed: "Available only when the cruise ship calls at Incheon.",
      admission: "No attraction admission; terminal access follows port and cruise security rules.",
      walking: "Easy - short walk from gangway/arrival hall to curbside pickup.",
    },
    convenience: {
      restroom: "Inside the terminal arrival/departure halls.",
      parking:
        "Tour bus and taxi stands outside the terminal; driver-guide meets at the assigned curbside point.",
    },
  },
  ko: {
    visitBasics: {
      hours: "크루즈 입항 일정에 따름; 입국 심사 후 터미널에서 픽업합니다.",
      closed: "인천항에 크루즈가 기항하는 날에만 이용 가능합니다.",
      admission: "관광지 입장료 없음; 터미널 출입은 항만 및 크루즈 보안 규정을 따릅니다.",
      walking: "쉬움 - 갱웨이/도착홀에서 도로변 픽업 지점까지 짧게 이동합니다.",
    },
    convenience: {
      restroom: "터미널 도착/출발 홀 내부.",
      parking:
        "터미널 외부에 관광버스 및 택시 승강장이 있으며, 드라이버 가이드가 지정 픽업 지점에서 만납니다.",
    },
  },
  ja: {
    visitBasics: {
      hours: "クルーズ入港スケジュールに準拠；入国審査後、ターミナルでピックアップします。",
      closed: "クルーズ船が仁川に寄港する日のみ利用可能です。",
      admission: "観光地入場料なし；ターミナル入場は港湾・クルーズの保安規則に従います。",
      walking: "簡単 - ギャングウェイ／到着ホールから車寄せの集合場所まで短距離です。",
    },
    convenience: {
      restroom: "ターミナルの到着・出発ホール内。",
      parking:
        "ターミナル外に観光バス・タクシー乗り場があり、ドライバーガイドが指定の車寄せでお迎えします。",
    },
  },
  zh: {
    visitBasics: {
      hours: "根据邮轮靠港时间安排；完成入境手续后在码头接送。",
      closed: "仅在邮轮停靠仁川港当天适用。",
      admission: "无景点门票；码头通行须遵守港口及邮轮安保规定。",
      walking: "轻松 - 从舷梯/到达大厅步行至路边接送点距离很短。",
    },
    convenience: {
      restroom: "码头到达/出发大厅内。",
      parking: "码头外设旅游巴士和出租车乘车点，司机导游将在指定路边接送点会合。",
    },
  },
  "zh-TW": {
    visitBasics: {
      hours: "依郵輪靠港時間安排；完成入境手續後於碼頭接送。",
      closed: "僅於郵輪停靠仁川港當日適用。",
      admission: "無景點門票；碼頭通行須遵守港口及郵輪安檢規定。",
      walking: "輕鬆 - 從舷梯／抵達大廳步行至路邊接送點距離很短。",
    },
    convenience: {
      restroom: "碼頭抵達／出發大廳內。",
      parking: "碼頭外設有旅遊巴士與計程車乘車點，司機導遊會在指定路邊接送點會合。",
    },
  },
  es: {
    visitBasics: {
      hours:
        "Depende de la escala del crucero; la recogida se realiza tras el control migratorio en la terminal.",
      closed: "Disponible solo cuando el crucero hace escala en Incheon.",
      admission:
        "Sin entrada turística; el acceso a la terminal sigue las normas de seguridad portuaria y del crucero.",
      walking:
        "Fácil - caminata corta desde la pasarela/sala de llegadas hasta el punto de recogida junto a la acera.",
    },
    convenience: {
      restroom: "Dentro de las salas de llegada/salida de la terminal.",
      parking:
        "Paradas de buses turísticos y taxis fuera de la terminal; el conductor-guía espera en el punto asignado.",
    },
  },
};

function listTourFiles() {
  const files = [];
  for (const slug of readdirSync(TOURS_DIR).sort((a, b) => a.localeCompare(b))) {
    const dir = join(TOURS_DIR, slug);
    if (!statSync(dir).isDirectory()) continue;
    for (const locale of LOCALES) {
      const file = join(dir, `${slug}.${locale}.json`);
      if (existsSync(file)) files.push({ file, slug, locale });
    }
  }
  return files;
}

function deepReplace(value, replacements) {
  if (typeof value === "string") {
    return replacements.reduce((current, [from, to]) => current.replace(from, to), value);
  }
  if (Array.isArray(value)) return value.map((item) => deepReplace(item, replacements));
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) value[key] = deepReplace(value[key], replacements);
  }
  return value;
}

const REPLACEMENTS = {
  gwangmyeong_cave: [
    [/Adult 7,000 \/ Youth 3,500 \/ Child 2,000 KRW/g, "Adults 10,000 / Teenagers 5,000 / Children 3,000 KRW"],
    [/어른 7,000원 \/ 청소년 3,500원 \/ 어린이 2,000원/g, "어른 10,000원 / 청소년 5,000원 / 어린이 3,000원"],
    [/大人7,000 \/ 青少年3,500 \/ 子ども2,000ウォン/g, "大人10,000 / 青少年5,000 / 子ども3,000ウォン"],
    [/成人7,000 \/ 青少年3,500 \/ 儿童2,000韩元/g, "成人10,000 / 青少年5,000 / 儿童3,000韩元"],
    [/成人 7,000 \/ 青少年 3,500 \/ 兒童 2,000 韓元/g, "成人 10,000 / 青少年 5,000 / 兒童 3,000 韓元"],
    [/Adulto 7\.000 \/ Joven 3\.500 \/ Niño 2\.000 KRW/g, "Adulto 10.000 / Joven 5.000 / Niño 3.000 KRW"],
  ],
  sokcho_beach: [
    [/\*\*22 stories tall \(~80 m\)\*\*/g, "**approximately 65 m tall**"],
    [/22 stories, 216 capacity/g, "approximately 65 m tall, 216 capacity"],
    [/\*\*높이 약 80m\(22층\)\*\*/g, "**높이 약 65m**"],
    [/22층/g, "약 65m"],
    [/\*\*高さ約80m（22階建て相当）\*\*/g, "**高さ約65m**"],
    [/22階建て相当/g, "約65m"],
    [/高22层楼/g, "高约65米"],
    [/22層/g, "約65公尺"],
    [/de \*\*22 pisos de altura \(~80 m\)\*\*/g, "de **aproximadamente 65 m de altura**"],
    [/22 pisos/g, "aprox. 65 m"],
  ],
  third_infiltration_tunnel: [
    [/44 km/g, "52 km"],
    [/44km/g, "52km"],
    [/44公里/g, "52公里"],
    [/44 公里/g, "52 公里"],
    [/44キロ/g, "52キロ"],
  ],
  starfield_library_suwon: [
    [/\*\*4 floors\*\* \(1F-4F atrium void\)/g, "**4 floors** (4F-7F atrium space)"],
    [/approximately \*\*70,000 books and magazines\*\*/g, "**a large on-site collection of books and magazines**"],
    [/\*\*4개 층\*\*\(1F~4F 아트리움 보이드\)/g, "**4개 층**(4F~7F 집중 공간)"],
    [/약 \*\*7만 권의 도서 및 잡지\*\*/g, "**대규모 도서 및 잡지 컬렉션**"],
    [/\*\*4フロア\*\*（1F〜4Fのアトリウム吹き抜け）/g, "**4フロア**（4F〜7Fの集中空間）"],
    [/約\*\*70,000冊の書籍・雑誌\*\*/g, "**大規模な書籍・雑誌コレクション**"],
    [/\*\*4个楼层\*\*（1F至4F中庭通高）/g, "**4个楼层**（4F至7F空间）"],
    [/约\*\*70,000册图书及杂志\*\*/g, "**大规模图书及杂志藏书**"],
    [/\*\*4 個樓層\*\*（1F 至 4F 中庭挑空）/g, "**4 個樓層**（4F 至 7F 空間）"],
    [/約\*\*70,000 冊書籍與雜誌\*\*/g, "**大規模書籍與雜誌收藏**"],
    [/\*\*4 plantas\*\* \(vacío del atrio de 1F a 4F\)/g, "**4 plantas** (espacio de 4F a 7F)"],
    [/aproximadamente \*\*70\.000 libros y revistas\*\*/g, "**una amplia colección de libros y revistas**"],
  ],
  bukchon_hanok_village: [
    [
      /signs request silence after 22:00 and limited photography of doorways/g,
      "the busiest residential Red Zone now restricts tourist entry from 17:00 to 10:00 the next day, with fines enforced from March 2025",
    ],
    [/resident-quiet hours 22:00–10:00 are enforced/g, "the Red Zone entry restriction from 17:00 to 10:00 is enforced"],
    [/\*\*Resident-quiet hours 22:00–10:00 enforced\*\*/g, "**Red Zone entry restriction 17:00–10:00 enforced**"],
    [
      /residents request quiet 22:00-10:00/g,
      "Red Zone restricts tourist entry 17:00-10:00; quiet conduct requested throughout residential lanes",
    ],
    [/22:00~10:00/g, "17:00~10:00 레드존 관광객 출입 제한"],
    [/22:00〜10:00/g, "17:00〜10:00のレッドゾーン観光客立入制限"],
    [/22:00至10:00/g, "17:00至10:00红区游客进入限制"],
    [/22:00至翌日10:00/g, "17:00至翌日10:00紅區遊客進入限制"],
    [/22:00 a 10:00/g, "17:00 a 10:00 en la Zona Roja"],
    [/22:00-10:00/g, "17:00-10:00 Red Zone entry restriction"],
  ],
};

const GLOBAL_REPLACEMENTS = [
  [
    /quiet hours are observed 22:00–10:00/g,
    "the Red Zone tourist entry restriction applies 17:00–10:00 in the busiest residential area",
  ],
  [
    /Quiet hours are observed 22:00–10:00/g,
    "The Red Zone tourist entry restriction applies 17:00–10:00 in the busiest residential area",
  ],
  [
    /residents request quiet 22:00–10:00/g,
    "Red Zone restricts tourist entry 17:00–10:00; quiet conduct requested throughout residential lanes",
  ],
  [
    /居民要求22:00–10:00保持安静/g,
    "红区限制游客17:00–10:00进入；全区请保持安静",
  ],
  [
    /居民要求22:00至10:00保持安静/g,
    "红区限制游客17:00至10:00进入；全区请保持安静",
  ],
  [
    /居民要求22:00至翌日10:00保持安靜/g,
    "紅區限制遊客17:00至翌日10:00進入；全區請保持安靜",
  ],
  [
    /~70,000 books \+ magazines accessible FREE/g,
    "Large open reading collection accessible FREE",
  ],
  [
    /~70\.000 libros \+ revistas de acceso GRATUITO/g,
    "Amplia colección de lectura de acceso GRATUITO",
  ],
  [
    /4 floors \(1F-4F atrium void\)/g,
    "4 floors (4F-7F atrium space)",
  ],
  [
    /Adult 6,000 KRW \/ Teen 3,500 KRW \/ Child 2,000 KRW/g,
    "Adults 10,000 KRW / Teenagers 5,000 KRW / Children 3,000 KRW",
  ],
];

let changedFiles = 0;
let changedStops = 0;

for (const { file, locale } of listTourFiles()) {
  const before = readFileSync(file, "utf8");
  const json = JSON.parse(before);
  let fileChanged = false;

  for (const stop of json.itineraryStops ?? []) {
    const poiKey = stop._poi_meta?.poi_key;
    const prior = JSON.stringify(stop);

    if (poiKey === "incheon_cruise_terminal") {
      stop.visitBasics = INCHON_BASICS[locale].visitBasics;
      stop.convenience = INCHON_BASICS[locale].convenience;
    }

    const replacements = REPLACEMENTS[poiKey];
    if (replacements) deepReplace(stop, replacements);

    if (JSON.stringify(stop) !== prior) {
      stop._poi_meta = {
        ...stop._poi_meta,
        verified_date: "2026-05-21",
      };
      changedStops++;
      fileChanged = true;
    }
  }

  const priorJson = JSON.stringify(json);
  deepReplace(json, GLOBAL_REPLACEMENTS);
  if (JSON.stringify(json) !== priorJson) fileChanged = true;

  if (fileChanged) {
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    changedFiles++;
  }
}

console.log(JSON.stringify({ changedFiles, changedStops }, null, 2));
