#!/usr/bin/env node
/**
 * Fill the `pickup_dropoff` block on non-EN bundles that never got one.
 *
 * 🔴 THIS IS A LIVE GUEST-FACING HOLE, NOT A COSMETIC ONE. The detail page
 * renders the whole "Pickup & Map" section only when `pickup_dropoff` is
 * present on the view model (TourProductDetailClient.tsx: `vm.pickup_dropoff ?`
 * … , loadTourProductPage.ts: spreads it only when non-null). Where the block
 * is missing, the section — map, pickup list, drop-off list — is simply absent
 * and the timeline runs straight from the last stop into "What's included".
 *
 * Measured on production 2026-08-05 by counting `id="pickup-dropoff"` in the
 * server HTML (⚠ /zh/ renders client-side and returns a ~32 KB shell, so it
 * cannot be measured this way — do not read a 0 there as a defect):
 *
 *   busan-top-attractions-day-tour               en OK · ko/ja/zh-TW/es MISSING
 *   jeju-grand-highlights-loop                   en OK · ko/ja/zh-TW/es MISSING
 *   busan-small-group-sightseeing-…-passengers   en OK · ko MISSING
 *   incheon-seoul-private-car-shore-excursion…   en OK · ko MISSING
 *
 * The cause is the same everywhere: the block only ever existed in the EN
 * bundle. `scripts/gen_pickup_sql.js` once wrote localized copies straight to
 * the DB without ever writing them back to the repo, so any later statement
 * that rewrote a locale's detail_payload from its bundle dropped the block.
 * Fixing the repo is what stops it coming back.
 *
 * busan-top-attractions-day-tour is handled by
 * scripts/align-busan-top-attractions-pickup-2026-08.mjs (same session) and is
 * deliberately not repeated here.
 *
 * Blocked products are included on purpose — they are cheap to fix now and
 * would otherwise ship the same hole the day they are re-opened.
 *
 * Usage: node scripts/fill-missing-locale-pickup-dropoff-2026-08.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, '..', 'components', 'product-tour-static');
const LOCALES = ['ko', 'ja', 'zh', 'zh-TW', 'es'];
const CHECK_ONLY = process.argv.includes('--check');

/** Three Jeju day tours share one pickup set; only the clock differs. */
const JEJU = ['jeju-grand-highlights-loop', 'jeju-west-south-full-day-authentic-tour', 'jeju-hydrangea-festival-tour-southwest-route'];
const BUSAN_CRUISE = 'busan-small-group-sightseeing-tour-cruise-passengers';
const INCHEON_PRIVATE = 'incheon-seoul-private-car-shore-excursion-cruise';
const INCHEON_SHARED = 'from-incheon-seoul-day-tour-cruise-guests';

/**
 * Translations keyed by the EN string they replace. Anything in an EN bundle's
 * pickup_dropoff that is not in here throws — a missed key would ship English
 * into a Korean page, which is the failure mode this whole script exists to
 * clean up.
 */
