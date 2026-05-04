// Backfill drawer fields for the 3 Busan tours that had no legacy data:
//   1. from-busan-gyeongju-ancient-capital-day-tour     — copy from busan-gyeongju-unesco-legacy (identical stops)
//   2. busan-private-car-charter-cruise-shore           — author 6 POI x 6 locales (verified facts)
//   3. busan-small-group-sightseeing-tour-cruise-passengers — same 6 POIs as #2

import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

// ============================================================================
// Tour A: from-busan-gyeongju-ancient-capital-day-tour
// Copy from the reference tour which has identical stops.
// ============================================================================
const REF_SLUG = "busan-gyeongju-unesco-legacy-tour-national-museum";

function copyFromReferenceTour() {
  const TARGET = "from-busan-gyeongju-ancient-capital-day-tour";
  for (const L of LOCALES) {
    const refPath = `components/product-tour-static/${REF_SLUG}/${REF_SLUG}.${L}.json`;
    const refJson = JSON.parse(readFileSync(refPath, "utf-8"));
    const refStops = refJson.itineraryStops || [];

    const tgtPath = `components/product-tour-static/${TARGET}/${TARGET}.${L}.json`;
    const tgtJson = JSON.parse(readFileSync(tgtPath, "utf-8"));

    let touched = 0;
    for (const ts of tgtJson.itineraryStops) {
      const ref = refStops.find((r) => r.number === ts.number);
      if (!ref) continue;
      let changed = false;
      for (const f of ["visitBasics", "convenience", "smartNotes"]) {
        if (!ts[f] && ref[f]) {
          ts[f] = ref[f];
          changed = true;
        }
      }
      if (changed) touched++;
    }
    writeFileSync(tgtPath, JSON.stringify(tgtJson, null, 2) + "\n", "utf-8");
    console.log(`  ${TARGET} [${L}] — ${touched} stops filled`);
  }
}

