/**
 * Busan Top Attractions Day Tour — pickup order + times realignment
 * (owner instruction 2026-08-05).
 *
 * NEW ORDER (matches the house standard already used by the two Gyeongju
 * products that leave from the same three Busan subway exits):
 *
 *   1) 08:10  Busan Station Exit 4   (subway Line 1 exit — NOT the KTX gate)
 *   2) 08:30  Seomyeon Station Exit 4
 *   3) 09:10  Haeundae Station Exit 5
 *
 * WAS: Seomyeon 08:30 → Busan Station 08:50 → Haeundae 09:30.
 *
 * 🔴 The bundle was already self-contradictory before this change and that is
 * why the sweep below is wide rather than a two-line edit:
 *   - `pickup_dropoff.departure` said Seomyeon first,
 *   - `itineraryStops[0].timeUsed` said Busan Station first at ~09:00,
 *   - `page_sections[4]` said Busan Station first at 08:30.
 * Three different stories on one page. All of them are collapsed onto the
 * single schedule above.
 *
 * Non-EN bundles never carried `pickup_dropoff` at all (only the DB rows did,
 * from the one-off `scripts/gen_pickup_sql.js` run). This script adds the
 * localized block to all six bundles so the repo stops being a partial
 * source — the accompanying SQL writes the identical object to the DB.
 *
 * What is deliberately NOT changed:
 *   - drop-off times (≈17:50 / 18:10 / 18:30 / 19:00) and every downstream
 *     stop time. The owner asked about pickup; re-timing the whole day would
 *     be inventing numbers nobody measured.
 *   - the "10.5 hours" headline (catalog_card.duration, seo, duration_label).
 *     08:10 → ≈19:00 is ≈10.8 h, so the rounded label now understates by ~20
 *     min — same tolerance the Gyeongju sibling uses (11:40 labelled "11.5
 *     hours"). Raising it to 11 h is an owner call, not a silent edit.
 *
 * Usage: node scripts/align-busan-top-attractions-pickup-2026-08.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'busan-top-attractions-day-tour';
const DIR = path.join(__dirname, '..', 'components', 'product-tour-static', SLUG);
const LOCALES = ['en', 'ko', 'ja', 'es', 'zh', 'zh-TW'];

const CHECK_ONLY = process.argv.includes('--check');

// Coordinates come from the EN bundle, which `scripts/fix-pickup-dropoff-coords.mjs`
// already corrected. The older DB rows still carry the pre-fix values.
const COORD = {
  busanStation: { lat: 35.11449, lng: 129.03933 },
  seomyeon: { lat: 35.15782, lng: 129.06003 },
  haeundae: { lat: 35.16396, lng: 129.15853 },
  nampo: { lat: 35.09663, lng: 129.0308 },
};

/** @type {Record<string, {names: string[], returnNames: string[], notes: string[]}>} */
const PICKUP_BY_LOCALE = {
  en: {
    names: [
      'Busan Station Exit 4 (not the KTX gate)',
      'Seomyeon Station (Exit 4)',
      'Haeundae Station (Exit 5)',
    ],
    returnNames: [
      'Nampo-dong / Jagalchi area',
      'Busan Station (Exit 4)',
      'Seomyeon Station (Exit 4)',
      'Haeundae Station (Exit 5)',
    ],
    notes: [
      'Choose the pickup exit closest to your hotel at booking. Drop-offs are sequential along the return route; passengers boarding at Busan Station (08:10) or Seomyeon (08:30) have the longest day (≈10 hours), Haeundae passengers the shortest (just under 10 hours).',
    ],
  },
  ko: {
    names: ['부산역 4번 출구 (KTX 개찰구 아님)', '서면역 4번 출구', '해운대역 5번 출구'],
    returnNames: ['남포동 / 자갈치', '부산역 4번 출구', '서면역 4번 출구', '해운대역 5번 출구'],
    notes: [
      '예약 시 숙소에서 가장 가까운 출구를 선택해 주세요. 하차는 복귀 경로를 따라 순차적으로 진행됩니다. 부산역(08:10) 또는 서면(08:30)에서 탑승하시면 하루가 가장 길고(약 10시간), 해운대 탑승이 가장 짧습니다(10시간 조금 못 미침).',
    ],
  },
  ja: {
    names: ['釜山駅4番出口（KTX改札ではありません）', '西面駅4番出口', '海雲台駅5番出口'],
    returnNames: ['南浦洞／チャガルチ', '釜山駅4番出口', '西面駅4番出口', '海雲台駅5番出口'],
    notes: [
      'ご予約時にホテルに最も近い出口をお選びください。降車は復路のルートに沿って順番に行われます。釜山駅（08:10）または西面（08:30）からご乗車の場合が最も長い一日（約10時間）となり、海雲台からのご乗車が最短（10時間弱）です。',
    ],
  },
  es: {
    names: [
      'Estación de Busan, Salida 4 (no la puerta del KTX)',
      'Estación Seomyeon (Salida 4)',
      'Estación Haeundae (Salida 5)',
    ],
    returnNames: [
      'Nampo-dong / zona de Jagalchi',
      'Estación de Busan (Salida 4)',
      'Estación Seomyeon (Salida 4)',
      'Estación Haeundae (Salida 5)',
    ],
    notes: [
      'Elige la salida más cercana a tu hotel al reservar. Las bajadas siguen el orden de la ruta de regreso; quienes suben en la Estación de Busan (08:10) o en Seomyeon (08:30) tienen el día más largo (≈10 horas) y quienes suben en Haeundae, el más corto (algo menos de 10 horas).',
    ],
  },
  zh: {
    names: ['釜山站4号出口（非KTX检票口）', '西面站4号出口', '海云台站5号出口'],
    returnNames: ['南浦洞/札嘎其', '釜山站4号出口', '西面站4号出口', '海云台站5号出口'],
    notes: [
      '预订时请选择距您酒店最近的出口。返程送达按回程路线顺序进行；在釜山站（08:10）或西面（08:30）上车的旅客当天行程最长（约10小时），海云台上车的最短（略少于10小时）。',
    ],
  },
  'zh-TW': {
    names: ['釜山站4號出口（非KTX閘口）', '西面站4號出口', '海雲台站5號出口'],
    returnNames: ['南浦洞／札嘎其', '釜山站4號出口', '西面站4號出口', '海雲台站5號出口'],
    notes: [
      '訂購時請選擇距離住宿最近的出口。下車依回程路線順序進行；在釜山站（08:10）或西面（08:30）上車的旅客當日行程最長（約10小時），海雲台上車者最短（略少於10小時）。',
    ],
  },
};