const T = {
  // ── Jeju points ────────────────────────────────────────────────────────
  'Ocean Suites Jeju Hotel': {
    ko: '오션스위츠 제주호텔', ja: 'オーシャンスイーツ済州ホテル', zh: '海洋套房济州酒店',
    'zh-TW': '海洋套房濟州酒店', es: 'Ocean Suites Jeju Hotel',
  },
  'Jeju International Airport (3F, Gate 3)': {
    ko: '제주국제공항 (3층 3번 게이트)', ja: '済州国際空港（3階・3番ゲート）', zh: '济州国际机场（3楼3号门）',
    'zh-TW': '濟州國際機場（3樓3號閘口）', es: 'Aeropuerto Internacional de Jeju (3.ª planta, puerta 3)',
  },
  'LOTTE City Hotel Jeju': {
    ko: '롯데시티호텔 제주', ja: 'ロッテシティホテル済州', zh: '乐天城市酒店济州',
    'zh-TW': '樂天城市飯店濟州', es: 'LOTTE City Hotel Jeju',
  },
  'Shilla Duty Free (Jeju Store)': {
    ko: '신라면세점 (제주점)', ja: '新羅免税店（済州店）', zh: '新罗免税店（济州店）',
    'zh-TW': '新羅免稅店（濟州店）', es: 'Shilla Duty Free (tienda de Jeju)',
  },
  'Dongmun Traditional Market': {
    ko: '동문재래시장', ja: '東門在来市場', zh: '东门传统市场',
    'zh-TW': '東門傳統市場', es: 'Mercado Tradicional de Dongmun',
  },
  'Meet in the hotel lobby — guide holds an AtoCKorea sign.': {
    ko: '호텔 로비에서 만납니다 — 가이드가 AtoCKorea 팻말을 들고 있습니다.',
    ja: 'ホテルのロビーで合流します — ガイドがAtoCKoreaの看板を持っています。',
    zh: '在酒店大堂集合 — 导游会举着AtoCKorea的牌子。',
    'zh-TW': '在飯店大廳集合 — 導遊會舉著AtoCKorea的牌子。',
    es: 'Encuentro en el vestíbulo del hotel: el guía lleva un cartel de AtoCKorea.',
  },
  '3rd floor departures area. Follow signs to Gate 3.': {
    ko: '3층 출발층입니다. 3번 게이트 표지를 따라오세요.',
    ja: '3階の出発フロアです。3番ゲートの案内に従ってお越しください。',
    zh: '3楼出发层。请沿着3号门的指示牌前往。',
    'zh-TW': '3樓出發層。請沿著3號閘口的指示牌前往。',
    es: 'Zona de salidas de la 3.ª planta. Sigue las indicaciones hacia la puerta 3.',
  },
  'Wait in the main lobby — guide will call you by name.': {
    ko: '메인 로비에서 기다려 주세요 — 가이드가 성함을 불러 드립니다.',
    ja: 'メインロビーでお待ちください — ガイドがお名前をお呼びします。',
    zh: '请在大堂等候 — 导游会叫您的名字。',
    'zh-TW': '請在大廳等候 — 導遊會叫您的名字。',
    es: 'Espera en el vestíbulo principal: el guía te llamará por tu nombre.',
  },
  'Meet outside the main entrance of Shilla Duty Free, Jeju branch.': {
    ko: '신라면세점 제주점 정문 앞에서 만납니다.',
    ja: '新羅免税店 済州店の正面入口前で合流します。',
    zh: '在新罗免税店济州店正门外集合。',
    'zh-TW': '在新羅免稅店濟州店正門外集合。',
    es: 'Encuentro en la entrada principal de Shilla Duty Free, sucursal de Jeju.',
  },
  'Return usually runs around 17:30–18:00.': {
    ko: '복귀는 보통 17:30~18:00 사이입니다.',
    ja: '帰着はおおむね17:30〜18:00です。',
    zh: '返程通常在17:30–18:00之间。',
    'zh-TW': '返程通常在17:30–18:00之間。',
    es: 'El regreso suele ser entre las 17:30 y las 18:00.',
  },

  // ── Busan cruise terminals ────────────────────────────────────────────
  'Busan International Cruise Terminal (영도 크루즈항 — Dongsam, Yeongdo)': {
    ko: '부산항국제크루즈터미널 (영도 동삼동)',
    ja: '釜山国際クルーズターミナル（影島・東三洞）',
    zh: '釜山国际邮轮码头（影岛东三洞）',
    'zh-TW': '釜山國際郵輪碼頭（影島東三洞）',
    es: 'Terminal Internacional de Cruceros de Busan (Dongsam, Yeongdo)',
  },
  'Busan Port International Passenger Terminal (부산항국제여객터미널 — Choryang)': {
    ko: '부산항국제여객터미널 (초량)',
    ja: '釜山港国際旅客ターミナル（草梁）',
    zh: '釜山港国际客运码头（草梁）',
    'zh-TW': '釜山港國際客運碼頭（草梁）',
    es: 'Terminal Internacional de Pasajeros del Puerto de Busan (Choryang)',
  },
  'Busan International Cruise Terminal (영도 크루즈항)': {
    ko: '부산항국제크루즈터미널 (영도)',
    ja: '釜山国際クルーズターミナル（影島）',
    zh: '釜山国际邮轮码头（影岛）',
    'zh-TW': '釜山國際郵輪碼頭（影島）',
    es: 'Terminal Internacional de Cruceros de Busan (Yeongdo)',
  },
  'Busan Port International Passenger Terminal (Choryang)': {
    ko: '부산항국제여객터미널 (초량)',
    ja: '釜山港国際旅客ターミナル（草梁）',
    zh: '釜山港国际客运码头（草梁）',
    'zh-TW': '釜山港國際客運碼頭（草梁）',
    es: 'Terminal Internacional de Pasajeros del Puerto de Busan (Choryang)',
  },
  'Confirmed at booking (≈30 min after ship docking)': {
    ko: '예약 시 확정 (선박 접안 후 약 30분)',
    ja: 'ご予約時に確定（着岸から約30分後）',
    zh: '预订时确认（船舶靠港后约30分钟）',
    'zh-TW': '訂購時確認（船舶靠港後約30分鐘）',
    es: 'Se confirma al reservar (≈30 min después del atraque)',
  },
  'Busan cruise ships berth at either terminal — which one applies to you depends on where your ship docks, and is confirmed at booking. Meet your guide in the arrival hall.': {
    ko: '부산 크루즈선은 두 터미널 중 한 곳에 접안합니다. 어느 쪽인지는 선박 접안 위치에 따라 정해지며 예약 시 확정됩니다. 도착 홀에서 가이드를 만나세요.',
    ja: '釜山のクルーズ船は2つのターミナルのいずれかに着岸します。どちらになるかは船の着岸場所によって決まり、ご予約時に確定します。到着ホールでガイドとお会いください。',
    zh: '釜山的邮轮会停靠其中一个码头，具体是哪一个取决于您所乘船舶的靠泊位置，并在预订时确认。请在到达大厅与导游会合。',
    'zh-TW': '釜山的郵輪會停靠其中一個碼頭，具體是哪一個取決於您所乘船舶的靠泊位置，並在訂購時確認。請在抵達大廳與導遊會合。',
    es: 'Los cruceros de Busan atracan en una de las dos terminales; cuál te corresponde depende de dónde amarre tu barco y se confirma al reservar. Encuentra a tu guía en la sala de llegadas.',
  },
  'Provide ship name, port-call date, expected disembarkation time, and all-aboard time at booking. Pickup terminal (Yeongdo Cruise Terminal or Choryang Passenger Terminal) is set by where your ship docks. Shared van with other cruise passengers; on-time return is the product.': {
    ko: '예약 시 선박명, 기항일, 예상 하선 시각, 승선 마감 시각을 알려 주세요. 픽업 터미널(영도 크루즈터미널 또는 초량 여객터미널)은 선박 접안 위치에 따라 정해집니다. 다른 크루즈 승객과 함께 타는 밴이며, 정시 복귀가 이 상품의 핵심입니다.',
    ja: 'ご予約時に船名、寄港日、下船予定時刻、乗船締切時刻をお知らせください。乗車ターミナル（影島クルーズターミナルまたは草梁旅客ターミナル）は船の着岸場所によって決まります。他のクルーズ乗客との相乗りバンで、定刻での帰着がこの商品の要です。',
    zh: '预订时请提供船名、停靠日期、预计下船时间与最晚登船时间。上车码头（影岛邮轮码头或草梁客运码头）由船舶靠泊位置决定。与其他邮轮乘客共乘一辆车，准时返回是本产品的核心。',
    'zh-TW': '訂購時請提供船名、停靠日期、預計下船時間與最晚登船時間。上車碼頭（影島郵輪碼頭或草梁客運碼頭）由船舶靠泊位置決定。與其他郵輪旅客共乘一輛車，準時返回是本產品的核心。',
    es: 'Indica al reservar el nombre del barco, la fecha de escala, la hora prevista de desembarque y la hora de embarque final. La terminal de recogida (Cruceros de Yeongdo o Pasajeros de Choryang) la determina dónde amarre tu barco. Furgoneta compartida con otros pasajeros de crucero; el regreso puntual es el producto.',
  },

  // ── Incheon cruise terminal ───────────────────────────────────────────
  'Incheon Cruise Terminal (driver holds name sign)': {
    ko: '인천항 크루즈터미널 (기사가 성함 팻말을 들고 대기)',
    ja: '仁川港クルーズターミナル（ドライバーがお名前の看板を持ってお待ちします）',
    zh: '仁川港邮轮码头（司机举着写有姓名的接机牌）',
    'zh-TW': '仁川港郵輪碼頭（司機舉著寫有姓名的接機牌）',
    es: 'Terminal de Cruceros de Incheon (el conductor sostiene un cartel con tu nombre)',
  },
  'Incheon Cruise Terminal (terminal gate)': {
    ko: '인천항 크루즈터미널 (터미널 게이트)',
    ja: '仁川港クルーズターミナル（ターミナルゲート）',
    zh: '仁川港邮轮码头（码头闸口）',
    'zh-TW': '仁川港郵輪碼頭（碼頭閘口）',
    es: 'Terminal de Cruceros de Incheon (puerta de la terminal)',
  },
  'Incheon Cruise Terminal (Songdo)': {
    ko: '인천항 크루즈터미널 (송도)',
    ja: '仁川港クルーズターミナル（松島／ソンド）',
    zh: '仁川港邮轮码头（松岛）',
    'zh-TW': '仁川港郵輪碼頭（松島）',
    es: 'Terminal de Cruceros de Incheon (Songdo)',
  },
  'Incheon Cruise Terminal': {
    ko: '인천항 크루즈터미널',
    ja: '仁川港クルーズターミナル',
    zh: '仁川港邮轮码头',
    'zh-TW': '仁川港郵輪碼頭',
    es: 'Terminal de Cruceros de Incheon',
  },
  'Calibrated to your disembarkation time': {
    ko: '하선 시각에 맞춰 조정',
    ja: '下船時刻に合わせて調整',
    zh: '按您的下船时间安排',
    'zh-TW': '依您的下船時間安排',
    es: 'Ajustado a tu hora de desembarque',
  },
  'Calibrated to ship disembarkation': {
    ko: '선박 하선 시각에 맞춰 조정',
    ja: '船の下船時刻に合わせて調整',
    zh: '按船舶下船时间安排',
    'zh-TW': '依船舶下船時間安排',
    es: 'Ajustado al desembarque del barco',
  },
  'Provide ship name, port-call date, expected arrival, and all-aboard time at booking. Pickup is at the Incheon Cruise Terminal in Songdo (the dedicated ocean-cruise terminal; do NOT confuse with the Incheon International Ferry Terminal or with Incheon Airport on Yeongjong Island). Driver maintains a 60-minute traffic buffer before all-aboard. On-time return is guaranteed — never missed a sail-away.': {
    ko: '예약 시 선박명, 기항일, 예상 도착 시각, 승선 마감 시각을 알려 주세요. 픽업은 송도의 인천항 크루즈터미널입니다(외항 크루즈 전용 터미널로, 인천항 국제여객터미널이나 영종도의 인천공항과 혼동하지 마세요). 기사는 승선 마감 60분 전을 교통 여유로 잡습니다. 정시 복귀를 보장하며, 출항을 놓친 적이 없습니다.',
    ja: 'ご予約時に船名、寄港日、到着予定、乗船締切時刻をお知らせください。お迎えは松島（ソンド）の仁川港クルーズターミナルです（外洋クルーズ専用ターミナルで、仁川港国際旅客ターミナルや永宗島の仁川空港とは異なります）。ドライバーは乗船締切の60分前を交通の余裕として確保します。定刻の帰着を保証しており、出港に遅れたことはありません。',
    zh: '预订时请提供船名、停靠日期、预计抵达时间与最晚登船时间。上车地点为松岛的仁川港邮轮码头（专用远洋邮轮码头，请勿与仁川港国际客运码头或永宗岛的仁川机场混淆）。司机会在最晚登船时间前预留60分钟的交通缓冲。保证准时返回 — 从未错过开航。',
    'zh-TW': '訂購時請提供船名、停靠日期、預計抵達時間與最晚登船時間。上車地點為松島的仁川港郵輪碼頭（專用遠洋郵輪碼頭，請勿與仁川港國際客運碼頭或永宗島的仁川機場混淆）。司機會在最晚登船時間前預留60分鐘的交通緩衝。保證準時返回 — 從未錯過開航。',
    es: 'Indica al reservar el nombre del barco, la fecha de escala, la hora prevista de llegada y la hora de embarque final. La recogida es en la Terminal de Cruceros de Incheon, en Songdo (la terminal dedicada a cruceros oceánicos; NO la confundas con la Terminal Internacional de Ferris de Incheon ni con el aeropuerto de Incheon, en la isla de Yeongjong). El conductor reserva 60 minutos de margen por tráfico antes del embarque final. Regreso puntual garantizado: nunca se ha perdido una salida.',
  },
  'Provide ship name, port-call date, expected disembarkation time, and all-aboard time at booking. Pickup is at the Incheon Cruise Terminal in Songdo (the dedicated ocean-cruise terminal; do NOT confuse with the Incheon International Ferry Terminal or with Incheon Airport on Yeongjong Island). Shared van with other cruise passengers from various ships; if multiple ships sail at different times, earliest-sailing passengers are dropped first. On-time return is the product.': {
    ko: '예약 시 선박명, 기항일, 예상 하선 시각, 승선 마감 시각을 알려 주세요. 픽업은 송도의 인천항 크루즈터미널입니다(외항 크루즈 전용 터미널로, 인천항 국제여객터미널이나 영종도의 인천공항과 혼동하지 마세요). 여러 선박의 크루즈 승객과 함께 타는 밴이며, 출항 시각이 다를 경우 먼저 출항하는 손님부터 내려 드립니다. 정시 복귀가 이 상품의 핵심입니다.',
    ja: 'ご予約時に船名、寄港日、下船予定時刻、乗船締切時刻をお知らせください。お迎えは松島（ソンド）の仁川港クルーズターミナルです（外洋クルーズ専用ターミナルで、仁川港国際旅客ターミナルや永宗島の仁川空港とは異なります）。複数の船のクルーズ乗客との相乗りバンで、出港時刻が異なる場合は早く出港されるお客様から順にお送りします。定刻での帰着がこの商品の要です。',
    zh: '预订时请提供船名、停靠日期、预计下船时间与最晚登船时间。上车地点为松岛的仁川港邮轮码头（专用远洋邮轮码头，请勿与仁川港国际客运码头或永宗岛的仁川机场混淆）。与来自不同船舶的邮轮乘客共乘一辆车；若各船开航时间不同，将优先送最早开航的旅客。准时返回是本产品的核心。',
    'zh-TW': '訂購時請提供船名、停靠日期、預計下船時間與最晚登船時間。上車地點為松島的仁川港郵輪碼頭（專用遠洋郵輪碼頭，請勿與仁川港國際客運碼頭或永宗島的仁川機場混淆）。與來自不同船舶的郵輪旅客共乘一輛車；若各船開航時間不同，將優先送最早開航的旅客。準時返回是本產品的核心。',
    es: 'Indica al reservar el nombre del barco, la fecha de escala, la hora prevista de desembarque y la hora de embarque final. La recogida es en la Terminal de Cruceros de Incheon, en Songdo (la terminal dedicada a cruceros oceánicos; NO la confundas con la Terminal Internacional de Ferris de Incheon ni con el aeropuerto de Incheon, en la isla de Yeongjong). Furgoneta compartida con pasajeros de varios cruceros; si los barcos zarpan a horas distintas, se deja primero a quienes salen antes. El regreso puntual es el producto.',
  },

  // ── 시즌 상품 3종의 안내문 — ko/ja/zh/zh-TW 에 EN 원문이 그대로 남아 있었다 ──
  // 상설 게이트 __tests__/audit/pickupDropoffLocaleParity.test.ts 가 찾아냈다.
  // 세 상품 모두 지금은 판매 중지 상태지만, 안 고치면 재오픈하는 날 한국어 페이지에
  // 영어 문단이 그대로 나간다.
  'Choose the pickup exit closest to your hotel at booking. Year-round itinerary; cherry-blossom season (typically mid-March to mid-April) swaps Ahopsan Bamboo Forest for Haeundae Dalmaji Hill.': {
    ko: '예약 시 숙소에서 가장 가까운 출구를 선택해 주세요. 연중 운행하는 일정이며, 벚꽃 시즌(보통 3월 중순~4월 중순)에는 아홉산숲 대신 해운대 달맞이길로 대체됩니다.',
    ja: 'ご予約時にホテルに最も近い出口をお選びください。通年運行の行程で、桜のシーズン（通常3月中旬〜4月中旬）はアホプサン竹林に代えて海雲台タルマジ丘を訪れます。',
    zh: '预订时请选择距您酒店最近的出口。本行程全年运行；樱花季（通常为3月中旬至4月中旬）会以海云台月见坡取代阿九山竹林。',
    'zh-TW': '訂購時請選擇距您住宿最近的出口。本行程全年運行；櫻花季（通常為3月中旬至4月中旬）會以海雲台月見坡取代阿九山竹林。',
    es: 'Elige al reservar la salida más cercana a tu hotel. Itinerario disponible todo el año; en temporada de cerezos (normalmente de mediados de marzo a mediados de abril) el bosque de bambú de Ahopsan se sustituye por la colina Dalmaji de Haeundae.',
  },
  "This tour operates ONLY during the spring blossom window — approximately Feb 25 to Apr 10, 2026. It is a DUAL-SEASON product: plum blossom (매화, peak ~Mar 1–15 at Tongdosa Jajangmae and Yangsan Wondong) blends into cherry blossom (벚꽃, peak ~Mar 28–Apr 10 at Bulguksa and Bomun Lake). Daily route is adjusted by season: early dates emphasize Yangsan (Tongdosa + Wondong); later dates pivot to Gyeongju (Bulguksa + Bomun Lake). Mid-season days cover both. Departure is a fixed group shuttle (small_group product) so pickup times are not flexible. Lunch is at own expense (~10,000–20,000 KRW); during plum season the recommended lunch is Wondong's Minari Samgyeopsal (clean-water parsley grilled with pork belly, only available this season). Wheelchair and stroller travelers — please notify at booking; Tongdosa has a 1.2 km riverside walk and gentle slopes, Bulguksa has stairs.": {
    ko: '이 투어는 봄꽃 시즌에만 운행합니다 — 2026년 2월 25일경부터 4월 10일경까지. 두 시즌이 이어지는 상품으로, 매화(통도사 자장매·양산 원동 일대, 3월 1~15일경 절정)에서 벚꽃(불국사·보문호 일대, 3월 28일~4월 10일경 절정)으로 넘어갑니다. 코스는 시기에 따라 조정됩니다: 이른 날짜는 양산(통도사+원동) 위주, 늦은 날짜는 경주(불국사+보문호) 위주이며, 시즌 중반에는 양쪽을 모두 돕니다. 고정 셔틀(소규모 그룹 상품)이라 픽업 시각은 조정되지 않습니다. 점심은 개인 부담입니다(약 10,000~20,000원). 매화 시즌에는 원동의 미나리 삼겹살(이 시기에만 맛볼 수 있습니다)을 추천드립니다. 휠체어·유모차 이용 고객은 예약 시 미리 알려 주세요 — 통도사는 1.2km 강변길과 완만한 경사가 있고, 불국사에는 계단이 있습니다.',
    ja: 'このツアーは春の花のシーズンのみ運行します — 2026年2月25日頃〜4月10日頃。二つの季節をまたぐ商品で、梅（通度寺の慈蔵梅・梁山ウォンドン一帯、3月1〜15日頃が見頃）から桜（仏国寺・普門湖一帯、3月28日〜4月10日頃が見頃）へと移ります。コースは時期により調整します。前半は梁山（通度寺＋ウォンドン）中心、後半は慶州（仏国寺＋普門湖）中心、シーズン中盤は両方を回ります。固定シャトル（少人数グループ商品）のため乗車時刻の変更はできません。昼食は自己負担です（約10,000〜20,000ウォン）。梅のシーズンにはウォンドンのミナリ・サムギョプサル（この時期だけの味）がおすすめです。車椅子・ベビーカーをご利用の方はご予約時にお知らせください — 通度寺は1.2kmの川沿いの道と緩やかな坂、仏国寺には階段があります。',
    zh: '本行程仅在春季花期运行 — 约2026年2月25日至4月10日。这是横跨两个花季的产品：梅花（通度寺慈藏梅与梁山院洞一带，约3月1–15日盛开）接续樱花（佛国寺与普门湖一带，约3月28日–4月10日盛开）。路线按时节调整：较早的日期以梁山为主（通度寺＋院洞），较晚的日期转向庆州（佛国寺＋普门湖），花期中段两地兼顾。发车为固定班次（小团产品），接送时间不可变更。午餐自理（约10,000–20,000韩元）；梅花季推荐院洞的水芹五花肉（仅此时节供应）。使用轮椅或婴儿车的旅客请于预订时告知 — 通度寺有1.2公里的河边步道与缓坡，佛国寺则有台阶。',
    'zh-TW': '本行程僅在春季花期運行 — 約2026年2月25日至4月10日。這是橫跨兩個花季的產品：梅花（通度寺慈藏梅與梁山院洞一帶，約3月1–15日盛開）接續櫻花（佛國寺與普門湖一帶，約3月28日–4月10日盛開）。路線依時節調整：較早的日期以梁山為主（通度寺＋院洞），較晚的日期轉向慶州（佛國寺＋普門湖），花期中段兩地兼顧。發車為固定班次（小團產品），接送時間不可變更。午餐自理（約10,000–20,000韓元）；梅花季推薦院洞的水芹五花肉（僅此時節供應）。使用輪椅或嬰兒車的旅客請於訂購時告知 — 通度寺有1.2公里的河邊步道與緩坡，佛國寺則有階梯。',
    es: 'Este tour opera SOLO durante la floración de primavera, aproximadamente del 25 de febrero al 10 de abril de 2026. Es un producto de doble temporada: la flor del ciruelo (maehwa, punto álgido ~1–15 de marzo en el Jajangmae de Tongdosa y en Wondong, Yangsan) da paso a la del cerezo (beotkkot, punto álgido ~28 de marzo–10 de abril en Bulguksa y el lago Bomun). La ruta se ajusta según la fecha: los primeros días se centran en Yangsan (Tongdosa + Wondong) y los últimos en Gyeongju (Bulguksa + lago Bomun); a media temporada se visitan ambos. La salida es una lanzadera de grupo fija (producto de grupo reducido), por lo que los horarios de recogida no son flexibles. El almuerzo corre por tu cuenta (~10.000–20.000 KRW); en temporada de ciruelo recomendamos el minari samgyeopsal de Wondong (panceta a la brasa con perejil de agua, solo disponible en estas fechas). Viajeros en silla de ruedas o con cochecito: avísanos al reservar; Tongdosa tiene 1,2 km de paseo junto al río y pendientes suaves, y Bulguksa tiene escaleras.',
  },
  "This tour operates ONLY during cherry blossom season (approximately March 28 to April 10, 2026 — exact dates depend on bloom forecast and confirmed annually). Departure is a fixed group shuttle (small_group product) so pickup times are not flexible. If bloom is delayed or finished, the tour may be cancelled with 3 days' notice and full refund. Lunch is at own expense (~10,000–20,000 KRW) at a Gyeongju local restaurant chosen by the guide based on the day's route. Wheelchair and stroller travelers — please notify at booking; some stops involve uneven ground (Bulguksa stairs, grass paths at Daereungwon).": {
    ko: '이 투어는 벚꽃 시즌에만 운행합니다(2026년 3월 28일경~4월 10일경 — 정확한 날짜는 개화 예보에 따라 매년 확정됩니다). 고정 셔틀(소규모 그룹 상품)이라 픽업 시각은 조정되지 않습니다. 개화가 늦어지거나 이미 진 경우 3일 전 통보 후 전액 환불로 취소될 수 있습니다. 점심은 개인 부담이며(약 10,000~20,000원), 당일 동선에 맞춰 가이드가 고른 경주 현지 식당에서 드십니다. 휠체어·유모차 이용 고객은 예약 시 미리 알려 주세요 — 일부 방문지는 노면이 고르지 않습니다(불국사 계단, 대릉원 잔디길).',
    ja: 'このツアーは桜のシーズンのみ運行します（2026年3月28日頃〜4月10日頃 — 正確な日程は開花予想に基づき毎年確定します）。固定シャトル（少人数グループ商品）のため乗車時刻の変更はできません。開花が遅れた場合や見頃が過ぎた場合は、3日前のご連絡と全額返金でツアーを中止することがあります。昼食は自己負担で（約10,000〜20,000ウォン）、その日のルートに合わせてガイドが選んだ慶州の地元レストランでお召し上がりいただきます。車椅子・ベビーカーをご利用の方はご予約時にお知らせください — 一部の訪問地は路面が平坦ではありません（仏国寺の階段、大陵苑の芝生道）。',
    zh: '本行程仅在樱花季运行（约2026年3月28日至4月10日 — 确切日期依开花预报每年确认）。发车为固定班次（小团产品），接送时间不可变更。若花期延后或已过，本行程可能于三天前通知取消并全额退款。午餐自理（约10,000–20,000韩元），在导游依当日路线挑选的庆州本地餐厅用餐。使用轮椅或婴儿车的旅客请于预订时告知 — 部分景点路面不平（佛国寺台阶、大陵苑草地步道）。',
    'zh-TW': '本行程僅在櫻花季運行（約2026年3月28日至4月10日 — 確切日期依開花預報每年確認）。發車為固定班次（小團產品），接送時間不可變更。若花期延後或已過，本行程可能於三天前通知取消並全額退款。午餐自理（約10,000–20,000韓元），在導遊依當日路線挑選的慶州在地餐廳用餐。使用輪椅或嬰兒車的旅客請於訂購時告知 — 部分景點路面不平（佛國寺階梯、大陵苑草地步道）。',
    es: 'Este tour opera SOLO en temporada de cerezos en flor (aproximadamente del 28 de marzo al 10 de abril de 2026; las fechas exactas dependen de la previsión de floración y se confirman cada año). La salida es una lanzadera de grupo fija (producto de grupo reducido), por lo que los horarios de recogida no son flexibles. Si la floración se retrasa o ya ha terminado, el tour puede cancelarse con 3 días de aviso y reembolso íntegro. El almuerzo corre por tu cuenta (~10.000–20.000 KRW) en un restaurante local de Gyeongju elegido por el guía según la ruta del día. Viajeros en silla de ruedas o con cochecito: avísanos al reservar; algunas paradas tienen terreno irregular (escaleras en Bulguksa, senderos de hierba en Daereungwon).',
  },
};