// ============================================================================
// Tours B + C: Busan cruise shore-excursion tours (identical 6 POIs in stops 2-7)
//
// All facts grounded in the existing English `description` text already in the
// JSON (UN Cemetery hours/admission, Taejongdae Danubi train fare, Gamcheon
// stamp map fee, Busan Diamond Tower fare, Jagalchi closure days, etc.).
// ============================================================================
const BUSAN_POIS = {
  en: {
    2: {
      visitBasics: {
        hours: "09:00–18:00 (May–Sep) / 09:00–17:00 (Oct–Apr)",
        closed: "Open year-round (Memorial Service Hall closed during ceremonies)",
        admission: "FREE admission",
        walking: "100% wheelchair-accessible — flat paved paths across the 14-hectare grounds",
      },
      convenience: {
        restroom: "At the Visitor Center and Memorial Service Hall",
        parking: "Free on-site parking + tour-coach drop-off zone",
      },
      smartNotes: {
        photo: "**Wall of Remembrance** (40,896 names on 140 marble panels), **Symbolic Area** with 22 sending-state flags, and the **Frank Gaylord US Korean War Monument (2013)** — same sculptor as the Washington DC National Mall memorial. Photography permitted; respectful silence requested.",
        tip: "**Only UN cemetery in the world** under UN-administered protected territory (UN GA Resolution 977(X), 1955). The annual **'Turn Toward Busan' ceremony on November 11 at 11:00 AM** is the only time all 22 sending-state flags lower in unison.",
      },
    },
    3: {
      visitBasics: {
        hours: "Park 04:00–24:00 (Mar–Oct) / 05:00–24:00 (Nov–Feb); Danubi Train 09:00–sunset",
        closed: "Open year-round (Danubi Train suspends in heavy rain or strong wind)",
        admission: "FREE park entry; **Danubi Train ~₩4,000 round-trip adult**, ~₩2,000 child",
        walking: "Full 4.3 km coastal loop is strenuous; **Danubi Train** stops at Pebble Beach → Gumyeongsa → Observatory → Yeongdo Lighthouse → Taejongsa Temple",
      },
      convenience: {
        restroom: "At the entrance plaza, Observatory, and Yeongdo Lighthouse area",
        parking: "Large free parking lot at the entrance plaza",
      },
      smartNotes: {
        photo: "**3-story Observatory** (panorama to **Tsushima Island, Japan, 50 km southeast** on clear days), **Yeongdo Lighthouse — Busan's oldest, built 1906**, and the wave-cut **Sinseon Rock terrace (~120,000 years old, 4th interglacial period)** below the lighthouse.",
        tip: "Skip the strenuous 4.3 km hike — board the **Danubi Train** for the 5-stop loop. **Taejongsa Temple's Hydrangea Festival** runs late June to early July. Lighthouse area has many steep stairs — not stroller-friendly.",
      },
    },
    4: {
      visitBasics: {
        hours: "Restaurant-dependent (typical 11:30–14:30 lunch service)",
        closed: "Varies by venue; driver confirms availability",
        admission: "**Pay direct, ~₩10,000–25,000 per person**; lunch is **NOT included** in tour price",
        walking: "Minimal — restaurant within 5 min walk of vehicle drop-off",
      },
      convenience: {
        restroom: "Inside the restaurant",
        parking: "Driver drops off and waits at nearest legal stand",
      },
      smartNotes: {
        photo: "**Dwaeji Gukbap** (pork-and-rice soup, Busan's signature comfort dish from the Korean War refugee era) or **Milmyeon** (Busan's wheat-noodle answer to North Korean naengmyeon, originated in 1950s refugee kitchens) make the strongest local food images.",
        tip: "**Vegetarian / halal / allergen requests need 24h advance notice**. Driver recommends per party preference (Korean / seafood / international); ride the recommendation or request a specific cuisine at morning pickup.",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00 (Mar–Oct) / 09:00–17:00 (Nov–Feb); info center same hours",
        closed: "Open year-round",
        admission: "FREE village entry; **Stamp Tour Map ₩2,000** (optional, 9 numbered installations)",
        walking: "Steep stair-streets and narrow alleys — **moderate-to-high** difficulty; **NOT stroller- or wheelchair-friendly**; grippy shoes essential",
      },
      convenience: {
        restroom: "At the info center plaza and along the main alley",
        parking: "Limited — coach drop-off near the info center, no large lot",
      },
      smartNotes: {
        photo: "**'Little Prince and Fox bench'** at Sky Garden (Haneul Maru observatory — long queue, free), **rainbow-roof panorama** from Star Viewing Hall, and the **stair-mural alleys**. **No drones, no flash photography in alleys**.",
        tip: "**Residents still live here** (~10,000 people, 1955 Taegeukdo refugee settlement) — **keep voices down**, don't enter homes, take rubbish with you. **UN-HABITAT Asian Townscape Award 2012**; ~1.4 million visitors annually. KTO 100 Must-Visit Spots 5x consecutively.",
      },
    },
    6: {
      visitBasics: {
        hours: "Park open 24h; **Busan Diamond Tower observatory 10:00–22:00 (last admission 21:30)**",
        closed: "Tower open year-round (occasional safety closures in extreme wind)",
        admission: "Park FREE; **Busan Diamond Tower ₩12,000 adult / ₩9,000 senior 65+ or child 3–12**",
        walking: "**Covered escalator from Gwangbok-ro Fashion Street** for ascent (no return escalator — descend by stairs)",
      },
      convenience: {
        restroom: "At the park plaza and inside Busan Diamond Tower",
        parking: "No on-site parking — use Nampo-dong public lots and walk up via escalator",
      },
      smartNotes: {
        photo: "From the **120 m Busan Diamond Tower observatory** (189 m total summit elevation) — **360° panorama** to Busan Port, Yeongdo Bridge, and Tsushima on clear days. Tower top **modeled after Bulguksa Dabotap baldaquin (NT 20)** in Gyeongju. Best at **sunset and post-dark**.",
        tip: "Pair tower visit with **Admiral Yi Sun-sin statue** (Imjin War turtle-ship hero who never lost a ship) and the **Citizens' Bell** (struck **33 times on New Year's Eve and March 1**, commemorating the 33 signatories of the 1919 Independence Declaration).",
      },
    },
    7: {
      visitBasics: {
        hours: "**Jagalchi Market 05:00–22:00 daily**; live-fish auctions begin 04:00 (advance booking for tourist viewing); Nampo-dong shopping streets 10:30–22:00",
        closed: "**Jagalchi: 1st and 3rd Tuesdays of each month**; Nampo-dong open year-round",
        admission: "FREE access; **2nd-floor hoe restaurants ~₩30,000+ set menus** (price varies by fish)",
        walking: "Flat shopping street + market floor — easy; **2nd-floor hoe restaurants** require a short stair climb",
      },
      convenience: {
        restroom: "Public restrooms at BIFF Square and inside Jagalchi",
        parking: "Use Lotte Department Store or BIFF Square public lots; market itself has no on-site parking",
      },
      smartNotes: {
        photo: "**Seagull-shaped modern building (reopened 2006, architect Hyunjun Mihn)**, **live tanks on the ground floor**, **BIFF Square hand prints** (Park Chan-wook, Bong Joon-ho, etc.), and **Gukje Market** (1,500+ stalls). **Always ask before photographing vendors** — Jagalchi Ajumma can be famously direct about cameras.",
        tip: "**Buy-downstairs / eat-upstairs hoe flow**: pick fresh seafood on the ground floor, have it filleted at a 2nd-floor restaurant (chogochujang + soju standard). **Sannakji (live cut octopus)** is Busan's culinary signature — the dish from *Old Boy* (2003).",
      },
    },
  },

  ko: {
    2: {
      visitBasics: {
        hours: "09:00–18:00 (5~9월) / 09:00–17:00 (10~4월)",
        closed: "연중 개방 (추모식 시 추모관 일시 폐쇄)",
        admission: "무료 입장",
        walking: "14헥타르 부지 전체 휠체어 접근 가능 — 평탄한 포장 산책로",
      },
      convenience: {
        restroom: "방문자센터 및 추모관",
        parking: "무료 주차장 + 단체버스 승하차 구역",
      },
      smartNotes: {
        photo: "**추모벽** (140개 대리석 패널에 40,896명 이름), **22개 파병국 국기가 걸린 상징구역**, **프랭크 게일로드의 미국 한국전 기념비(2013)** — 워싱턴 DC 한국전 참전용사 기념비와 같은 조각가. 촬영 가능, 정숙 요청.",
        tip: "**세계 유일의 UN 묘지** — UN 총회 결의 977(X)호(1955)로 UN 관할 보호 영토 지정. **매년 11월 11일 11:00 'Turn Toward Busan' 추모식**은 22개 파병국 국기가 일제히 조기되는 유일한 시간.",
      },
    },
    3: {
      visitBasics: {
        hours: "공원 04:00–24:00 (3~10월) / 05:00–24:00 (11~2월); 다누비 열차 09:00~일몰",
        closed: "연중 개방 (강풍·폭우 시 다누비 열차 운행 중단)",
        admission: "공원 무료; **다누비 열차 성인 약 ₩4,000 왕복**, 어린이 약 ₩2,000",
        walking: "4.3 km 해안 둘레길 전체는 상당히 힘듦; **다누비 열차**: 자갈마당 → 구명사 → 전망대 → 영도등대 → 태종사",
      },
      convenience: {
        restroom: "입구 광장, 전망대, 영도등대 인근",
        parking: "입구 광장 대형 무료 주차장",
      },
      smartNotes: {
        photo: "**3층 전망대**(맑은 날 남동쪽 50 km **일본 쓰시마섬**까지 조망), **부산 최고령 영도등대(1906년 건립)**, 등대 아래 약 12만년 전 4번째 간빙기 형성된 **신선바위 파식대지**.",
        tip: "4.3 km 도보 코스 대신 **다누비 열차** 5개 정차 코스 추천. **태종사 수국 축제**는 6월 말~7월 초. 등대 구역은 가파른 계단 多 — 유모차 부적합.",
      },
    },
    4: {
      visitBasics: {
        hours: "식당별 상이 (보통 11:30~14:30 점심 영업)",
        closed: "식당별 상이; 기사가 가용성 확인",
        admission: "**현장 결제, 1인 약 ₩10,000~25,000**; 식사는 투어비에 **불포함**",
        walking: "거의 없음 — 차량 정차 지점에서 도보 5분 이내",
      },
      convenience: {
        restroom: "식당 내부",
        parking: "기사가 가까운 합법 정차 지점에서 대기",
      },
      smartNotes: {
        photo: "**돼지국밥** (한국전쟁 피난민 시대에서 유래한 부산 대표 음식) 또는 **밀면** (1950년대 피난민 주방에서 탄생한 부산식 냉면)이 부산 음식 사진으로 가장 강함.",
        tip: "**채식·할랄·알러지 요청은 24시간 전 사전 공지** 필수. 기사가 일행 취향(한식/해산물/양식)에 맞춰 추천 — 추천대로 가거나 픽업 시 특정 음식 요청 가능.",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00 (3~10월) / 09:00–17:00 (11~2월); 안내소 동일",
        closed: "연중무휴",
        admission: "마을 무료; **스탬프 투어 지도 ₩2,000** (선택, 9개 번호 작품 안내)",
        walking: "가파른 계단·골목 — **보통~높음** 난이도; **유모차·휠체어 부적합**; 미끄럼방지 신발 필수",
      },
      convenience: {
        restroom: "안내소 광장 및 메인 골목",
        parking: "제한적 — 안내소 인근 정차, 대형 주차장 없음",
      },
      smartNotes: {
        photo: "**'어린왕자와 여우 벤치'** 하늘마루 전망대 (대기줄 길음, 무료), 별보기 전망대의 **무지개 지붕 파노라마**, **벽화 계단 골목**. **드론·골목 플래시 촬영 금지**.",
        tip: "**주민 약 1만 명 거주** (1955년 태극도 피난 정착지) — **조용히**, 가옥 출입 금지, 쓰레기 가지고 나가기. **2012 UN-HABITAT 아시아 도시경관상**, 연간 약 140만 명 방문, 한국관광공사 100선 5회 연속 선정.",
      },
    },
    6: {
      visitBasics: {
        hours: "공원 24시간; **부산 다이아몬드 타워 전망대 10:00–22:00 (마지막 입장 21:30)**",
        closed: "연중 운영 (강풍 시 일시 폐쇄)",
        admission: "공원 무료; **부산 다이아몬드 타워 성인 ₩12,000 / 65세 이상·3~12세 ₩9,000**",
        walking: "**광복로 패션거리에서 지붕 덮인 에스컬레이터**로 진입 (하행은 계단)",
      },
      convenience: {
        restroom: "공원 광장 및 부산 다이아몬드 타워 내부",
        parking: "주차장 없음 — 남포동 공영주차장 이용 후 에스컬레이터로 이동",
      },
      smartNotes: {
        photo: "**120 m 부산 다이아몬드 타워 전망대** (해발 189 m) — 부산항·영도다리·맑은 날 쓰시마까지 **360° 파노라마**. 타워 상부는 **경주 불국사 다보탑(국보 20호) 보개 양식 차용**. **일몰과 야경**이 베스트.",
        tip: "타워와 함께 **이순신 장군 동상**(임진왜란 거북선, 단 한 척도 잃지 않은 명장), **시민의 종**(섣달 그믐과 3월 1일에 **33번 타종** — 1919년 독립선언 33인 추모)까지 묶으면 30분.",
      },
    },
    7: {
      visitBasics: {
        hours: "**자갈치 시장 매일 05:00–22:00**; 수산 도매 경매는 04:00부터 (관광 견학 사전 예약 필요); 남포동 쇼핑가 10:30–22:00",
        closed: "**자갈치: 매월 첫째·셋째 화요일 휴장**; 남포동 연중무휴",
        admission: "무료; **2층 회 전문점 세트 ₩30,000~** (어종에 따라 상이)",
        walking: "평지 쇼핑거리 + 시장 — 쉬움; **2층 회 전문점**은 짧은 계단",
      },
      convenience: {
        restroom: "BIFF 광장 및 자갈치 내부 공중화장실",
        parking: "롯데백화점 또는 BIFF 광장 공영주차장 이용; 시장 자체 주차장 없음",
      },
      smartNotes: {
        photo: "**갈매기 모양 현대 건물(2006년 재개관, 민현준 설계)**, **1층 활어 수조**, **BIFF 광장 핸드 프린팅**(박찬욱, 봉준호 등), **국제시장**(1,500+ 점포). **상인 촬영 시 반드시 양해 구하기** — 자갈치 아지매들 카메라에 직설적.",
        tip: "**1층 구매 → 2층 조리** 흐름: 1층에서 회 고른 뒤 2층 식당에서 손질(초고추장 + 소주 기본). **산낙지**는 부산 음식의 상징 — 영화 *올드보이*(2003)의 그 음식.",
      },
    },
  },

  ja: {
    2: {
      visitBasics: {
        hours: "09:00–18:00（5–9月）／ 09:00–17:00（10–4月）",
        closed: "通年開放（追悼式中は慰霊館閉鎖）",
        admission: "入場無料",
        walking: "14ヘクタールの敷地全体が車椅子可 — 平坦な舗装路",
      },
      convenience: {
        restroom: "ビジターセンターおよび慰霊館",
        parking: "無料駐車場＋団体バス降車エリア",
      },
      smartNotes: {
        photo: "**追悼壁**（140枚の大理石パネルに40,896名の刻名）、**22派遣国の国旗が並ぶ象徴区域**、**フランク・ゲイロードの米国朝鮮戦争記念碑（2013）** — ワシントンDCの記念碑と同じ彫刻家。撮影可、静粛にお願いします。",
        tip: "**世界唯一のUN墓地** — 1955年UN総会決議977(X)号によりUN管理保護領土。**毎年11月11日11時の『Turn Toward Busan』追悼式**は22派遣国の国旗が一斉に半旗となる年に一度の機会。",
      },
    },
    3: {
      visitBasics: {
        hours: "公園 04:00–24:00（3–10月）／ 05:00–24:00（11–2月）；ダヌビ列車 09:00～日没",
        closed: "通年営業（強風・大雨時はダヌビ列車運休）",
        admission: "公園無料；**ダヌビ列車 大人 約₩4,000 往復**、子供 約₩2,000",
        walking: "4.3 km海岸周回は本格的；**ダヌビ列車**：磯辺 → 求命寺 → 展望台 → 影島灯台 → 太宗寺",
      },
      convenience: {
        restroom: "入口広場、展望台、影島灯台付近",
        parking: "入口広場の大型無料駐車場",
      },
      smartNotes: {
        photo: "**3階展望台**（晴天時に南東50 kmの**対馬**まで展望）、**釜山最古の影島灯台（1906年建造）**、灯台下の約12万年前第4間氷期に形成された**神仙岩波食台**。",
        tip: "4.3 km歩行コースの代わりに**ダヌビ列車**5駅周回がおすすめ。**太宗寺の紫陽花祭り**は6月下旬〜7月上旬。灯台周辺は急な階段多く、ベビーカー不向き。",
      },
    },
    4: {
      visitBasics: {
        hours: "店舗により異なる（通常11:30–14:30の昼営業）",
        closed: "店舗により異なる；ドライバーが営業確認",
        admission: "**現地払い、1人 約₩10,000–25,000**；昼食はツアー料金に**含まれず**",
        walking: "ほぼなし — 車両降車地点から徒歩5分以内",
      },
      convenience: {
        restroom: "店内",
        parking: "ドライバーが最寄りの合法停車地点で待機",
      },
      smartNotes: {
        photo: "**テジクッパ**（朝鮮戦争避難民時代由来の釜山名物）または**ミルミョン**（1950年代避難民厨房発祥の釜山風冷麺）が釜山の食写真として最も映える。",
        tip: "**ベジタリアン・ハラール・アレルゲン対応は24時間前の事前共有**必須。ドライバーが好み（韓食・海鮮・洋食）で推薦 — 推薦に乗るかピックアップ時に希望伝達。",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00（3–10月）／ 09:00–17:00（11–2月）；案内所同じ",
        closed: "年中無休",
        admission: "村は無料；**スタンプツアー地図 ₩2,000**（任意、9番号のインスタレーション案内）",
        walking: "急な階段・路地 — **やや難**；**ベビーカー・車椅子不向き**；滑りにくい靴必須",
      },
      convenience: {
        restroom: "案内所広場およびメイン路地",
        parking: "限定的 — 案内所付近で乗降、大型駐車場なし",
      },
      smartNotes: {
        photo: "**「星の王子さまとキツネのベンチ」**（ハヌルマル展望台、長い列、無料）、星見展望台の**虹色屋根パノラマ**、**壁画の階段路地**。**ドローン・路地でのフラッシュ撮影禁止**。",
        tip: "**約1万人の住民が暮らす集落**（1955年太極道避難定着地） — **静粛**、家屋立入禁止、ゴミ持ち帰り。**2012 UN-HABITATアジア都市景観賞**、年間約140万人来訪、韓国観光公社100選5回連続選定。",
      },
    },
    6: {
      visitBasics: {
        hours: "公園24時間；**釜山ダイヤモンドタワー展望台 10:00–22:00（最終入場 21:30）**",
        closed: "通年営業（強風時は一時閉鎖）",
        admission: "公園無料；**釜山ダイヤモンドタワー 大人 ₩12,000 / 65歳以上・3–12歳 ₩9,000**",
        walking: "**光復路ファッション通りからの屋根付きエスカレーター**で登り（下りは階段）",
      },
      convenience: {
        restroom: "公園広場および釜山ダイヤモンドタワー内",
        parking: "駐車場なし — 南浦洞公共駐車場利用後エスカレーターで移動",
      },
      smartNotes: {
        photo: "**120 m 釜山ダイヤモンドタワー展望台**（標高189 m）— 釜山港・影島大橋・晴天時の対馬まで**360°パノラマ**。タワー頂部は**慶州仏国寺多宝塔（国宝20号）の宝蓋様式を引用**。**夕景・夜景**がベスト。",
        tip: "タワーと合わせて**李舜臣将軍像**（壬辰倭乱の亀甲船で一隻も失わなかった名将）、**市民の鐘**（大晦日と3月1日に**33回打鐘** — 1919年独立宣言33人を追悼）まで30分。",
      },
    },
    7: {
      visitBasics: {
        hours: "**チャガルチ市場 毎日 05:00–22:00**；水産卸売競りは04:00から（観光見学は事前予約）；南浦洞商店街 10:30–22:00",
        closed: "**チャガルチ：毎月第1・第3火曜休場**；南浦洞は年中無休",
        admission: "無料；**2階刺身店セット ₩30,000～**（魚種により変動）",
        walking: "平坦な商店街＋市場 — 容易；**2階刺身店**は短い階段",
      },
      convenience: {
        restroom: "BIFF広場およびチャガルチ内公衆トイレ",
        parking: "ロッテ百貨店またはBIFF広場公共駐車場利用；市場自体の駐車場なし",
      },
      smartNotes: {
        photo: "**カモメ型の現代建築（2006年再開、ミン・ヒョンジュン設計）**、**1階の生簀**、**BIFF広場のハンドプリント**（パク・チャヌク、ポン・ジュノ等）、**国際市場**（1,500+店舗）。**業者の撮影は必ず一声かけて** — チャガルチ・アジュンマはカメラに直接的。",
        tip: "**1階購入 → 2階調理**の流れ：1階で刺身選んで2階の店で捌く（チョコチュジャン＋焼酎が定番）。**サンナクチ（活タコの細切り）**は釜山食文化の象徴 — 映画『オールド・ボーイ』（2003）の名場面の料理。",
      },
    },
  },

  zh: {
    2: {
      visitBasics: {
        hours: "09:00–18:00（5–9月）／ 09:00–17:00（10–4月）",
        closed: "全年开放（追思仪式期间追思堂临时关闭）",
        admission: "免费入场",
        walking: "14公顷园区全程无障碍 — 平整铺装步道",
      },
      convenience: { restroom: "游客中心与追思堂", parking: "免费停车场+大巴上下车区" },
      smartNotes: {
        photo: "**追思墙**（140块大理石板上40,896位将士姓名）、**22派兵国国旗象征区**、**Frank Gaylord的美国朝鲜战争纪念雕塑（2013）** — 与华盛顿DC国家广场纪念碑同一雕塑家。可拍摄，请保持肃静。",
        tip: "**世界唯一的联合国墓地** — 联合国大会977(X)号决议（1955）下的联合国管辖保护领土。**每年11月11日11:00的'Turn Toward Busan'追思仪式**是22派兵国国旗一齐降半旗的唯一时刻。",
      },
    },
    3: {
      visitBasics: {
        hours: "公园 04:00–24:00（3–10月）／ 05:00–24:00（11–2月）；多努比小火车 09:00～日落",
        closed: "全年开放（强风暴雨时小火车停运）",
        admission: "公园免费；**多努比小火车 成人约₩4,000 往返**，儿童约₩2,000",
        walking: "4.3公里海岸环线全程颇费力；**多努比小火车**：石滩 → 求命寺 → 观景台 → 影岛灯塔 → 太宗寺",
      },
      convenience: { restroom: "入口广场、观景台、影岛灯塔附近", parking: "入口广场大型免费停车场" },
      smartNotes: {
        photo: "**三层观景台**（晴日可远眺东南50公里**对马岛**）、**釜山最古老的影岛灯塔（1906年建）**、灯塔下约12万年前第四间冰期形成的**神仙岩浪蚀台**。",
        tip: "免4.3公里徒步，建议**多努比小火车**5站环线。**太宗寺绣球花节**于6月底至7月初。灯塔区段陡阶多，不适合婴儿车。",
      },
    },
    4: {
      visitBasics: {
        hours: "视餐厅而定（通常11:30–14:30 午餐时段）",
        closed: "视餐厅而定；司机确认营业",
        admission: "**现场付款，每人约₩10,000–25,000**；午餐**不含**于团费",
        walking: "极少 — 车辆下车点5分钟内",
      },
      convenience: { restroom: "餐厅内", parking: "司机于最近合法停车点等待" },
      smartNotes: {
        photo: "**猪骨汤饭（돼지국밥）**（源自朝鲜战争避难民时代的釜山名菜）或**麦面（밀면）**（1950年代避难民厨房诞生的釜山式冷面）最能体现釜山美食。",
        tip: "**素食/清真/过敏请提前24小时告知**。司机按团组喜好（韩餐/海鲜/西餐）推荐 — 可采纳推荐或在接送时指定具体菜系。",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00（3–10月）／ 09:00–17:00（11–2月）；游客中心同时段",
        closed: "全年开放",
        admission: "免费入村；**盖章地图 ₩2,000**（自选，含9处编号作品导览）",
        walking: "陡阶+窄巷 — **中等偏高**强度；**婴儿车/轮椅不友好**；防滑鞋必备",
      },
      convenience: { restroom: "游客中心广场及主巷沿线", parking: "有限 — 游客中心附近上下车，无大型停车" },
      smartNotes: {
        photo: "**'小王子与狐狸长椅'**于天空之台（排队较长，免费）、星观展望台**彩虹屋顶全景**、**壁画阶梯巷弄**。**禁止无人机·巷内禁用闪光**。",
        tip: "**村内约1万常住居民**（1955年太极道避难定居地） — **请轻声**、勿入民宅、垃圾带走。**2012 UN-HABITAT亚洲都市景观奖**、年访客约140万、韩国旅游发展局百选连续5次。",
      },
    },
    6: {
      visitBasics: {
        hours: "公园全天开放；**釜山钻石塔观景台 10:00–22:00（最后入场 21:30）**",
        closed: "全年开放（极端大风偶有关闭）",
        admission: "公园免费；**釜山钻石塔 成人 ₩12,000 / 65岁以上与3–12岁 ₩9,000**",
        walking: "**光复路时尚街顶棚扶梯**上行（下行需走阶梯）",
      },
      convenience: { restroom: "公园广场及釜山钻石塔内", parking: "无停车 — 南浦洞公共停车后扶梯上行" },
      smartNotes: {
        photo: "**120米釜山钻石塔观景台**（海拔189米）— 釜山港·影岛大桥·晴日远望对马**360°全景**。塔顶**借鉴庆州佛国寺多宝塔（国宝20号）宝盖样式**。**日落与夜景**最佳。",
        tip: "塔与**李舜臣将军像**（壬辰倭乱龟船名将，未失一船）、**市民钟**（除夕与3月1日**敲钟33次** — 纪念1919独立宣言33签署人）合游约30分钟。",
      },
    },
    7: {
      visitBasics: {
        hours: "**札嘎其市场 每日 05:00–22:00**；水产批发拍卖04:00开始（参观需预约）；南浦洞商街 10:30–22:00",
        closed: "**札嘎其：每月第一与第三个周二闭市**；南浦洞全年开放",
        admission: "免费；**二楼生鱼片店套餐 ₩30,000起**（按鱼种浮动）",
        walking: "平坦商街+市场 — 轻松；**二楼生鱼片店**需走小段阶梯",
      },
      convenience: { restroom: "BIFF广场与札嘎其内公共卫生间", parking: "可用乐天百货或BIFF广场公共停车；市场无自有停车" },
      smartNotes: {
        photo: "**海鸥造型现代建筑（2006重启，闵贤俊设计）**、**一楼活鱼水箱**、**BIFF广场掌印**（朴赞郁、奉俊昊等）、**国际市场**（1,500+商铺）。**拍商贩务必先打招呼** — 札嘎其阿姨对镜头直接。",
        tip: "**一楼采购→二楼料理**：一楼挑生鱼，二楼餐厅代加工（醋辣酱+烧酒为标配）。**生章鱼（산낙지）**是釜山饮食的标志 — 电影《老男孩》（2003）名场面的食物。",
      },
    },
  },

  "zh-TW": {
    2: {
      visitBasics: {
        hours: "09:00–18:00（5–9月）／ 09:00–17:00（10–4月）",
        closed: "全年開放（追思儀式期間追思堂臨時關閉）",
        admission: "免費入場",
        walking: "14公頃園區全程無障礙 — 平整鋪裝步道",
      },
      convenience: { restroom: "遊客中心與追思堂", parking: "免費停車場+大巴上下車區" },
      smartNotes: {
        photo: "**追思牆**（140塊大理石板上40,896位將士姓名）、**22派兵國國旗象徵區**、**Frank Gaylord的美國朝鮮戰爭紀念雕塑（2013）** — 與華盛頓DC國家廣場紀念碑同一雕塑家。可拍攝，請保持肅靜。",
        tip: "**世界唯一的聯合國墓地** — 聯合國大會977(X)號決議（1955）下的聯合國管轄保護領土。**每年11月11日11:00的『Turn Toward Busan』追思儀式**是22派兵國國旗一齊降半旗的唯一時刻。",
      },
    },
    3: {
      visitBasics: {
        hours: "公園 04:00–24:00（3–10月）／ 05:00–24:00（11–2月）；多努比小火車 09:00～日落",
        closed: "全年開放（強風暴雨時小火車停運）",
        admission: "公園免費；**多努比小火車 成人約₩4,000 往返**，兒童約₩2,000",
        walking: "4.3公里海岸環線全程頗費力；**多努比小火車**：石灘 → 求命寺 → 觀景台 → 影島燈塔 → 太宗寺",
      },
      convenience: { restroom: "入口廣場、觀景台、影島燈塔附近", parking: "入口廣場大型免費停車場" },
      smartNotes: {
        photo: "**三層觀景台**（晴日可遠眺東南50公里**對馬島**）、**釜山最古老的影島燈塔（1906年建）**、燈塔下約12萬年前第四間冰期形成的**神仙岩浪蝕台**。",
        tip: "免4.3公里徒步，建議**多努比小火車**5站環線。**太宗寺繡球花節**於6月底至7月初。燈塔區段陡階多，不適合嬰兒車。",
      },
    },
    4: {
      visitBasics: {
        hours: "視餐廳而定（通常11:30–14:30 午餐時段）",
        closed: "視餐廳而定；司機確認營業",
        admission: "**現場付款，每人約₩10,000–25,000**；午餐**不含**於團費",
        walking: "極少 — 車輛下車點5分鐘內",
      },
      convenience: { restroom: "餐廳內", parking: "司機於最近合法停車點等待" },
      smartNotes: {
        photo: "**豬骨湯飯（돼지국밥）**（源自朝鮮戰爭避難民時代的釜山名菜）或**麥麵（밀면）**（1950年代避難民廚房誕生的釜山式冷麵）最能體現釜山美食。",
        tip: "**素食/清真/過敏請提前24小時告知**。司機按團組喜好（韓餐/海鮮/西餐）推薦 — 可採納推薦或在接送時指定具體菜系。",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00（3–10月）／ 09:00–17:00（11–2月）；遊客中心同時段",
        closed: "全年開放",
        admission: "免費入村；**蓋章地圖 ₩2,000**（自選，含9處編號作品導覽）",
        walking: "陡階+窄巷 — **中等偏高**強度；**嬰兒車/輪椅不友善**；防滑鞋必備",
      },
      convenience: { restroom: "遊客中心廣場及主巷沿線", parking: "有限 — 遊客中心附近上下車，無大型停車" },
      smartNotes: {
        photo: "**「小王子與狐狸長椅」**於天空之台（排隊較長，免費）、星觀展望台**彩虹屋頂全景**、**壁畫階梯巷弄**。**禁止無人機·巷內禁用閃光**。",
        tip: "**村內約1萬常住居民**（1955年太極道避難定居地） — **請輕聲**、勿入民宅、垃圾帶走。**2012 UN-HABITAT亞洲都市景觀獎**、年訪客約140萬、韓國旅遊發展局百選連續5次。",
      },
    },
    6: {
      visitBasics: {
        hours: "公園全天開放；**釜山鑽石塔觀景台 10:00–22:00（最後入場 21:30）**",
        closed: "全年開放（極端大風偶有關閉）",
        admission: "公園免費；**釜山鑽石塔 成人 ₩12,000 / 65歲以上與3–12歲 ₩9,000**",
        walking: "**光復路時尚街頂棚手扶梯**上行（下行需走階梯）",
      },
      convenience: { restroom: "公園廣場及釜山鑽石塔內", parking: "無停車 — 南浦洞公共停車後手扶梯上行" },
      smartNotes: {
        photo: "**120公尺釜山鑽石塔觀景台**（海拔189公尺）— 釜山港·影島大橋·晴日遠望對馬**360°全景**。塔頂**借鏡慶州佛國寺多寶塔（國寶20號）寶蓋樣式**。**日落與夜景**最佳。",
        tip: "塔與**李舜臣將軍像**（壬辰倭亂龜船名將，未失一船）、**市民鐘**（除夕與3月1日**敲鐘33次** — 紀念1919獨立宣言33簽署人）合遊約30分鐘。",
      },
    },
    7: {
      visitBasics: {
        hours: "**札嘎其市場 每日 05:00–22:00**；水產批發拍賣04:00開始（參觀需預約）；南浦洞商街 10:30–22:00",
        closed: "**札嘎其：每月第一與第三個週二閉市**；南浦洞全年開放",
        admission: "免費；**二樓生魚片店套餐 ₩30,000起**（按魚種浮動）",
        walking: "平坦商街+市場 — 輕鬆；**二樓生魚片店**需走小段階梯",
      },
      convenience: { restroom: "BIFF廣場與札嘎其內公共衛生間", parking: "可用樂天百貨或BIFF廣場公共停車；市場無自有停車" },
      smartNotes: {
        photo: "**海鷗造型現代建築（2006重啟，閔賢俊設計）**、**一樓活魚水箱**、**BIFF廣場掌印**（朴贊郁、奉俊昊等）、**國際市場**（1,500+商鋪）。**拍商販務必先打招呼** — 札嘎其阿姨對鏡頭直接。",
        tip: "**一樓採購→二樓料理**：一樓挑生魚，二樓餐廳代加工（醋辣醬+燒酒為標配）。**生章魚（산낙지）**是釜山飲食的標誌 — 電影《原罪犯》（2003）名場面的食物。",
      },
    },
  },

  es: {
    2: {
      visitBasics: {
        hours: "09:00–18:00 (mayo–septiembre) / 09:00–17:00 (octubre–abril)",
        closed: "Abierto todo el año (la Sala Conmemorativa cierra durante ceremonias)",
        admission: "Entrada gratuita",
        walking: "100% accesible para sillas de ruedas — caminos pavimentados llanos en las 14 hectáreas",
      },
      convenience: {
        restroom: "En el Centro de Visitantes y la Sala Conmemorativa",
        parking: "Aparcamiento gratuito + zona de descenso para autobuses",
      },
      smartNotes: {
        photo: "**Muro del Recuerdo** (40.896 nombres en 140 paneles de mármol), **Área Simbólica** con las banderas de las 22 naciones contribuyentes y el **Monumento Estadounidense de la Guerra de Corea (Frank Gaylord, 2013)** — del mismo escultor que el monumento de Washington DC. Se permite fotografiar; se pide silencio respetuoso.",
        tip: "**Único cementerio de la ONU del mundo** — territorio protegido administrado por la ONU bajo la Resolución 977(X) de la AGNU (1955). La **ceremonia anual 'Turn Toward Busan' el 11 de noviembre a las 11:00** es la única vez que las 22 banderas se izan a media asta al unísono.",
      },
    },
    3: {
      visitBasics: {
        hours: "Parque 04:00–24:00 (marzo–octubre) / 05:00–24:00 (noviembre–febrero); tren Danubi 09:00 al ocaso",
        closed: "Abierto todo el año (el tren Danubi se suspende con viento fuerte o lluvia intensa)",
        admission: "Acceso al parque gratuito; **tren Danubi ~₩4.000 ida y vuelta adulto**, ~₩2.000 niño",
        walking: "El circuito completo de 4,3 km es exigente; **tren Danubi**: Playa de Guijarros → Templo Gumyeongsa → Mirador → Faro de Yeongdo → Templo Taejongsa",
      },
      convenience: {
        restroom: "En la plaza de entrada, el mirador y la zona del faro",
        parking: "Gran aparcamiento gratuito en la plaza de entrada",
      },
      smartNotes: {
        photo: "**Mirador de 3 plantas** (panorámica hasta la **isla Tsushima, Japón, a 50 km al sureste** en días claros), **faro de Yeongdo — el más antiguo de Busan, construido en 1906** y la **terraza de roca Sinseon (~120.000 años, 4.º interglacial)** bajo el faro.",
        tip: "Evite la caminata de 4,3 km — tome el **tren Danubi** para el circuito de 5 paradas. El **Festival de las Hortensias del templo Taejongsa** se celebra de finales de junio a inicios de julio. La zona del faro tiene escaleras pronunciadas — no apto para carritos.",
      },
    },
    4: {
      visitBasics: {
        hours: "Depende del restaurante (servicio típico de almuerzo 11:30–14:30)",
        closed: "Varía según el local; el conductor confirma la disponibilidad",
        admission: "**Pago en sitio, ~₩10.000–25.000 por persona**; el almuerzo **NO está incluido** en el precio del tour",
        walking: "Mínimo — el restaurante queda a menos de 5 min andando del descenso del coche",
      },
      convenience: { restroom: "Dentro del restaurante", parking: "El conductor descarga y espera en el punto legal más cercano" },
      smartNotes: {
        photo: "**Dwaeji Gukbap** (sopa de arroz con cerdo, plato emblema de Busan nacido en la era de los refugiados de la Guerra de Corea) o **Milmyeon** (la respuesta de Busan al naengmyeon norcoreano, originada en cocinas de refugiados de los años 1950) ofrecen las imágenes gastronómicas más representativas.",
        tip: "**Solicitudes vegetarianas / halal / por alérgenos requieren 24 h de aviso**. El conductor recomienda según la preferencia del grupo (coreana / mariscos / internacional); siga la recomendación o pida una cocina específica al recogerlos.",
      },
    },
    5: {
      visitBasics: {
        hours: "09:00–18:00 (marzo–octubre) / 09:00–17:00 (noviembre–febrero); centro de información mismo horario",
        closed: "Abierto todo el año",
        admission: "Acceso libre al pueblo; **Mapa-sello del Recorrido ₩2.000** (opcional, 9 instalaciones numeradas)",
        walking: "Calles-escalera empinadas y callejones estrechos — dificultad **moderada-alta**; **NO apto para carritos ni sillas de ruedas**; calzado antideslizante esencial",
      },
      convenience: {
        restroom: "En la plaza del centro de información y a lo largo del callejón principal",
        parking: "Limitado — descenso del coche cerca del centro de información, sin gran aparcamiento",
      },
      smartNotes: {
        photo: "**Banco 'El Principito y el Zorro'** en Sky Garden (mirador Haneul Maru — cola larga, gratis), **panorámica de tejados arcoíris** desde Star Viewing Hall y los **callejones-escalera con murales**. **Prohibidos drones y flash en los callejones**.",
        tip: "**Aún viven aquí ~10.000 residentes** (asentamiento de refugiados Taegeukdo de 1955) — **mantenga la voz baja**, no entre en las viviendas, llévese su basura. **Premio UN-HABITAT al Paisaje Urbano Asiático 2012**; ~1,4 millones de visitantes anuales; KTO 'Top 100 lugares' 5 veces seguidas.",
      },
    },
    6: {
      visitBasics: {
        hours: "Parque abierto 24 h; **mirador Busan Diamond Tower 10:00–22:00 (último ingreso 21:30)**",
        closed: "Torre abierta todo el año (cierres puntuales por viento extremo)",
        admission: "Parque gratuito; **Busan Diamond Tower ₩12.000 adulto / ₩9.000 mayor de 65 o niño 3–12**",
        walking: "**Escaleras mecánicas cubiertas desde Gwangbok-ro Fashion Street** para subir (no hay mecánica de bajada — descenso por escalones)",
      },
      convenience: {
        restroom: "En la plaza del parque y dentro de la Busan Diamond Tower",
        parking: "Sin aparcamiento — use los públicos de Nampo-dong y suba por las mecánicas",
      },
      smartNotes: {
        photo: "Desde el mirador de la **Busan Diamond Tower de 120 m** (189 m de elevación total) — **panorámica de 360°** al puerto de Busan, el puente de Yeongdo y Tsushima en días claros. La cúspide está **modelada según el baldaquino del Dabotap (TN 20) del templo Bulguksa** en Gyeongju. Mejor **al atardecer y al anochecer**.",
        tip: "Combine la torre con la **estatua del almirante Yi Sun-sin** (héroe de la Guerra Imjin, dueño de los barcos-tortuga, nunca perdió una nave) y la **Campana de los Ciudadanos** (toca **33 veces en Nochevieja y el 1 de marzo**, en memoria de los 33 firmantes de la Declaración de Independencia de 1919).",
      },
    },
    7: {
      visitBasics: {
        hours: "**Mercado Jagalchi 05:00–22:00 todos los días**; subastas mayoristas desde 04:00 (visita turística con reserva previa); calles comerciales de Nampo-dong 10:30–22:00",
        closed: "**Jagalchi: 1.º y 3.º martes de cada mes**; Nampo-dong abierto todo el año",
        admission: "Acceso libre; **menús de hoe en la 2.ª planta desde ~₩30.000** (varía según pescado)",
        walking: "Calles comerciales llanas + planta del mercado — fácil; **restaurantes de hoe en la 2.ª planta** requieren un pequeño tramo de escaleras",
      },
      convenience: {
        restroom: "Aseos públicos en BIFF Square y dentro de Jagalchi",
        parking: "Use los aparcamientos públicos de Lotte Department Store o BIFF Square; el mercado no tiene aparcamiento propio",
      },
      smartNotes: {
        photo: "**Edificio moderno con forma de gaviota (reabierto 2006, arquitecto Hyunjun Mihn)**, **tanques de pescado vivo en la planta baja**, **huellas de manos en BIFF Square** (Park Chan-wook, Bong Joon-ho, etc.) y el **Mercado Gukje** (1.500+ puestos). **Pida permiso siempre antes de fotografiar a vendedoras** — las Jagalchi Ajumma son famosas por ser directas con las cámaras.",
        tip: "**Comprar abajo / comer arriba**: elija mariscos en planta baja y haga que se los preparen en un restaurante de la 2.ª planta (chogochujang + soju estándar). **Sannakji (pulpo vivo cortado)** es el plato emblema de Busan — el del célebre plano de *Old Boy* (2003).",
      },
    },
  },
};

function applyBusanCruiseTours() {
  const SLUGS = [
    "busan-private-car-charter-cruise-shore",
    "busan-small-group-sightseeing-tour-cruise-passengers",
  ];
  for (const slug of SLUGS) {
    for (const L of LOCALES) {
      const path = `components/product-tour-static/${slug}/${slug}.${L}.json`;
      const json = JSON.parse(readFileSync(path, "utf-8"));
      const data = BUSAN_POIS[L];
      let touched = 0;
      for (const stop of json.itineraryStops) {
        const block = data[stop.number];
        if (!block) continue; // skip transport stops (1, 8)
        let changed = false;
        for (const f of ["visitBasics", "convenience", "smartNotes"]) {
          if (!stop[f] && block[f]) {
            stop[f] = block[f];
            changed = true;
          }
        }
        if (changed) touched++;
      }
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf-8");
      console.log(`  ${slug} [${L}] — ${touched} stops filled`);
    }
  }
}

console.log("--- Tour A: from-busan-gyeongju ← copy from busan-gyeongju-unesco-legacy");
copyFromReferenceTour();
console.log();
console.log("--- Tours B+C: Busan cruise tours ← author POI data");
applyBusanCruiseTours();
console.log();
console.log("done");