const DEPARTURE_TIMES = ['08:10', '08:30', '09:10'];
const DEPARTURE_COORDS = [COORD.busanStation, COORD.seomyeon, COORD.haeundae];
const RETURN_COORDS = [COORD.nampo, COORD.busanStation, COORD.seomyeon, COORD.haeundae];

/** Stop 1 ("Pickup") — the leg is now 08:10 → 09:15, i.e. 65 minutes. */
const STOP0 = {
  en: {
    time: '≈ 08:10',
    duration: '65 min',
    timeUsed: [
      'Busan Station pickup (~08:10, ~5 min)',
      'Drive to Seomyeon Station (~15 min)',
      'Seomyeon pickup (~08:30, ~5 min)',
      'Drive to Haeundae Station (~35 min)',
      'Haeundae pickup (~09:10, ~5 min)',
    ],
    sectionTime: '08:10–09:10',
  },
  ko: {
    time: '≈ 08:10',
    duration: '65분',
    timeUsed: [
      '부산역 탑승 (약 08:10, 약 5분)',
      '서면역까지 이동 (약 15분)',
      '서면 탑승 (약 08:30, 약 5분)',
      '해운대역까지 이동 (약 35분)',
      '해운대 탑승 (약 09:10, 약 5분)',
    ],
    sectionTime: '08:10–09:10',
  },
  ja: {
    time: '≈ 08:10',
    duration: '65分',
    timeUsed: [
      '釜山駅乗車（~08:10、~5分）',
      '西面駅へ移動（~15分）',
      '西面乗車（~08:30、~5分）',
      '海雲台駅へ移動（~35分）',
      '海雲台乗車（~09:10、~5分）',
    ],
    sectionTime: '08:10–09:10',
  },
  es: {
    time: '≈ 08:10',
    duration: '65 min',
    timeUsed: [
      'Recogida en la Estación de Busan (~08:10, ~5 min)',
      'Traslado a la Estación de Seomyeon (~15 min)',
      'Recogida en Seomyeon (~08:30, ~5 min)',
      'Traslado a la Estación de Haeundae (~35 min)',
      'Recogida en Haeundae (~09:10, ~5 min)',
    ],
    sectionTime: '08:10–09:10',
  },
  zh: {
    time: '≈ 08:10',
    duration: '65分钟',
    timeUsed: [
      '釜山站接送（约08:10，约5分钟）',
      '驾车前往西面站（约15分钟）',
      '西面站接送（约08:30，约5分钟）',
      '驾车前往海云台站（约35分钟）',
      '海云台站接送（约09:10，约5分钟）',
    ],
    sectionTime: '08:10–09:10',
  },
  'zh-TW': {
    time: '≈ 08:10',
    duration: '65 分鐘',
    timeUsed: [
      '釜山站接送（約 08:10，約 5 分鐘）',
      '前往西面站（約 15 分鐘）',
      '西面站接送（約 08:30，約 5 分鐘）',
      '前往海雲台站（約 35 分鐘）',
      '海雲台站接送（約 09:10，約 5 分鐘）',
    ],
    sectionTime: '08:10–09:10',
  },
};