const SLUGS = [...JEJU, BUSAN_CRUISE, INCHEON_PRIVATE, INCHEON_SHARED];

/**
 * Products whose pickup block IS present in every locale but whose `notes`
 * paragraph is still raw English on the CJK pages. The parity gate found these;
 * all three are currently off sale, which is exactly why nobody noticed.
 */
const NOTES_ONLY = [
  'busan-gyeongju-unesco-legacy-tour-national-museum',
  'busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju',
  'busan-spring-cherry-blossom-gyeongju-highlights-day-tour',
];

/** Translate a free-text field, failing loudly on an unknown string. */
function tr(value, loc, ctx) {
  if (value == null) return value;
  const row = T[value];
  if (!row || !row[loc]) throw new Error(`${ctx}: no ${loc} translation for "${String(value).slice(0, 60)}…"`);
  return row[loc];
}

/** `time` may be a clock ("08:15") — those are locale-invariant. */
const isClock = (v) => typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v);

let failed = false;
for (const slug of SLUGS) {
  const dir = path.join(BASE, slug);
  const en = JSON.parse(fs.readFileSync(path.join(dir, `${slug}.en.json`), 'utf8'));
  const pd = en.pickup_dropoff;
  if (!pd?.departure?.length) {
    console.error(`[${slug}] EN bundle has no pickup_dropoff — nothing to copy`);
    failed = true;
    continue;
  }

  for (const loc of LOCALES) {
    const file = path.join(dir, `${slug}.${loc}.json`);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    const doc = JSON.parse(original);
    if (doc.pickup_dropoff?.departure?.length) {
      console.log(`· ${slug} ${loc} — already present, left alone`);
      continue;
    }

    const localize = (pt) => ({
      ...pt,
      ...(pt.time !== undefined
        ? { time: isClock(pt.time) ? pt.time : tr(pt.time, loc, `${slug}.${loc} time`) }
        : {}),
      name: tr(pt.name, loc, `${slug}.${loc} name`),
      ...(pt.note !== undefined ? { note: tr(pt.note, loc, `${slug}.${loc} note`) } : {}),
    });

    try {
      doc.pickup_dropoff = {
        departure: pd.departure.map(localize),
        return: pd.return.map(localize),
        notes: (pd.notes ?? []).map((n) => tr(n, loc, `${slug}.${loc} notes`)),
      };
    } catch (err) {
      console.error(`✗ ${err.message}`);
      failed = true;
      continue;
    }

    const next = `${JSON.stringify(doc, null, 2)}\n`;
    if (CHECK_ONLY) {
      console.log(`~ ${slug} ${loc} — would add pickup_dropoff`);
    } else {
      fs.writeFileSync(file, next, 'utf8');
      console.log(`+ ${slug} ${loc}`);
    }
  }
}