/**
 * Prose fragments. Applied to EVERY string in the document, longest key first
 * so that a full sentence wins over the accordion `preview` that is a prefix
 * of it. `required: false` marks fragments that only exist in some locales'
 * page_sections mirror (DEAD data — present in five bundles, absent in one).
 */
const FRAGMENTS = {
  en: [
    ['08:30 first pickup', '08:10 first pickup'],
    ['08:30 to 18:00', '08:10 to 18:00'],
    ['Sequencing northwest→east', 'Sequencing west→east'],
    [
      'lands the group at Haedong Yonggungsa around 10:00',
      'lands the group at Haedong Yonggungsa around 09:50',
    ],
    [
      '(typically Busan Station first ~09:00, Seomyeon ~09:15, Haeundae ~09:30)',
      '(Busan Station Exit 4 at 08:10, Seomyeon Station Exit 4 at 08:30, Haeundae Station Exit 5 at 09:10)',
    ],
    [
      'Exit 4 (08:30), Seomyeon Station Exit 4 (08:50), and Haeundae Station Exit 5 (09:30)',
      'Exit 4 (08:10), Seomyeon Station Exit 4 (08:30), and Haeundae Station Exit 5 (09:10)',
      { required: false },
    ],
    [
      'Three pickup points along Busan Subway: Seomyeon Station Exit 4 (08:30), Busan Station Exit 4 — not the KTX gate (08:50), Haeundae Station Exit 5 (09:30).',
      'Three pickup points along Busan Subway: Busan Station Exit 4 — not the KTX gate (08:10), Seomyeon Station Exit 4 (08:30), Haeundae Station Exit 5 (09:10).',
    ],
    [
      'Three pickup points along Busan Subway: Seomyeon Station Exit 4 (08:30), Busan Station…',
      'Three pickup points along Busan Subway: Busan Station Exit 4 (08:10), Seomyeon Station…',
    ],
    [
      'Three central-Busan stations: Seomyeon Station Exit 4 (08:30), Busan Station Exit 4 — not the KTX gate (08:50), Haeundae Station Exit 5 (09:30).',
      'Three central-Busan stations: Busan Station Exit 4 — not the KTX gate (08:10), Seomyeon Station Exit 4 (08:30), Haeundae Station Exit 5 (09:10).',
    ],
    [
      'Your effective tour duration depends on pickup point: Seomyeon ≈10 h, Haeundae ≈9.5 h.',
      'Your effective tour duration depends on pickup point: Busan Station and Seomyeon ≈10 h, Haeundae just under 10 h.',
    ],
    [
      'Pickup at Seomyeon, Busan Station, or Haeundae — accessible from most central-Busan accommodations. Choose the exit closest to your hotel; tour duration adjusts ±30 min based on pickup point.',
      'Pickup at Busan Station, Seomyeon, or Haeundae — accessible from most central-Busan accommodations. Choose the exit closest to your hotel; your effective tour length varies by about 15 minutes depending on which one you pick.',
    ],
    [
      'passengers boarding at Seomyeon (08:30) experience the longest day (≈10 hours), Haeundae passengers the shortest (≈9.5 hours).',
      'passengers boarding at Busan Station (08:10) or Seomyeon (08:30) have the longest day (≈10 hours), Haeundae passengers the shortest (just under 10 hours).',
      { required: false },
    ],
  ],
  ko: [
    ['첫 픽업 08:30', '첫 픽업 08:10'],
    ['오전 8:30 ~ 오후 6:00', '오전 8:10 ~ 오후 6:00'],
    ['북서→동쪽 순서로', '서→동 순서로'],
    ['오전 10시경 해동 용궁사에 도착', '오전 9시 50분경 해동 용궁사에 도착'],
    [
      '(일반적으로 부산역 약 09:00, 서면 약 09:15, 해운대 약 09:30)',
      '(부산역 4번 출구 08:10, 서면역 4번 출구 08:30, 해운대역 5번 출구 09:10)',
    ],
    [
      '부산 도시철도 연선의 픽업 장소 3곳: 서면역 4번 출구 (08:30), 부산역 4번 출구 — KTX 개찰구 아님 (08:50), 해운대역 5번 출구 (09:30).',
      '부산 도시철도 연선의 픽업 장소 3곳: 부산역 4번 출구 — KTX 개찰구 아님 (08:10), 서면역 4번 출구 (08:30), 해운대역 5번 출구 (09:10).',
    ],
    [
      '부산 도시철도 연선의 픽업 장소 3곳: 서면역 4번 출구 (08:30), 부산역…',
      '부산 도시철도 연선의 픽업 장소 3곳: 부산역 4번 출구 (08:10), 서면역…',
    ],
    [
      '실질적인 투어 시간은 픽업 지점에 따라 다릅니다: 서면 ≈10시간, 해운대 ≈9.5시간.',
      '실질적인 투어 시간은 픽업 지점에 따라 다릅니다: 부산역·서면 ≈10시간, 해운대 ≈10시간 미만.',
    ],
    [
      '부산 중심부 세 곳의 지하철역: 서면역 4번 출구(08:30), 부산역 4번 출구 — KTX 게이트 아님(08:50), 해운대역 5번 출구(09:30).',
      '부산 중심부 세 곳의 지하철역: 부산역 4번 출구 — KTX 게이트 아님(08:10), 서면역 4번 출구(08:30), 해운대역 5번 출구(09:10).',
    ],
    [
      '서면, 부산역, 해운대에서 픽업 — 부산 중심부 대부분의 숙소에서 접근하기 편리합니다. 숙소와 가장 가까운 출구를 선택하세요. 픽업 지점에 따라 투어 시간은 ±30분 조정됩니다.',
      '부산역, 서면, 해운대에서 픽업 — 부산 중심부 대부분의 숙소에서 접근하기 편리합니다. 숙소와 가장 가까운 출구를 선택하세요. 픽업 지점에 따라 실질 투어 시간은 약 15분 차이가 납니다.',
    ],
    [
      '서면역 4번 출구 (08:30), 부산역 4번 출구 (08:50), 해운대역 5번 출구 (09:30)',
      '부산역 4번 출구 (08:10), 서면역 4번 출구 (08:30), 해운대역 5번 출구 (09:10)',
      { required: false },
    ],
    [
      '서면역 4번 출구 (08:30), 부산역 4번 출구 — KTX 게이트 아님 (08:50), 해운대역 5번 출구 (09:30)',
      '부산역 4번 출구 — KTX 게이트 아님 (08:10), 서면역 4번 출구 (08:30), 해운대역 5번 출구 (09:10)',
      { required: false },
    ],
    [
      '서면 출발 시 ≈10시간, 해운대 출발 시 ≈9.5시간',
      '부산역·서면 출발 시 ≈10시간, 해운대 출발 시 ≈10시간 미만',
      { required: false },
    ],
    [
      '부산 중심부 3개 역: 서면역 4번 출구(08:30), 부산역 4번 출구 — KTX 출입구 아님(08:50), 해운대역 5번 출구(09:30).',
      '부산 중심부 3개 역: 부산역 4번 출구 — KTX 출입구 아님(08:10), 서면역 4번 출구(08:30), 해운대역 5번 출구(09:10).',
      { required: false },
    ],
  ],
  ja: [
    ['最初の乗車 08:30', '最初の乗車 08:10'],
    ['最初のお迎え 08:30', '最初のお迎え 08:10'],
    ['08:30〜18:00', '08:10〜18:00'],
    ['北西から東へのルート順', '西から東へのルート順'],
    ['海東龍宮寺に10:00頃到着', '海東龍宮寺に09:50頃到着'],
    [
      '（通常、釜山駅が最初~09:00、西面~09:15、海雲台~09:30）',
      '（釜山駅4番出口 08:10、西面駅4番出口 08:30、海雲台駅5番出口 09:10）',
    ],
    [
      '釜山地下鉄沿いの3か所の乗車地：西面駅4番出口（08:30）、釜山駅4番出口——KTX改札ではありません（08:50）、海雲台駅5番出口（09:30）。',
      '釜山地下鉄沿いの3か所の乗車地：釜山駅4番出口——KTX改札ではありません（08:10）、西面駅4番出口（08:30）、海雲台駅5番出口（09:10）。',
    ],
    [
      '釜山地下鉄沿いの3か所の乗車地：西面駅4番出口（08:30）、釜山駅…',
      '釜山地下鉄沿いの3か所の乗車地：釜山駅4番出口（08:10）、西面駅…',
    ],
    [
      'ツアーの実質所要時間は乗車地によって異なります：西面 約10時間、海雲台 約9.5時間。',
      'ツアーの実質所要時間は乗車地によって異なります：釜山駅・西面 約10時間、海雲台 約10時間弱。',
    ],
    [
      '釜山中心部の3つの駅：西面駅4番出口（08:30）、釜山駅4番出口 — KTX改札ではありません（08:50）、海雲台駅5番出口（09:30）。',
      '釜山中心部の3つの駅：釜山駅4番出口 — KTX改札ではありません（08:10）、西面駅4番出口（08:30）、海雲台駅5番出口（09:10）。',
    ],
    [
      '乗車地は西面（ソミョン）、釜山駅、または海雲台（ヘウンデ）から選択可能で、釜山中心部のほとんどの宿泊施設からアクセスできます。ホテルに最も近い出口をお選びください。乗車地によってツアー所要時間は±30分調整されます。',
      '乗車地は釜山駅、西面（ソミョン）、または海雲台（ヘウンデ）から選択可能で、釜山中心部のほとんどの宿泊施設からアクセスできます。ホテルに最も近い出口をお選びください。実質のツアー所要時間は乗車地によって約15分の差があります。',
    ],
    [
      '西面駅4番出口（08:30）、釜山駅4番出口（08:50）、海雲台駅5番出口（09:30）',
      '釜山駅4番出口（08:10）、西面駅4番出口（08:30）、海雲台駅5番出口（09:10）',
      { required: false },
    ],
    [
      '西面駅4番出口（08:30）、釜山駅4番出口——KTXゲートではありません（08:50）、海雲台駅5番出口（09:30）',
      '釜山駅4番出口——KTXゲートではありません（08:10）、西面駅4番出口（08:30）、海雲台駅5番出口（09:10）',
      { required: false },
    ],
    [
      '西面駅4番出口（08:30）、釜山駅4番出口（KTXゲートではありません）（08:50）、海雲台駅5番出口（09:30）',
      '釜山駅4番出口（KTXゲートではありません）（08:10）、西面駅4番出口（08:30）、海雲台駅5番出口（09:10）',
      { required: false },
    ],
    ['西面≈10時間、海雲台≈9.5時間', '釜山駅・西面≈10時間、海雲台≈10時間弱', { required: false }],
  ],
  es: [
    ['primera recogida a las 08:30', 'primera recogida a las 08:10'],
    ['De 08:30 a 18:00', 'De 08:10 a 18:00'],
    ['La secuencia noroeste→este', 'La secuencia oeste→este'],
    ['a Haedong Yonggungsa hacia las 10:00', 'a Haedong Yonggungsa hacia las 09:50'],
    [
      '(generalmente Estación de Busan primero ~09:00, Seomyeon ~09:15, Haeundae ~09:30)',
      '(Estación de Busan Salida 4 a las 08:10, Estación Seomyeon Salida 4 a las 08:30, Estación Haeundae Salida 5 a las 09:10)',
    ],
    [
      'Tres puntos de recogida a lo largo del Metro de Busan: Salida 4 de la Estación Seomyeon (08:30), Salida 4 de la Estación de Busan — no la puerta KTX (08:50), Salida 5 de la Estación Haeundae (09:30).',
      'Tres puntos de recogida a lo largo del Metro de Busan: Salida 4 de la Estación de Busan — no la puerta KTX (08:10), Salida 4 de la Estación Seomyeon (08:30), Salida 5 de la Estación Haeundae (09:10).',
    ],
    [
      'Tres puntos de recogida a lo largo del Metro de Busan: Salida 4 de la Estación Seomyeon (08:30), Estación de Busan…',
      'Tres puntos de recogida a lo largo del Metro de Busan: Salida 4 de la Estación de Busan (08:10), Estación Seomyeon…',
    ],
    [
      'La duración efectiva del tour depende del punto de recogida: Seomyeon ≈10 h, Haeundae ≈9,5 h.',
      'La duración efectiva del tour depende del punto de recogida: Estación de Busan y Seomyeon ≈10 h, Haeundae algo menos de 10 h.',
    ],
    [
      'Tres estaciones del centro de Busan: Estación Seomyeon Salida 4 (08:30), Estación Busan Salida 4 — no la puerta del KTX (08:50), Estación Haeundae Salida 5 (09:30).',
      'Tres estaciones del centro de Busan: Estación Busan Salida 4 — no la puerta del KTX (08:10), Estación Seomyeon Salida 4 (08:30), Estación Haeundae Salida 5 (09:10).',
    ],
    [
      'Recogida en Seomyeon, Estación de Busan o Haeundae — accesible desde la mayoría de alojamientos en el centro de Busan. Elige la salida más cercana a tu hotel; la duración del tour varía ±30 min según el punto de recogida.',
      'Recogida en la Estación de Busan, Seomyeon o Haeundae — accesible desde la mayoría de alojamientos en el centro de Busan. Elige la salida más cercana a tu hotel; la duración efectiva del tour varía unos 15 min según el punto de recogida.',
    ],
    [
      'Estación Seomyeon, Salida 4 (08:30); Estación Busan, Salida 4 (08:50); Estación Haeundae, Salida 5 (09:30)',
      'Estación de Busan, Salida 4 (08:10); Estación Seomyeon, Salida 4 (08:30); Estación Haeundae, Salida 5 (09:10)',
      { required: false },
    ],
    [
      'Estación Seomyeon, Salida 4 (08:30); Estación de Busan, Salida 4 — no la puerta del KTX (08:50); Estación Haeundae, Salida 5 (09:30)',
      'Estación de Busan, Salida 4 — no la puerta del KTX (08:10); Estación Seomyeon, Salida 4 (08:30); Estación Haeundae, Salida 5 (09:10)',
      { required: false },
    ],
    [
      'Salida 4 de la Estación Seomyeon (08:30), Salida 4 de la Estación de Busan — no la puerta del KTX (08:50), Salida 5 de la Estación Haeundae (09:30)',
      'Salida 4 de la Estación de Busan — no la puerta del KTX (08:10), Salida 4 de la Estación Seomyeon (08:30), Salida 5 de la Estación Haeundae (09:10)',
      { required: false },
    ],
  ],
  zh: [
    ['08:30首次接客', '08:10首次接客'],
    ['08:30首次接送', '08:10首次接送'],
    ['08:30至18:00', '08:10至18:00'],
    ['从西北向东的接送顺序', '自西向东的接送顺序'],
    ['并于约10:00抵达海东龙宫寺', '并于约09:50抵达海东龙宫寺'],
    [
      '（通常釜山站最先约09:00，西面约09:15，海云台约09:30）',
      '（釜山站4号出口08:10、西面站4号出口08:30、海云台站5号出口09:10）',
    ],
    [
      '三处接送站均位于釜山地铁沿线：西面站4号出口（08:30）、釜山站4号出口（非KTX检票口）（08:50）、海云台站5号出口（09:30）。',
      '三处接送站均位于釜山地铁沿线：釜山站4号出口（非KTX检票口）（08:10）、西面站4号出口（08:30）、海云台站5号出口（09:10）。',
    ],
    [
      '三处接送站均位于釜山地铁沿线：西面站4号出口（08:30）、釜山站……',
      '三处接送站均位于釜山地铁沿线：釜山站4号出口（08:10）、西面站……',
    ],
    [
      '实际游览时长因上车地点而异：西面出发约10小时，海云台出发约9.5小时。',
      '实际游览时长因上车地点而异：釜山站与西面出发约10小时，海云台出发略少于10小时。',
    ],
    [
      '釜山市中心三处集合点：西面站4号出口（08:30）、釜山站4号出口——非KTX检票口（08:50）、海云台站5号出口（09:30）。',
      '釜山市中心三处集合点：釜山站4号出口——非KTX检票口（08:10）、西面站4号出口（08:30）、海云台站5号出口（09:10）。',
    ],
    [
      '接送地点分别为西面站、釜山站或海云台站——可从釜山市中心大多数住宿处便捷抵达。请选择离您酒店最近的出口；行程总时长因接送地点不同，上下浮动约30分钟。',
      '接送地点分别为釜山站、西面站或海云台站——可从釜山市中心大多数住宿处便捷抵达。请选择离您酒店最近的出口；实际行程时长因接送地点不同，相差约15分钟。',
    ],
    [
      '西面站4号出口（08:30）、釜山站4号出口（08:50）、海云台站5号出口（09:30）',
      '釜山站4号出口（08:10）、西面站4号出口（08:30）、海云台站5号出口（09:10）',
      { required: false },
    ],
    [
      '西面站4号出口（08:30）、釜山站4号出口——非KTX检票口（08:50）、海云台站5号出口（09:30）',
      '釜山站4号出口——非KTX检票口（08:10）、西面站4号出口（08:30）、海云台站5号出口（09:10）',
      { required: false },
    ],
    [
      '西面约10小时，海云台约9.5小时',
      '釜山站与西面约10小时，海云台略少于10小时',
      { required: false },
    ],
    [
      '釜山市中心三处接客站点：西面站4号出口（08:30）、釜山站4号出口——非KTX检票口（08:50）、海云台站5号出口（09:30）。',
      '釜山市中心三处接客站点：釜山站4号出口——非KTX检票口（08:10）、西面站4号出口（08:30）、海云台站5号出口（09:10）。',
      { required: false },
    ],
  ],
  'zh-TW': [
    ['08:30首班接送', '08:10首班接送'],
    ['08:30 首站接送', '08:10 首站接送'],
    ['08:30 至 18:00', '08:10 至 18:00'],
    ['在約 10:00 抵達海東龍宮寺', '在約 09:50 抵達海東龍宮寺'],
    [
      '（通常釜山站約 09:00，西面站約 09:15，海雲台站約 09:30）',
      '（釜山站4號出口 08:10、西面站4號出口 08:30、海雲台站5號出口 09:10）',
    ],
    [
      '沿釜山地鐵設有三個接送點：西面站4號出口（08:30）、釜山站4號出口（非KTX閘口，08:50）、海雲台站5號出口（09:30）。',
      '沿釜山地鐵設有三個接送點：釜山站4號出口（非KTX閘口，08:10）、西面站4號出口（08:30）、海雲台站5號出口（09:10）。',
    ],
    [
      '沿釜山地鐵設有三個接送點：西面站4號出口（08:30）、釜山站……',
      '沿釜山地鐵設有三個接送點：釜山站4號出口（08:10）、西面站……',
    ],
    [
      '實際行程時長依接送地點而定：西面約10小時，海雲台約9.5小時。',
      '實際行程時長依接送地點而定：釜山站與西面約10小時，海雲台略少於10小時。',
    ],
    [
      '釜山市中心共三個接送站：西面站4號出口（08:30）、釜山站4號出口——非KTX閘口（08:50）、海雲臺站5號出口（09:30）。',
      '釜山市中心共三個接送站：釜山站4號出口——非KTX閘口（08:10）、西面站4號出口（08:30）、海雲臺站5號出口（09:10）。',
    ],
    [
      '接送地點為西面、釜山站或海雲台——可從釜山市中心大多數住宿地點前往。請選擇距離飯店最近的出口；行程總時長將依接送地點增減約30分鐘。',
      '接送地點為釜山站、西面或海雲台——可從釜山市中心大多數住宿地點前往。請選擇距離飯店最近的出口；實際行程時長依接送地點約有15分鐘差異。',
    ],
    [
      '西面站4號出口（08:30）、釜山站4號出口（08:50）、海雲台站5號出口（09:30）',
      '釜山站4號出口（08:10）、西面站4號出口（08:30）、海雲台站5號出口（09:10）',
      { required: false },
    ],
    [
      '西面站4號出口（08:30）、釜山站4號出口——非KTX閘口（08:50）、海雲台站5號出口（09:30）',
      '釜山站4號出口——非KTX閘口（08:10）、西面站4號出口（08:30）、海雲台站5號出口（09:10）',
      { required: false },
    ],
    [
      '西面約10小時，海雲台約9.5小時',
      '釜山站與西面約10小時，海雲台略少於10小時',
      { required: false },
    ],
    [
      '釜山市中心三個接送站點：西面站4號出口（08:30）、釜山站4號出口——非KTX閘口（08:50）、海雲台站5號出口（09:10）。',
      '釜山市中心三個接送站點：釜山站4號出口——非KTX閘口（08:10）、西面站4號出口（08:30）、海雲台站5號出口（09:10）。',
      { required: false },
    ],
  ],
};