// ── pass 2: translate notes that stayed English inside an existing block ──
for (const slug of NOTES_ONLY) {
  const dir = path.join(BASE, slug);
  const en = JSON.parse(fs.readFileSync(path.join(dir, `${slug}.en.json`), 'utf8'));
  const enNotes = en.pickup_dropoff?.notes ?? [];

  for (const loc of LOCALES) {
    const file = path.join(dir, `${slug}.${loc}.json`);
    if (!fs.existsSync(file)) continue;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const notes = doc.pickup_dropoff?.notes;
    if (!Array.isArray(notes)) continue;

    let changed = false;
    const next = notes.map((note, i) => {
      if (note !== enNotes[i]) return note;
      changed = true;
      return tr(note, loc, `${slug}.${loc} notes[${i}]`);
    });
    if (!changed) {
      console.log(`· ${slug} ${loc} notes — already translated`);
      continue;
    }

    doc.pickup_dropoff.notes = next;
    if (CHECK_ONLY) {
      console.log(`~ ${slug} ${loc} notes — would translate`);
    } else {
      fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
      console.log(`+ ${slug} ${loc} notes`);
    }
  }
}

if (failed) process.exit(1);
console.log('\nDone. The DB half is supabase/pending-db-apply/2026-08-05-15-*.sql.');