function buildPickupDropoff(locale) {
  const spec = PICKUP_BY_LOCALE[locale];
  return {
    departure: spec.names.map((name, i) => ({
      order: i + 1,
      time: DEPARTURE_TIMES[i],
      name,
      type: 'station',
      lat: DEPARTURE_COORDS[i].lat,
      lng: DEPARTURE_COORDS[i].lng,
    })),
    return: spec.returnNames.map((name, i) => ({
      order: i + 1,
      name,
      type: 'station',
      lat: RETURN_COORDS[i].lat,
      lng: RETURN_COORDS[i].lng,
    })),
    notes: spec.notes,
  };
}

/** Rewrite every string in the tree, counting hits per fragment. */
function sweepStrings(node, fragments, hits) {
  if (typeof node === 'string') {
    let out = node;
    for (const [from, to] of fragments) {
      if (out.includes(from)) {
        hits.set(from, (hits.get(from) ?? 0) + 1);
        out = out.split(from).join(to);
      }
    }
    return out;
  }
  if (Array.isArray(node)) return node.map((v) => sweepStrings(v, fragments, hits));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = sweepStrings(v, fragments, hits);
    return out;
  }
  return node;
}

let failed = false;
for (const locale of LOCALES) {
  const file = path.join(DIR, `${SLUG}.${locale}.json`);
  const original = fs.readFileSync(file, 'utf8');
  let doc = JSON.parse(original);

  // 1) prose sweep — longest fragment first so a full sentence beats the
  //    accordion `preview` that is a prefix of it.
  const fragments = [...FRAGMENTS[locale]].sort((a, b) => b[0].length - a[0].length);
  const hits = new Map();
  doc = sweepStrings(doc, fragments, hits);

  for (const [from, , opts] of FRAGMENTS[locale]) {
    const required = opts?.required !== false;
    if (required && !hits.get(from)) {
      console.error(`[${locale}] MISSING required fragment: ${from.slice(0, 80)}…`);
      failed = true;
    }
  }

  // 2) stop 1 — the pickup leg itself
  const s0 = STOP0[locale];
  const stop = doc.itineraryStops[0];
  stop.time = s0.time;
  stop.duration = s0.duration;
  stop.timeUsed = [...s0.timeUsed];

  // 3) page_sections mirror (DEAD data, kept consistent so the file does not
  //    contradict itself for the next human who reads it)
  const itinSection = (doc.page_sections ?? []).find((s) => s?.id === 'itinerary');
  const mirror = itinSection?.props?.itineraryStops?.[0];
  if (mirror) {
    mirror.time = s0.sectionTime;
    mirror.duration = s0.duration;
    mirror.timeUsed = [s0.timeUsed[0]];
  }

  // 4) pickup_dropoff — present only in the EN bundle before this change
  doc.pickup_dropoff = buildPickupDropoff(locale);

  // 5) guard: no stale pickup time may survive on a rendered surface.
  //    09:30 is legitimate elsewhere (Sky Capsule opening hours), 08:50 is not.
  const live = { ...doc };
  delete live.page_sections;
  delete live._publication;
  const liveJson = JSON.stringify(live);
  if (liveJson.includes('08:50')) {
    console.error(`[${locale}] stale 08:50 still on a rendered surface`);
    failed = true;
  }

  const next = `${JSON.stringify(doc, null, 2)}\n`;
  if (CHECK_ONLY) {
    console.log(`[${locale}] ${next === original ? 'unchanged' : 'would change'}`);
  } else {
    fs.writeFileSync(file, next, 'utf8');
    console.log(`[${locale}] written (${hits.size}/${FRAGMENTS[locale].length} fragments hit)`);
  }
}

if (failed) {
  console.error('\nFAILED — bundles were still written; inspect the diff before committing.');
  process.exit(1);
}
console.log('\nPickup order is now Busan Station 08:10 → Seomyeon 08:30 → Haeundae 09:10.');
