#!/usr/bin/env node
/**
 * Busan small-group tour — hotel pickup + owner's new day schedule
 * (owner instruction 2026-08-05).
 *
 * Pickup stops being three subway stations and becomes **door-to-door pickup
 * at downtown Busan hotels, 09:00–10:00**. The owner also fixed the rest of
 * the day:
 *
 *     Yonggungsa        10:20 – 11:20
 *     Cheongsapo        11:40 – 13:20   (Daritdol skywalk, then Sky Capsule)
 *     Haeundae Beach    14:10 – 14:30   ← NEW stop
 *     Gamcheon          15:10 – 16:10
 *     Dakbatgol         16:30 – 17:00
 *
 * ⚠ TWO THINGS WERE DERIVED, NOT DICTATED — flagged, not hidden:
 *   1) Lunch. The owner's list has one gap, 13:20 → 14:10, which is exactly
 *      where the existing lunch stop already sat. Lunch is placed there at
 *      45 min.
 *   2) Drop-offs. Dakbatgol now ends at 17:00 instead of 17:40, so the four
 *      central drops move 40 min earlier, keeping the intervals the product
 *      already published (+20 / +20 / +30):
 *      Nampo-dong 17:10 · Busan Station 17:30 · Seomyeon 17:50 · Haeundae 18:20.
 *
 * That makes the day ≈9 h (09:00 first pickup → ≈17:50 last central drop),
 * down from the ≈10 h the card claimed. matching_profile.duration_hours was
 * already 9, so this closes a gap rather than opening one.
 *
 * This script edits the AUTHORING SOURCES — scripts/busan-smallgroup-content/
 * *.json and donor-overlay/*.json — because build-busan-smallgroup-2026-08.mjs
 * regenerates the bundles from them. Editing the bundles directly would be
 * undone by the next build.
 *
 * Usage: node scripts/recourse-busan-smallgroup-hotel-pickup-2026-08.mjs
 *  then: node scripts/build-busan-smallgroup-2026-08.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(__dirname, 'busan-smallgroup-content');
const OVERLAY = path.join(CONTENT, 'donor-overlay');
const BASE = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'];
const EXT = ['de', 'fr', 'it', 'ru'];
const ALL = [...BASE, ...EXT];

/**
 * Minute tokens per locale, longest first so 分鐘/分钟 win over 分.
 * Used by retime() to rewrite the "(~N min)" breakdowns without touching
 * other numbers in the same line ("108 stairs" must survive).
 */
const MIN_UNITS = {
  en: ['min'],
  es: ['min'],
  fr: ['min'],
  it: ['min'],
  ko: ['분'],
  ja: ['分'],
  zh: ['分钟', '分'],
  'zh-TW': ['分鐘', '分'],
  de: ['Min.', 'Min'],
  ru: ['мин'],
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace the single "N <minutes>" figure on each line with targets[i].
 * Throws if a line does not carry exactly one — silence here would ship a
 * breakdown that no longer adds up to the stop's stated duration.
 */
function retime(lines, targets, loc, ctx) {
  const unit = new RegExp(`(\\d+)(?=\\s*(?:${MIN_UNITS[loc].map(esc).join('|')}))`, 'g');
  if (lines.length !== targets.length) {
    throw new Error(`[${loc}] ${ctx}: ${lines.length} lines vs ${targets.length} targets`);
  }
  return lines.map((line, i) => {
    const found = line.match(unit);
    if (!found || found.length !== 1) {
      throw new Error(`[${loc}] ${ctx}: line ${i} has ${found?.length ?? 0} minute figures — ${line}`);
    }
    return line.replace(unit, String(targets[i]));
  });
}

/** Exact-substring replacement that fails loudly when the source drifted. */
function sub(text, from, to, loc, ctx) {
  if (!text.includes(from)) throw new Error(`[${loc}] ${ctx}: not found — ${from.slice(0, 70)}`);
  return text.split(from).join(to);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-locale authored copy
// ─────────────────────────────────────────────────────────────────────────────

const P = {
  en: {
    duration: '≈ 9 hours',
    heroDuration: '≈ 9 hours (09:00 hotel pickup, ≈ 17:50 last central drop)',
    heroStopsLabel: '9 stops',
    seoFrom: '10-hour Busan small-group day tour',
    seoTo: '9-hour Busan small-group day tour, hotel pickup',
    introFrom: "After lunch the day crosses to Busan's west hillsides",
    introTo: "After lunch and a short stop on Haeundae Beach the day crosses to Busan's west hillsides",
    introTailFrom: 'Central drop-offs close the loop, 08:30 to about 18:30.',
    introTailTo: 'Central drop-offs close the loop, 09:00 to about 18:20.',
    yongWhyFrom: 'The 10:00 arrival lands before',
    yongWhyTo: 'The 10:20 arrival lands before',
    whyItem0:
      "Haedong Yonggungsa is Busan's most-photographed temple and its tour-bus surge starts around 11:00. Arriving at about 10:20 keeps the 108-stair descent and the Haesu Gwaneum viewpoint walkable without queuing.",
    routePhases: [
      {
        phase: 'Coastal morning',
        duration: '≈ 3.5 hours',
        description:
          "Door-to-door hotel pickup across central Busan (09:00–10:00), then Haedong Yonggungsa Temple before the tour-bus surge, and on to Cheongsapo's Daritdol glass skywalk.",
      },
      {
        phase: 'Sky Capsule, lunch & beach',
        duration: '≈ 2 hours',
        description:
          'The pastel Sky Capsule ride from Cheongsapo to Mipo (ticket optional — non-riders take the coach or walk the Green Railway boardwalk), lunch near Haeundae, then twenty minutes on Haeundae Beach itself.',
      },
      {
        phase: 'Two hillside villages',
        duration: '≈ 2 hours',
        description:
          "Gamcheon Culture Village's photo loop (60 min), then the quiet Dakbatgol mural village and its free wish-stairs monorail (30 min).",
      },
      {
        phase: 'Central close',
        duration: '≈ 1 hour',
        description: 'Sequential drop-offs: Nampo-dong, Busan Station, Seomyeon, then Haeundae.',
      },
    ],
    staticQ6:
      'Pickup is door-to-door at your hotel in central Busan between 09:00 and 10:00 — the exact time is confirmed by WhatsApp the evening before. Drop-offs run in sequence: Nampo-dong ≈17:10, Busan Station ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
    practicalPickup: {
      title: 'Pickup & drop-off',
      content: [
        'Pickup is door-to-door at your hotel in central Busan — Seomyeon, Nampo-dong / Busan Station, Haeundae / Marine City — between 09:00 and 10:00. Your exact time is confirmed by WhatsApp the evening before.',
        'Drop-offs in sequence: Nampo-dong/Jagalchi ≈17:10, Busan Station ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
        'Your effective tour length depends on your pickup time and where you get off — about 7¼ hours at the shortest (10:00 pickup, Nampo-dong drop) and about 9¼ at the longest (09:00 pickup, Haeundae drop).',
      ],
    },
    pdNotes: [
      'Pickup is door-to-door at your central Busan hotel between 09:00 and 10:00; the exact time is confirmed the evening before. Drop-offs are at four central points in sequence (Nampo-dong → Busan Station → Seomyeon → Haeundae, ≈ 17:10–18:20) — tell the guide during the afternoon which one you want.',
    ],
    pdDeparture: {
      name: 'Your downtown Busan hotel (door-to-door)',
      note: 'Door-to-door pickup at hotels in central Busan — Seomyeon, Nampo-dong / Busan Station, Haeundae / Marine City. Your exact time is confirmed the evening before.',
    },
    pickupStop: {
      name: 'Pickup (your downtown Busan hotel)',
      category: 'Transit / Hotel Pickup',
      duration: '60 min',
      description:
        'Door-to-door pickup at your hotel in central Busan, between **09:00 and 10:00**. Your exact time is confirmed by WhatsApp the evening before, once the driver has the day\'s hotel list and can order the run efficiently — guests on the Haeundae side are usually collected last, because the coach leaves the city heading northeast toward Gijang-gun for the first stop.\n\nThe supported area covers the central hotel clusters: **Seomyeon**, **Nampo-dong / Busan Station**, and **Haeundae / Marine City**. If your hotel sits outside that area, the guide names the nearest meeting point when the booking is confirmed.\n\nPlease wait in the lobby 5 minutes before your confirmed time. Transit from the last pickup to Haedong Yonggungsa is about 30–40 minutes depending on traffic.',
      highlights: [
        'Door-to-door pickup at central Busan hotels, 09:00–10:00',
        'Exact time confirmed by WhatsApp the evening before',
        'Coach is small-group (max ~14 pax)',
        'Printed Korean-English itinerary card distributed at pickup',
      ],
      timeUsed: ['Hotel pickups across central Busan (~40 min)', 'Drive northeast to Gijang-gun (~20 min)'],
      whyOnRoute:
        'Hotel pickup removes the morning transfer entirely — no early subway ride, no hunting for the right station exit. The run is ordered west→east so the coach finishes near Haeundae and leaves the city already pointed at Gijang and the day\'s first stop.',
    },
    haeundaeBeach: {
      name: 'Haeundae Beach',
      category: 'Beach / Free',
      duration: '20 min',
      description:
        "**Haeundae Beach (해운대해수욕장)** is Korea's best-known stretch of sand — about **1.5 km** of shoreline curving between Dongbaekseom island at the west end and Mipo at the east, backed by the Marine City skyline. The Sky Capsule sets you down at Mipo, which is simply the eastern end of this beach, so the stop costs the day no extra driving.\n\nTwenty minutes is a photo-and-toes stop, not a swim: walk out onto the sand, shoot the skyline, and rejoin the coach. In July and August the beach is at its busiest and the parasol rows are up; the rest of the year it is wide, quiet and walkable. Free, open at all hours.",
      highlights: [
        "**Korea's most famous beach** — ~1.5 km of sand, FREE and open 24h",
        'Marine City skyline backdrop from the water\'s edge',
        'Dongbaekseom island and Nurimaru APEC House at the far west end',
        'Directly at Mipo, where the Sky Capsule ride ends — no extra transfer',
      ],
      timeUsed: [
        'Walk onto the sand from Mipo (~5 min)',
        'Beach and skyline photos (~10 min)',
        'Reassemble at the coach (~5 min)',
      ],
      whyOnRoute:
        "The capsule lands at Mipo, which is the beach's eastern end — so Busan's most famous view is a five-minute walk away and costs the day nothing. It is deliberately short: enough to stand on the sand and photograph the skyline before the afternoon turns to the hillside villages.",
      visitBasics: {
        hours: 'Open 24 hours',
        closed: 'Never',
        walking: 'Flat sand and a paved promenade',
        admission: 'FREE',
      },
    },
    dropoff: {
      description:
        '**Drop-offs run in sequence from the west side back east**: **Nampo-dong / Jagalchi area (~17:10)** — step off here for Busan\'s best evening food streets and the BIFF Square night scene; **Busan Station (~17:30)** for KTX connections; **Seomyeon (~17:50)** for the central hotel cluster; and **Haeundae (~18:20)** last. Choose your drop point with the guide during the afternoon — staying on to Haeundae is the longest ride but lands you by the beach for the evening.',
      whyOnRoute:
        'Dakbatgol sits ten minutes from Nampo-dong, so the drop sequence starts almost immediately after the last stop — no dead transfer time. The west-to-east order covers KTX travelers (Busan Station), central hotels (Seomyeon), and beach hotels (Haeundae) without backtracking.',
      timeUsed: [
        'Nampo-dong / Jagalchi area (~17:10)',
        'Busan Station (~17:30)',
        'Seomyeon (~17:50)',
        'Haeundae (~18:20)',
      ],
    },
    lunchDescFrom: 'About a 60-minute lunch',
    lunchDescTo: 'About a 45-minute lunch',
    booking: {
      0: 'Instant booking confirmation, with your hotel pickup window (09:00–10:00) and what to expect.',
      3: 'A message the evening before confirms your exact hotel pickup time; a morning message covers real-time traffic.',
    },
  },

  ko: {
    duration: '약 9시간',
    heroDuration: '약 9시간 (호텔 픽업 09:00, 마지막 시내 하차 약 17:50)',
    heroStopsLabel: '9개 스톱',
    seoFrom: '10시간 부산',
    seoTo: '9시간 부산',
    introFrom: '점심 후에는',
    introTo: '점심과 해운대해수욕장에서의 짧은 정차 후에는',
    introTailFrom: '08:30~약 18:30.',
    introTailTo: '09:00~약 18:20.',
    yongWhyFrom: '10:00 도착은',
    yongWhyTo: '10:20 도착은',
    whyItem0:
      '해동 용궁사는 부산에서 가장 많이 촬영되는 사찰이며 관광버스는 보통 11:00부터 몰립니다. 약 10:20에 도착하면 108계단 하행과 해수관음상 전망 포인트를 줄 서지 않고 걸을 수 있습니다.',
    routePhases: [
      {
        phase: '해안의 오전',
        duration: '약 3.5시간',
        description:
          '부산 시내 호텔 도어투도어 픽업(09:00–10:00) 후 관광버스가 몰리기 전 해동 용궁사, 이어서 청사포 다릿돌 유리 전망대로 이동합니다.',
      },
      {
        phase: '스카이캡슐 · 점심 · 해변',
        duration: '약 2시간',
        description:
          '청사포에서 미포까지 파스텔 스카이캡슐 탑승(티켓 선택 — 미탑승 시 차량 이동 또는 그린레일웨이 산책로 도보), 해운대 인근 점심, 그리고 해운대해수욕장에서 20분.',
      },
      {
        phase: '두 곳의 언덕 마을',
        duration: '약 2시간',
        description:
          '감천문화마을 포토 루프(60분), 이어서 조용한 닥밭골 벽화마을과 무료 소망계단 모노레일(30분).',
      },
      {
        phase: '시내 마무리',
        duration: '약 1시간',
        description: '순차 하차: 남포동, 부산역, 서면, 해운대.',
      },
    ],
    staticQ6:
      '픽업은 부산 시내 호텔 도어투도어이며 09:00–10:00 사이에 진행됩니다. 정확한 시각은 전날 저녁 왓츠앱으로 확정해 드립니다. 하차는 순서대로 남포동 약 17:10, 부산역 약 17:30, 서면 약 17:50, 해운대 약 18:20입니다.',
    practicalPickup: {
      title: '픽업 및 드롭오프',
      content: [
        '픽업은 부산 시내 호텔 도어투도어입니다 — 서면, 남포동/부산역, 해운대/마린시티 — 09:00에서 10:00 사이. 정확한 시각은 전날 저녁 왓츠앱으로 확정됩니다.',
        '드롭오프 순서: 남포동/자갈치 약 17:10, 부산역 약 17:30, 서면 약 17:50, 해운대 약 18:20.',
        '실질적인 투어 시간은 픽업 시각과 하차 지점에 따라 다릅니다 — 가장 짧으면 약 7시간 15분(10:00 픽업·남포동 하차), 가장 길면 약 9시간 15분(09:00 픽업·해운대 하차)입니다.',
      ],
    },
    pdNotes: [
      '픽업은 부산 시내 호텔 도어투도어이며 09:00–10:00 사이에 진행되고, 정확한 시각은 전날 저녁에 확정됩니다. 하차는 시내 4개 지점을 순서대로 지납니다(남포동 → 부산역 → 서면 → 해운대, 약 17:10–18:20). 오후 중에 가이드에게 원하는 하차 지점을 알려 주세요.',
    ],
    pdDeparture: {
      name: '부산 시내 호텔 (도어투도어)',
      note: '부산 시내 호텔 도어투도어 픽업 — 서면, 남포동/부산역, 해운대/마린시티. 정확한 시각은 전날 저녁에 확정됩니다.',
    },
    pickupStop: {
      name: '픽업 (부산 시내 호텔)',
      category: '이동 / 호텔 픽업',
      duration: '60분',
      description:
        '부산 시내 호텔에서 **09:00~10:00** 사이 도어투도어로 픽업해 드립니다. 정확한 시각은 당일 호텔 명단이 확정되어 동선을 효율적으로 짤 수 있는 전날 저녁에 왓츠앱으로 안내됩니다. 해운대 쪽 숙소는 대개 마지막 순서인데, 차량이 첫 목적지인 기장군을 향해 북동쪽으로 시내를 빠져나가기 때문입니다.\n\n지원 구역은 시내 주요 호텔 밀집지역입니다: **서면**, **남포동/부산역**, **해운대/마린시티**. 숙소가 이 구역 밖이라면 예약 확정 시 가장 가까운 집합 장소를 안내해 드립니다.\n\n확정된 시각 5분 전에 로비에서 기다려 주세요. 마지막 픽업에서 해동 용궁사까지는 교통 상황에 따라 약 30~40분 소요됩니다.',
      highlights: [
        '부산 시내 호텔 도어투도어 픽업, 09:00~10:00',
        '정확한 시각은 전날 저녁 왓츠앱으로 확정',
        '소규모 그룹 전용 차량 (최대 약 14명)',
        '탑승 시 한국어·영어 병기 일정표 카드 배포',
      ],
      timeUsed: ['부산 시내 호텔 순차 픽업 (약 40분)', '기장군 방면 북동쪽 이동 (약 20분)'],
      whyOnRoute:
        '호텔 픽업은 아침 이동을 통째로 없앱니다 — 이른 지하철도, 출구 찾기도 필요 없습니다. 서→동 순서로 돌기 때문에 차량은 해운대 부근에서 픽업을 마치고 이미 기장 방향을 향한 채 시내를 빠져나갑니다.',
    },
    haeundaeBeach: {
      name: '해운대해수욕장',
      category: '해변 / 무료',
      duration: '20분',
      description:
        '**해운대해수욕장**은 한국에서 가장 잘 알려진 백사장으로, 서쪽 끝 동백섬과 동쪽 끝 미포 사이를 약 **1.5km** 곡선으로 잇고 뒤로는 마린시티 스카이라인이 서 있습니다. 스카이캡슐이 내려 주는 미포가 바로 이 해변의 동쪽 끝이라, 이 정차에는 추가 이동이 전혀 들지 않습니다.\n\n20분은 수영이 아니라 사진과 발끝을 위한 시간입니다. 모래사장으로 걸어 나가 스카이라인을 찍고 차량으로 돌아옵니다. 7~8월에는 가장 붐비고 파라솔이 늘어서며, 그 외 기간에는 넓고 조용해 걷기 좋습니다. 무료이며 24시간 개방입니다.',
      highlights: [
        '**한국에서 가장 유명한 해변** — 약 1.5km 백사장, 무료·24시간 개방',
        '물가에서 바라보는 마린시티 스카이라인',
        '서쪽 끝의 동백섬과 누리마루 APEC 하우스',
        '스카이캡슐이 끝나는 미포 바로 앞 — 추가 이동 없음',
      ],
      timeUsed: ['미포에서 모래사장까지 도보 (약 5분)', '해변·스카이라인 사진 (약 10분)', '차량 집합 (약 5분)'],
      whyOnRoute:
        '캡슐이 도착하는 미포가 해변의 동쪽 끝이라, 부산에서 가장 유명한 풍경이 도보 5분 거리이고 일정에 부담을 주지 않습니다. 오후의 언덕 마을로 넘어가기 전에 모래를 밟고 스카이라인을 담을 만큼만 머무는, 의도적으로 짧은 정차입니다.',
      visitBasics: {
        hours: '24시간 개방',
        closed: '연중무휴',
        walking: '평평한 백사장과 포장 산책로',
        admission: '무료',
      },
    },
    dropoff: {
      description:
        '**하차는 서쪽에서 동쪽으로 순차 진행됩니다**: **남포동/자갈치 (약 17:10)** — 부산 최고의 저녁 먹자골목과 BIFF 광장 야경을 즐기실 분은 여기서 내리세요. **부산역 (약 17:30)**은 KTX 환승용, **서면 (약 17:50)**은 시내 호텔 밀집지역, 마지막이 **해운대 (약 18:20)**입니다. 오후 중에 가이드와 하차 지점을 정하시면 됩니다 — 해운대까지 타고 가면 가장 오래 걸리지만 저녁을 바닷가에서 시작할 수 있습니다.',
      whyOnRoute:
        '닥밭골은 남포동에서 10분 거리라 마지막 스톱이 끝나자마자 하차가 시작됩니다 — 빈 이동 시간이 없습니다. 서→동 순서가 KTX 이용객(부산역), 시내 호텔(서면), 해변 호텔(해운대)을 되돌아가지 않고 모두 커버합니다.',
      timeUsed: ['남포동/자갈치 (약 17:10)', '부산역 (약 17:30)', '서면 (약 17:50)', '해운대 (약 18:20)'],
    },
    lunchDescFrom: '약 60분의 점심',
    lunchDescTo: '약 45분의 점심',
    booking: {
      0: '예약 즉시 확정 안내와 함께 호텔 픽업 시간대(09:00–10:00)와 준비 사항을 보내 드립니다.',
      3: '전날 저녁 메시지로 정확한 호텔 픽업 시각을, 당일 아침 메시지로 실시간 교통 상황을 안내합니다.',
    },
  },

  ja: {
    duration: '約9時間',
    heroDuration: '約9時間（ホテルお迎え 09:00、最終の市内送り 約17:50）',
    heroStopsLabel: '9か所',
    seoFrom: '10時間の釜山',
    seoTo: '9時間の釜山',
    introFrom: '昼食後は',
    introTo: '昼食と海雲台ビーチでの短い立ち寄りのあとは',
    introTailFrom: '08:30〜約18:30。',
    introTailTo: '09:00〜約18:20。',
    yongWhyFrom: '10:00の到着は',
    yongWhyTo: '10:20の到着は',
    whyItem0:
      '海東龍宮寺は釜山で最も撮影される寺院で、観光バスの混雑は概ね11:00から始まります。約10:20に到着することで、108段の階段の下りと海水観音の展望ポイントを行列なしで歩けます。',
    routePhases: [
      {
        phase: '海岸の朝',
        duration: '約3.5時間',
        description:
          '釜山中心部のホテルへのドアツードアお迎え（09:00〜10:00）のあと、観光バスが増える前の海東龍宮寺、続いて青沙浦タリットルのガラス張り展望台へ。',
      },
      {
        phase: 'スカイカプセル・ランチ・ビーチ',
        duration: '約2時間',
        description:
          '青沙浦から尾浦（ミポ）までパステルカラーのスカイカプセル（チケットは任意 — 乗らない方はコーチ移動またはグリーンレイルウェイの遊歩道を散策）、海雲台近くでランチ、そして海雲台ビーチで20分。',
      },
      {
        phase: '2つの丘の村',
        duration: '約2時間',
        description:
          '甘川文化村のフォトループ（60分）、続いて静かなタクバッコル壁画村と無料の願いの階段モノレール（30分）。',
      },
      {
        phase: '市内で締めくくり',
        duration: '約1時間',
        description: '順番に降車：南浦洞、釜山駅、西面、海雲台。',
      },
    ],
    staticQ6:
      'お迎えは釜山中心部のホテルへのドアツードアで、09:00〜10:00の間です。正確な時刻は前日の夕方にWhatsAppで確定します。降車は順番に、南浦洞 約17:10、釜山駅 約17:30、西面 約17:50、海雲台 約18:20です。',
    practicalPickup: {
      title: '送迎について',
      content: [
        'お迎えは釜山中心部のホテルへのドアツードアです — 西面、南浦洞／釜山駅、海雲台／マリンシティ — 09:00〜10:00の間。正確な時刻は前日の夕方にWhatsAppで確定します。',
        '降車は順番に：南浦洞／チャガルチ 約17:10、釜山駅 約17:30、西面 約17:50、海雲台 約18:20。',
        'ツアーの実質所要時間はお迎え時刻と降車地点によって異なります — 最短で約7時間15分（10:00お迎え・南浦洞降車）、最長で約9時間15分（09:00お迎え・海雲台降車）です。',
      ],
    },
    pdNotes: [
      'お迎えは釜山中心部のホテルへのドアツードアで09:00〜10:00の間、正確な時刻は前日の夕方に確定します。降車は市内4か所を順番に回ります（南浦洞 → 釜山駅 → 西面 → 海雲台、約17:10〜18:20）。ご希望の降車地点は午後のうちにガイドへお伝えください。',
    ],
    pdDeparture: {
      name: '釜山市内のご滞在ホテル（ドアツードア）',
      note: '釜山中心部のホテルへのドアツードアお迎え — 西面、南浦洞／釜山駅、海雲台／マリンシティ。正確な時刻は前日の夕方に確定します。',
    },
    pickupStop: {
      name: 'お迎え（釜山市内のご滞在ホテル）',
      category: '移動 / ホテルお迎え',
      duration: '60分',
      description:
        '釜山中心部のホテルへ、**09:00〜10:00**の間にドアツードアでお迎えにあがります。正確な時刻は、当日のホテル一覧が揃って効率的な順路を組める前日の夕方に、WhatsAppでご案内します。海雲台側にご滞在の方は最後になることが多いですが、これはコーチが最初の目的地である機張郡へ向けて北東に市内を出るためです。\n\n対応エリアは市内の主要ホテル集積地です：**西面**、**南浦洞／釜山駅**、**海雲台／マリンシティ**。エリア外のホテルの場合は、ご予約確定時に最寄りの集合場所をご案内します。\n\n確定時刻の5分前にはロビーでお待ちください。最後のお迎えから海東龍宮寺までは交通状況により約30〜40分です。',
      highlights: [
        '釜山中心部のホテルへドアツードアお迎え、09:00〜10:00',
        '正確な時刻は前日の夕方にWhatsAppで確定',
        '少人数グループ専用車両（最大14名程度）',
        '乗車時に韓国語・英語併記の日程カードをお渡し',
      ],
      timeUsed: ['釜山中心部のホテルを順にお迎え（約40分）', '機張郡方面へ北東に移動（約20分）'],
      whyOnRoute:
        'ホテルお迎えは朝の移動そのものをなくします — 早朝の地下鉄も、正しい出口探しも不要です。西から東の順に回るため、コーチは海雲台付近でお迎えを終え、すでに機張方面を向いた状態で市内を離れます。',
    },
    haeundaeBeach: {
      name: '海雲台ビーチ',
      category: 'ビーチ / 無料',
      duration: '20分',
      description:
        '**海雲台海水浴場（해운대해수욕장）**は韓国で最も知られた砂浜で、西端の冬柏島（トンベクソム）から東端の尾浦（ミポ）まで約**1.5km**の弧を描き、背後にマリンシティのスカイラインが立ち上がります。スカイカプセルが降ろす尾浦はこのビーチの東端そのものなので、この立ち寄りに追加の移動は一切かかりません。\n\n20分は泳ぐ時間ではなく、写真と波打ち際のための時間です。砂浜へ歩き出し、スカイラインを撮って、コーチに戻ります。7〜8月は最も賑わいパラソルが並びますが、それ以外の季節は広く静かで歩きやすいビーチです。無料・24時間開放。',
      highlights: [
        '**韓国で最も有名なビーチ** — 約1.5kmの砂浜、無料・24時間開放',
        '波打ち際から望むマリンシティのスカイライン',
        '西端の冬柏島とヌリマルAPECハウス',
        'スカイカプセルの終点・尾浦のすぐ目の前 — 追加移動なし',
      ],
      timeUsed: ['尾浦から砂浜へ徒歩（約5分）', 'ビーチとスカイラインの撮影（約10分）', 'コーチに集合（約5分）'],
      whyOnRoute:
        'カプセルが着く尾浦はビーチの東端。釜山で最も有名な景色が徒歩5分の距離にあり、一日の行程に負担をかけません。午後の丘の村へ移る前に、砂を踏んでスカイラインを撮るだけの、意図的に短い立ち寄りです。',
      visitBasics: {
        hours: '24時間開放',
        closed: '年中無休',
        walking: '平坦な砂浜と舗装された遊歩道',
        admission: '無料',
      },
    },
    dropoff: {
      description:
        '**降車は西側から東へ順番に進みます**：**南浦洞／チャガルチ（約17:10）** — 釜山随一の夜の食べ歩き通りとBIFF広場の夜景を楽しむ方はここで。**釜山駅（約17:30）**はKTX乗り継ぎ用、**西面（約17:50）**は市内ホテル集積地、最後が**海雲台（約18:20）**です。降車地点は午後のうちにガイドとお決めください — 海雲台まで乗ると最も長くなりますが、夕方を海辺で始められます。',
      whyOnRoute:
        'タクバッコルは南浦洞から10分の距離なので、最後の見学が終わるとすぐ降車が始まります — 無駄な移動時間がありません。西から東の順で、KTX利用者（釜山駅）、市内ホテル（西面）、ビーチ側ホテル（海雲台）を戻ることなくカバーします。',
      timeUsed: ['南浦洞／チャガルチ（約17:10）', '釜山駅（約17:30）', '西面（約17:50）', '海雲台（約18:20）'],
    },
    lunchDescFrom: '約60分の昼食',
    lunchDescTo: '約45分の昼食',
    booking: {
      0: 'ご予約後すぐに確定通知をお送りし、ホテルお迎えの時間帯（09:00〜10:00）と当日の流れをご案内します。',
      3: '前日夕方のメッセージで正確なホテルお迎え時刻を、当日朝のメッセージでリアルタイムの交通状況をお知らせします。',
    },
  },

  zh: {
    duration: '约9小时',
    heroDuration: '约9小时（09:00 酒店接客，约17:50 市区最后送达）',
    heroStopsLabel: '9站',
    seoFrom: '10小时釜山',
    seoTo: '9小时釜山',
    introFrom: '午餐后跨到',
    introTo: '午餐及海云台海水浴场短暂停留后跨到',
    introTailFrom: '08:30至约18:30。',
    introTailTo: '09:00至约18:20。',
    yongWhyFrom: '约10:00抵达，',
    yongWhyTo: '约10:20抵达，',
    whyItem0:
      '海东龙宫寺是釜山最上镜的寺庙，旅游大巴通常从11:00开始涌入。约10:20抵达，可以在无需排队的情况下走完108级石阶与海水观音观景点。',
    routePhases: [
      {
        phase: '海岸清晨',
        duration: '约3.5小时',
        description:
          '釜山市区酒店门到门接客（09:00–10:00），随后在旅游大巴涌入前游览海东龙宫寺，再前往青沙浦栈桥石玻璃观景台。',
      },
      {
        phase: '天空胶囊·午餐·海滩',
        duration: '约2小时',
        description:
          '从青沙浦到尾浦的粉彩天空胶囊（车票可选——不搭乘者可乘车或步行绿轨道栈道），在海云台附近用午餐，再到海云台海水浴场停留20分钟。',
      },
      {
        phase: '两座山坡村落',
        duration: '约2小时',
        description: '甘川文化村摄影环线（60分钟），随后是安静的Dakbatgol壁画村及免费的心愿阶梯单轨（30分钟）。',
      },
      {
        phase: '市区收尾',
        duration: '约1小时',
        description: '依次送达：南浦洞、釜山站、西面、海云台。',
      },
    ],
    staticQ6:
      '接客为釜山市区酒店门到门，时间在09:00至10:00之间——确切时刻于前一天傍晚通过WhatsApp确认。送达依次为：南浦洞约17:10、釜山站约17:30、西面约17:50、海云台约18:20。',
    practicalPickup: {
      title: '接送安排',
      content: [
        '接客为釜山市区酒店门到门——西面、南浦洞/釜山站、海云台/Marine City——时间在09:00至10:00之间。确切时刻于前一天傍晚通过WhatsApp确认。',
        '送达顺序依次为：南浦洞/札嘎其约17:10、釜山站约17:30、西面约17:50、海云台约18:20。',
        '实际游览时长取决于您的接客时间与下车地点——最短约7小时15分钟（10:00接客、南浦洞下车），最长约9小时15分钟（09:00接客、海云台下车）。',
      ],
    },
    pdNotes: [
      '接客为釜山市区酒店门到门，时间在09:00至10:00之间，确切时刻于前一天傍晚确认。送达依次经过市区四个地点（南浦洞 → 釜山站 → 西面 → 海云台，约17:10–18:20）。请在下午告知导游您希望的下车地点。',
    ],
    pdDeparture: {
      name: '您在釜山市区的酒店（门到门）',
      note: '釜山市区酒店门到门接客——西面、南浦洞/釜山站、海云台/Marine City。确切时刻于前一天傍晚确认。',
    },
    pickupStop: {
      name: '接客（您在釜山市区的酒店）',
      category: '交通 / 酒店接客',
      duration: '60分钟',
      description:
        '我们将于 **09:00 至 10:00** 之间到您位于釜山市区的酒店门到门接客。确切时刻会在前一天傍晚通过WhatsApp告知——届时司机已掌握当天的酒店名单，可以安排最有效率的路线。住在海云台一侧的客人通常最后接，因为车辆随后要向东北方向驶出市区、前往当天第一站所在的机张郡。\n\n服务范围覆盖市区主要酒店集中区：**西面**、**南浦洞/釜山站**、**海云台/Marine City**。若您的酒店位于该范围之外，导游会在预订确认时告知最近的集合地点。\n\n请在确认时刻前5分钟于大堂等候。从最后一位客人上车到海东龙宫寺约需30–40分钟，视路况而定。',
      highlights: [
        '釜山市区酒店门到门接客，09:00–10:00',
        '确切时刻于前一天傍晚通过WhatsApp确认',
        '小团专用车辆（最多约14人）',
        '上车时发放中韩双语行程卡',
      ],
      timeUsed: ['依次接送釜山市区各酒店（约40分钟）', '向东北前往机张郡（约20分钟）'],
      whyOnRoute:
        '酒店接客彻底省去了早晨的转乘——不用赶早班地铁，也不用找对出口。接客路线自西向东，车辆在海云台附近收尾，离开市区时已经朝着机张方向，也就是当天第一站。',
    },
    haeundaeBeach: {
      name: '海云台海水浴场',
      category: '海滩 / 免费',
      duration: '20分钟',
      description:
        '**海云台海水浴场（해운대해수욕장）**是韩国最负盛名的沙滩，西起冬柏岛、东至尾浦，弧线绵延约**1.5公里**，背后是Marine City的天际线。天空胶囊的终点尾浦正是这片海滩的东端，因此这一站不额外增加任何车程。\n\n20分钟是拍照与踩水的时间，而非游泳：走上沙滩、拍下天际线，然后回到车上。7、8月是最热闹的时候，遮阳伞一字排开；其余季节则宽阔安静、适合散步。免费，全天开放。',
      highlights: [
        '**韩国最著名的海滩**——约1.5公里沙滩，免费且24小时开放',
        '在水边取景的Marine City天际线',
        '西端的冬柏岛与Nurimaru APEC世峰楼',
        '就在天空胶囊终点尾浦——无需额外转乘',
      ],
      timeUsed: ['从尾浦步行至沙滩（约5分钟）', '海滩与天际线拍照（约10分钟）', '回到车上集合（约5分钟）'],
      whyOnRoute:
        '胶囊抵达的尾浦就是海滩东端，釜山最著名的景色步行五分钟即到，对当天行程毫无负担。这是一次刻意安排的短暂停留：在下午转往山坡村落之前，够您踩一踩沙、拍一张天际线。',
      visitBasics: {
        hours: '24小时开放',
        closed: '全年无休',
        walking: '平坦沙滩与铺装海滨步道',
        admission: '免费',
      },
    },
    dropoff: {
      description:
        '**送达由西向东依次进行**：**南浦洞/札嘎其（约17:10）**——想逛釜山最好的夜市小吃街和BIFF广场夜景的客人可在此下车；**釜山站（约17:30）**方便搭乘KTX；**西面（约17:50）**是市区酒店集中区；最后是**海云台（约18:20）**。请在下午与导游确定您的下车地点——坐到海云台车程最长，但可以在海边开始您的夜晚。',
      whyOnRoute:
        'Dakbatgol距南浦洞仅十分钟，因此最后一站结束后几乎立即开始送客——没有空耗的车程。自西向东的顺序，一次覆盖搭乘KTX的旅客（釜山站）、市区酒店（西面）与海滨酒店（海云台），无需折返。',
      timeUsed: ['南浦洞/札嘎其（约17:10）', '釜山站（约17:30）', '西面（约17:50）', '海云台（约18:20）'],
    },
    lunchDescFrom: '约60分钟午餐',
    lunchDescTo: '约45分钟午餐',
    booking: {
      0: '预订后即刻确认，并附上您的酒店接客时间段（09:00–10:00）与当天注意事项。',
      3: '前一天傍晚的消息确认您准确的酒店接客时刻，当天早上的消息通报实时路况。',
    },
  },

  'zh-TW': {
    duration: '約9小時',
    heroDuration: '約9小時（09:00 飯店接送，約17:50 市區最後送達）',
    heroStopsLabel: '9站',
    seoFrom: '10小時釜山',
    seoTo: '9小時釜山',
    introFrom: '午餐後跨到',
    introTo: '午餐及海雲台海水浴場短暫停留後跨到',
    introTailFrom: '08:30至約18:30。',
    introTailTo: '09:00至約18:20。',
    yongWhyFrom: '約10:00抵達，',
    yongWhyTo: '約10:20抵達，',
    whyItem0:
      '海東龍宮寺是釜山最上鏡的寺廟，旅遊巴士通常自11:00開始湧入。約10:20抵達，可在無須排隊的情況下走完108級石階與海水觀音觀景點。',
    routePhases: [
      {
        phase: '海岸早晨',
        duration: '約3.5小時',
        description:
          '釜山市區飯店門到門接送（09:00–10:00），接著在旅遊巴士湧入前造訪海東龍宮寺，再前往青沙浦Daritdol玻璃觀景台。',
      },
      {
        phase: '天空膠囊·午餐·海灘',
        duration: '約2小時',
        description:
          '搭乘由青沙浦到尾浦的粉彩天空膠囊（車票可選——未搭乘者可乘車或步行綠色鐵道棧道），在海雲台附近用午餐，再到海雲台海水浴場停留20分鐘。',
      },
      {
        phase: '兩座山坡村落',
        duration: '約2小時',
        description: '甘川文化村攝影環線（60分鐘），接著是安靜的Dakbatgol壁畫村與免費的心願階梯單軌（30分鐘）。',
      },
      {
        phase: '市區作結',
        duration: '約1小時',
        description: '依序送達：南浦洞、釜山站、西面、海雲台。',
      },
    ],
    staticQ6:
      '接送為釜山市區飯店門到門，時間在09:00至10:00之間——確切時刻於前一天傍晚透過WhatsApp確認。送達依序為：南浦洞約17:10、釜山站約17:30、西面約17:50、海雲台約18:20。',
    practicalPickup: {
      title: '接送安排',
      content: [
        '接送為釜山市區飯店門到門——西面、南浦洞／釜山站、海雲台／Marine City——時間在09:00至10:00之間。確切時刻於前一天傍晚透過WhatsApp確認。',
        '送達順序依序為：南浦洞／札嘎其約17:10、釜山站約17:30、西面約17:50、海雲台約18:20。',
        '實際行程時長取決於您的接送時間與下車地點——最短約7小時15分鐘（10:00接送、南浦洞下車），最長約9小時15分鐘（09:00接送、海雲台下車）。',
      ],
    },
    pdNotes: [
      '接送為釜山市區飯店門到門，時間在09:00至10:00之間，確切時刻於前一天傍晚確認。送達依序經過市區四個地點（南浦洞 → 釜山站 → 西面 → 海雲台，約17:10–18:20）。請於下午告知導遊您希望的下車地點。',
    ],
    pdDeparture: {
      name: '您在釜山市區的飯店（門到門）',
      note: '釜山市區飯店門到門接送——西面、南浦洞／釜山站、海雲台／Marine City。確切時刻於前一天傍晚確認。',
    },
    pickupStop: {
      name: '接送（您在釜山市區的飯店）',
      category: '交通 / 飯店接送',
      duration: '60 分鐘',
      description:
        '我們將於 **09:00 至 10:00** 之間至您位於釜山市區的飯店門到門接送。確切時刻會在前一天傍晚透過WhatsApp告知——屆時司機已掌握當日飯店名單，可安排最有效率的路線。住在海雲台一側的旅客通常最後接，因為車輛隨後要往東北方駛出市區，前往當日第一站所在的機張郡。\n\n服務範圍涵蓋市區主要飯店集中區：**西面**、**南浦洞／釜山站**、**海雲台／Marine City**。若您的飯店位於此範圍之外，導遊會在訂單確認時告知最近的集合地點。\n\n請於確認時刻前5分鐘在大廳等候。從最後一位旅客上車至海東龍宮寺約需30至40分鐘，視交通狀況而定。',
      highlights: [
        '釜山市區飯店門到門接送，09:00–10:00',
        '確切時刻於前一天傍晚透過WhatsApp確認',
        '小團專用車輛（最多約14人）',
        '上車時發放韓英雙語行程卡',
      ],
      timeUsed: ['依序接送釜山市區各飯店（約 40 分鐘）', '往東北前往機張郡（約 20 分鐘）'],
      whyOnRoute:
        '飯店接送徹底省去早晨的轉乘——不必趕早班地鐵，也不必找對出口。接送路線自西向東，車輛在海雲台附近收尾，離開市區時已朝著機張方向，也就是當日第一站。',
    },
    haeundaeBeach: {
      name: '海雲台海水浴場',
      category: '海灘 / 免費',
      duration: '20 分鐘',
      description:
        '**海雲台海水浴場（해운대해수욕장）**是韓國最負盛名的沙灘，西起冬柏島、東至尾浦，弧線綿延約**1.5公里**，背後是Marine City的天際線。天空膠囊的終點尾浦正是這片沙灘的東端，因此這一站不額外增加任何車程。\n\n20分鐘是拍照與踩水的時間，而非游泳：走上沙灘、拍下天際線，然後回到車上。7、8月最為熱鬧，遮陽傘一字排開；其餘季節則寬闊安靜、適合散步。免費，全天開放。',
      highlights: [
        '**韓國最著名的沙灘**——約1.5公里沙灘，免費且24小時開放',
        '在水邊取景的Marine City天際線',
        '西端的冬柏島與Nurimaru APEC世峰樓',
        '就在天空膠囊終點尾浦——無須額外轉乘',
      ],
      timeUsed: ['從尾浦步行至沙灘（約 5 分鐘）', '沙灘與天際線拍照（約 10 分鐘）', '回到車上集合（約 5 分鐘）'],
      whyOnRoute:
        '膠囊抵達的尾浦就是沙灘東端，釜山最著名的景色步行五分鐘即到，對當日行程毫無負擔。這是刻意安排的短暫停留：在下午轉往山坡村落之前，足夠您踩一踩沙、拍一張天際線。',
      visitBasics: {
        hours: '24小時開放',
        closed: '全年無休',
        walking: '平坦沙灘與鋪面海濱步道',
        admission: '免費',
      },
    },
    dropoff: {
      description:
        '**送達由西向東依序進行**：**南浦洞／札嘎其（約17:10）**——想逛釜山最好的夜市小吃街與BIFF廣場夜景的旅客可在此下車；**釜山站（約17:30）**方便銜接KTX；**西面（約17:50）**是市區飯店集中區；最後是**海雲台（約18:20）**。請於下午與導遊確定您的下車地點——坐到海雲台車程最長，但可以在海邊展開您的夜晚。',
      whyOnRoute:
        'Dakbatgol距南浦洞僅十分鐘，因此最後一站結束後幾乎立即開始送客——沒有空耗的車程。自西向東的順序，一次涵蓋搭乘KTX的旅客（釜山站）、市區飯店（西面）與海濱飯店（海雲台），無須折返。',
      timeUsed: ['南浦洞／札嘎其（約17:10）', '釜山站（約17:30）', '西面（約17:50）', '海雲台（約18:20）'],
    },
    lunchDescFrom: '約60分鐘午餐',
    lunchDescTo: '約45分鐘午餐',
    booking: {
      0: '訂購後即刻確認，並附上您的飯店接送時段（09:00–10:00）與當日注意事項。',
      3: '前一天傍晚的訊息確認您準確的飯店接送時刻，當日早晨的訊息通報即時路況。',
    },
  },

  es: {
    duration: '≈ 9 horas',
    heroDuration: '≈ 9 horas (recogida en el hotel a las 09:00, última entrega céntrica ≈ 17:50)',
    heroStopsLabel: '9 paradas',
    seoFrom: 'Tour de 10 horas',
    seoTo: 'Tour de 9 horas',
    introFrom: 'Tras el almuerzo, la jornada cruza',
    introTo: 'Tras el almuerzo y una breve parada en la playa de Haeundae, la jornada cruza',
    introTailFrom: 'de 08:30 a ≈ 18:30.',
    introTailTo: 'de 09:00 a ≈ 18:20.',
    yongWhyFrom: 'Llegar hacia las 10:00',
    yongWhyTo: 'Llegar hacia las 10:20',
    whyItem0:
      'Haedong Yonggungsa es el templo más fotografiado de Busan y la avalancha de autobuses turísticos empieza hacia las 11:00. Llegar sobre las 10:20 mantiene transitables el descenso de los 108 escalones y el mirador de Haesu Gwaneum, sin colas.',
    routePhases: [
      {
        phase: 'Mañana costera',
        duration: '≈ 3,5 horas',
        description:
          'Recogida puerta a puerta en hoteles del centro de Busan (09:00–10:00), después el Templo Haedong Yonggungsa antes de la avalancha de autobuses y, a continuación, la pasarela de cristal Daritdol de Cheongsapo.',
      },
      {
        phase: 'Sky Capsule, almuerzo y playa',
        duration: '≈ 2 horas',
        description:
          'El Sky Capsule pastel de Cheongsapo a Mipo (billete opcional: quien no lo tome va en el autobús o pasea por el Green Railway), almuerzo cerca de Haeundae y veinte minutos en la propia playa de Haeundae.',
      },
      {
        phase: 'Dos pueblos en ladera',
        duration: '≈ 2 horas',
        description:
          'El circuito fotográfico del Pueblo Cultural de Gamcheon (60 min) y luego el tranquilo pueblo mural de Dakbatgol con su monorraíl gratuito de las "escaleras de los deseos" (30 min).',
      },
      {
        phase: 'Cierre céntrico',
        duration: '≈ 1 hora',
        description: 'Entregas en orden: Nampo-dong, Estación de Busan, Seomyeon y Haeundae.',
      },
    ],
    staticQ6:
      'La recogida es puerta a puerta en tu hotel del centro de Busan, entre las 09:00 y las 10:00; la hora exacta se confirma por WhatsApp la tarde anterior. Las entregas siguen este orden: Nampo-dong ≈17:10, Estación de Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
    practicalPickup: {
      title: 'Recogida y entrega',
      content: [
        'La recogida es puerta a puerta en tu hotel del centro de Busan —Seomyeon, Nampo-dong / Estación de Busan, Haeundae / Marine City— entre las 09:00 y las 10:00. La hora exacta se confirma por WhatsApp la tarde anterior.',
        'Entregas en orden: Nampo-dong/Jagalchi ≈17:10, Estación de Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
        'La duración efectiva del tour depende de tu hora de recogida y de dónde te bajes: unas 7 h 15 min en el caso más corto (recogida a las 10:00, bajada en Nampo-dong) y unas 9 h 15 min en el más largo (recogida a las 09:00, bajada en Haeundae).',
      ],
    },
    pdNotes: [
      'La recogida es puerta a puerta en tu hotel del centro de Busan entre las 09:00 y las 10:00; la hora exacta se confirma la tarde anterior. Las entregas se hacen en cuatro puntos céntricos por orden (Nampo-dong → Estación de Busan → Seomyeon → Haeundae, ≈ 17:10–18:20): indica al guía por la tarde cuál prefieres.',
    ],
    pdDeparture: {
      name: 'Tu hotel en el centro de Busan (puerta a puerta)',
      note: 'Recogida puerta a puerta en hoteles del centro de Busan: Seomyeon, Nampo-dong / Estación de Busan, Haeundae / Marine City. La hora exacta se confirma la tarde anterior.',
    },
    pickupStop: {
      name: 'Recogida (tu hotel en el centro de Busan)',
      category: 'Tránsito / Recogida en hotel',
      duration: '60 min',
      description:
        'Recogida puerta a puerta en tu hotel del centro de Busan, entre las **09:00 y las 10:00**. La hora exacta se confirma por WhatsApp la tarde anterior, cuando el conductor ya tiene la lista de hoteles del día y puede ordenar la ruta con eficacia: quienes se alojan en la zona de Haeundae suelen ser los últimos, porque el autobús sale de la ciudad hacia el noreste, rumbo a Gijang-gun y la primera parada.\n\nEl área cubierta abarca los principales núcleos hoteleros del centro: **Seomyeon**, **Nampo-dong / Estación de Busan** y **Haeundae / Marine City**. Si tu hotel queda fuera de esa zona, el guía te indicará el punto de encuentro más cercano al confirmar la reserva.\n\nEspera en el vestíbulo 5 minutos antes de tu hora confirmada. El trayecto desde la última recogida hasta Haedong Yonggungsa es de unos 30-40 minutos según el tráfico.',
      highlights: [
        'Recogida puerta a puerta en hoteles del centro de Busan, 09:00–10:00',
        'Hora exacta confirmada por WhatsApp la tarde anterior',
        'Autobús de grupo reducido (máx. ~14 pax)',
        'Tarjeta de itinerario impresa en coreano e inglés al subir',
      ],
      timeUsed: [
        'Recogidas en hoteles del centro de Busan (~40 min)',
        'Trayecto hacia el noreste, a Gijang-gun (~20 min)',
      ],
      whyOnRoute:
        'La recogida en el hotel elimina por completo el traslado matutino: nada de metro a primera hora ni de buscar la salida correcta. La ruta va de oeste a este, así que el autobús termina cerca de Haeundae y deja la ciudad ya orientado hacia Gijang y la primera parada del día.',
    },
    haeundaeBeach: {
      name: 'Playa de Haeundae',
      category: 'Playa / Gratis',
      duration: '20 min',
      description:
        'La **playa de Haeundae (해운대해수욕장)** es el arenal más conocido de Corea: unos **1,5 km** de costa que se curvan entre la isla de Dongbaekseom, al oeste, y Mipo, al este, con el perfil de Marine City al fondo. El Sky Capsule te deja en Mipo, que no es otra cosa que el extremo oriental de esta playa, así que la parada no añade ni un minuto de carretera.\n\nVeinte minutos dan para fotos y para mojarse los pies, no para bañarse: sal a la arena, fotografía el skyline y vuelve al autobús. En julio y agosto la playa está en su momento más concurrido, con las hileras de sombrillas montadas; el resto del año es ancha, tranquila y muy caminable. Gratis y abierta a todas horas.',
      highlights: [
        '**La playa más famosa de Corea**: ~1,5 km de arena, GRATIS y abierta 24 h',
        'El skyline de Marine City desde la orilla',
        'La isla de Dongbaekseom y la Nurimaru APEC House en el extremo oeste',
        'Justo en Mipo, donde termina el Sky Capsule: sin traslado adicional',
      ],
      timeUsed: [
        'Bajada a la arena desde Mipo (~5 min)',
        'Fotos de la playa y el skyline (~10 min)',
        'Reagrupación en el autobús (~5 min)',
      ],
      whyOnRoute:
        'El capsule llega a Mipo, que es el extremo este de la playa, así que la vista más famosa de Busan queda a cinco minutos a pie y no cuesta nada al día. Es una parada corta a propósito: lo justo para pisar la arena y fotografiar el skyline antes de que la tarde vire hacia los pueblos de ladera.',
      visitBasics: {
        hours: 'Abierta 24 horas',
        closed: 'Nunca',
        walking: 'Arena llana y paseo marítimo pavimentado',
        admission: 'GRATIS',
      },
    },
    dropoff: {
      description:
        '**Las entregas van en secuencia del oeste de vuelta al este**: **Nampo-dong / zona de Jagalchi (~17:10)** — bájate aquí para las mejores calles de comida nocturna de Busan y el ambiente de BIFF Square; **Estación de Busan (~17:30)** para conexiones KTX; **Seomyeon (~17:50)** para el grupo de hoteles del centro; y **Haeundae (~18:20)** al final. Elige tu punto de bajada con el guía durante la tarde: seguir hasta Haeundae es el trayecto más largo, pero te deja junto a la playa para la noche.',
      whyOnRoute:
        'Dakbatgol está a diez minutos de Nampo-dong, así que la secuencia de bajadas empieza casi inmediatamente después de la última parada, sin tiempo muerto. El orden oeste-este cubre a quienes viajan en KTX (Estación de Busan), los hoteles del centro (Seomyeon) y los de playa (Haeundae) sin dar rodeos.',
      timeUsed: [
        'Nampo-dong / zona de Jagalchi (~17:10)',
        'Estación de Busan (~17:30)',
        'Seomyeon (~17:50)',
        'Haeundae (~18:20)',
      ],
    },
    lunchDescFrom: 'Unos 60 minutos de almuerzo',
    lunchDescTo: 'Unos 45 minutos de almuerzo',
    booking: {
      0: 'Confirmación inmediata de la reserva, con tu franja de recogida en el hotel (09:00–10:00) y qué esperar.',
      3: 'Un mensaje la tarde anterior confirma la hora exacta de recogida en tu hotel; otro por la mañana cubre el tráfico en tiempo real.',
    },
  },

  de: {
    duration: '≈ 9 Stunden',
    heroDuration: '≈ 9 Stunden (09:00 Abholung am Hotel, ≈ 17:50 letzte Rückgabe im Zentrum)',
    heroStopsLabel: '9 Stopps',
    seoFrom: '10-stündige',
    seoTo: '9-stündige',
    introFrom: 'Nach dem Mittagessen wechselt der Tag',
    introTo: 'Nach dem Mittagessen und einem kurzen Stopp am Haeundae-Strand wechselt der Tag',
    introTailFrom: 'von 08:30 bis etwa 18:30.',
    introTailTo: 'von 09:00 bis etwa 18:20.',
    yongWhyFrom: 'Die Ankunft um 10:00',
    yongWhyTo: 'Die Ankunft um 10:20',
    whyItem0:
      'Haedong Yonggungsa ist Busans meistfotografierter Tempel, und der Ansturm der Reisebusse setzt gegen 11:00 ein. Eine Ankunft gegen 10:20 hält den Abstieg über die 108 Stufen und den Aussichtspunkt der Haesu-Gwaneum-Statue begehbar, ganz ohne Schlange.',
    routePhases: [
      {
        phase: 'Küstenmorgen',
        duration: '≈ 3,5 Stunden',
        description:
          'Abholung von Tür zu Tür an Hotels im Zentrum Busans (09:00–10:00), dann der Haedong-Yonggungsa-Tempel vor dem Reisebus-Ansturm und weiter zum gläsernen Daritdol-Skywalk in Cheongsapo.',
      },
      {
        phase: 'Sky Capsule, Mittagessen & Strand',
        duration: '≈ 2 Stunden',
        description:
          'Die pastellfarbene Sky Capsule von Cheongsapo nach Mipo (Ticket optional — wer nicht mitfährt, nimmt den Bus oder läuft den Green-Railway-Boardwalk), Mittagessen nahe Haeundae und anschließend zwanzig Minuten am Haeundae-Strand selbst.',
      },
      {
        phase: 'Zwei Hangdörfer',
        duration: '≈ 2 Stunden',
        description:
          'Die Fotorunde durch das Kulturdorf Gamcheon (60 Min.) und danach das stille Wandbilddorf Dakbatgol mit seiner kostenlosen Monorail an der „Wunschtreppe" (30 Min.).',
      },
      {
        phase: 'Abschluss im Zentrum',
        duration: '≈ 1 Stunde',
        description: 'Rückgaben der Reihe nach: Nampo-dong, Bahnhof Busan, Seomyeon, dann Haeundae.',
      },
    ],
    staticQ6:
      'Die Abholung erfolgt von Tür zu Tür an Ihrem Hotel im Zentrum Busans, zwischen 09:00 und 10:00 — die genaue Zeit wird am Vorabend per WhatsApp bestätigt. Die Rückgaben erfolgen der Reihe nach: Nampo-dong ≈17:10, Bahnhof Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
    practicalPickup: {
      title: 'Abholung & Rückgabe',
      content: [
        'Die Abholung erfolgt von Tür zu Tür an Ihrem Hotel im Zentrum Busans — Seomyeon, Nampo-dong / Bahnhof Busan, Haeundae / Marine City — zwischen 09:00 und 10:00. Die genaue Zeit wird am Vorabend per WhatsApp bestätigt.',
        'Rückgaben der Reihe nach: Nampo-dong/Jagalchi ≈17:10, Bahnhof Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
        'Ihre effektive Tourdauer hängt von Abholzeit und Ausstiegspunkt ab — im kürzesten Fall etwa 7 Std. 15 Min. (Abholung 10:00, Ausstieg Nampo-dong), im längsten etwa 9 Std. 15 Min. (Abholung 09:00, Ausstieg Haeundae).',
      ],
    },
    pdNotes: [
      'Die Abholung erfolgt von Tür zu Tür an Ihrem Hotel im Zentrum Busans zwischen 09:00 und 10:00; die genaue Zeit wird am Vorabend bestätigt. Die Rückgaben erfolgen an vier zentralen Punkten der Reihe nach (Nampo-dong → Bahnhof Busan → Seomyeon → Haeundae, ≈ 17:10–18:20) — sagen Sie der Reiseleitung im Laufe des Nachmittags, welchen Sie wünschen.',
    ],
    pdDeparture: {
      name: 'Ihr Hotel im Zentrum von Busan (von Tür zu Tür)',
      note: 'Abholung von Tür zu Tür an Hotels im Zentrum Busans — Seomyeon, Nampo-dong / Bahnhof Busan, Haeundae / Marine City. Die genaue Zeit wird am Vorabend bestätigt.',
    },
    pickupStop: {
      name: 'Abholung (Ihr Hotel im Zentrum von Busan)',
      category: 'Transfer / Hotelabholung',
      duration: '60 Min.',
      description:
        'Abholung von Tür zu Tür an Ihrem Hotel im Zentrum Busans, zwischen **09:00 und 10:00**. Die genaue Zeit wird am Vorabend per WhatsApp bestätigt, sobald der Fahrer die Hotelliste des Tages hat und die Runde effizient ordnen kann — Gäste auf der Haeundae-Seite werden meist zuletzt abgeholt, weil der Bus die Stadt nordostwärts Richtung Gijang-gun zum ersten Stopp verlässt.\n\nDas Einzugsgebiet umfasst die zentralen Hotelviertel: **Seomyeon**, **Nampo-dong / Bahnhof Busan** und **Haeundae / Marine City**. Liegt Ihr Hotel außerhalb, nennt Ihnen die Reiseleitung bei der Buchungsbestätigung den nächstgelegenen Treffpunkt.\n\nBitte warten Sie 5 Minuten vor Ihrer bestätigten Zeit in der Lobby. Die Fahrt von der letzten Abholung bis Haedong Yonggungsa dauert je nach Verkehr etwa 30–40 Minuten.',
      highlights: [
        'Abholung von Tür zu Tür an Hotels im Zentrum Busans, 09:00–10:00',
        'Genaue Zeit am Vorabend per WhatsApp bestätigt',
        'Kleingruppenbus (max. ~14 Personen)',
        'Gedruckte Programmkarte auf Koreanisch und Englisch beim Einsteigen',
      ],
      timeUsed: [
        'Abholungen an Hotels im Zentrum Busans (~40 Min.)',
        'Fahrt nordostwärts nach Gijang-gun (~20 Min.)',
      ],
      whyOnRoute:
        'Die Hotelabholung erspart den morgendlichen Transfer vollständig — keine frühe U-Bahn-Fahrt, keine Suche nach dem richtigen Ausgang. Die Runde verläuft von West nach Ost, sodass der Bus in Haeundae endet und die Stadt bereits Richtung Gijang und ersten Stopp verlässt.',
    },
    haeundaeBeach: {
      name: 'Haeundae-Strand',
      category: 'Strand / Kostenlos',
      duration: '20 Min.',
      description:
        'Der **Haeundae-Strand (해운대해수욕장)** ist Koreas bekanntester Sandstrand — rund **1,5 km** Küste, die sich zwischen der Insel Dongbaekseom im Westen und Mipo im Osten spannt, im Rücken die Skyline von Marine City. Die Sky Capsule setzt Sie in Mipo ab, also schlicht am Ostende dieses Strands — der Stopp kostet dem Tag keine zusätzliche Fahrzeit.\n\nZwanzig Minuten sind ein Foto- und Fußbadstopp, kein Badeaufenthalt: hinaus auf den Sand, die Skyline fotografieren, zurück zum Bus. Im Juli und August ist der Strand am vollsten und die Schirmreihen stehen; den Rest des Jahres ist er weit, ruhig und gut begehbar. Kostenlos und rund um die Uhr geöffnet.',
      highlights: [
        '**Koreas berühmtester Strand** — ~1,5 km Sand, KOSTENLOS und 24 Std. geöffnet',
        'Skyline von Marine City direkt von der Wasserlinie',
        'Insel Dongbaekseom und Nurimaru APEC House am Westende',
        'Direkt in Mipo, wo die Sky Capsule endet — kein zusätzlicher Transfer',
      ],
      timeUsed: [
        'Von Mipo hinaus auf den Sand (~5 Min.)',
        'Fotos von Strand und Skyline (~10 Min.)',
        'Sammeln am Bus (~5 Min.)',
      ],
      whyOnRoute:
        'Die Capsule endet in Mipo, dem Ostende des Strands — Busans berühmtester Blick liegt also fünf Gehminuten entfernt und kostet den Tag nichts. Der Stopp ist bewusst kurz: gerade genug, um im Sand zu stehen und die Skyline zu fotografieren, bevor der Nachmittag zu den Hangdörfern wechselt.',
      visitBasics: {
        hours: 'Rund um die Uhr geöffnet',
        closed: 'Nie',
        walking: 'Ebener Sand und befestigte Promenade',
        admission: 'KOSTENLOS',
      },
    },
    dropoff: {
      description:
        '**Die Rückgaben verlaufen der Reihe nach von West nach Ost**: **Nampo-dong / Jagalchi (~17:10)** — hier steigen Sie für Busans beste Abend-Esstraßen und das nächtliche BIFF Square aus; **Bahnhof Busan (~17:30)** für KTX-Anschlüsse; **Seomyeon (~17:50)** für die zentralen Hotels; und zuletzt **Haeundae (~18:20)**. Stimmen Sie Ihren Ausstiegspunkt im Laufe des Nachmittags mit der Reiseleitung ab — bis Haeundae mitzufahren ist die längste Strecke, setzt Sie aber für den Abend direkt am Strand ab.',
      whyOnRoute:
        'Dakbatgol liegt zehn Minuten von Nampo-dong, sodass die Rückgabefolge fast unmittelbar nach dem letzten Stopp beginnt — keine Leerfahrt. Die West-Ost-Reihenfolge deckt KTX-Reisende (Bahnhof Busan), zentrale Hotels (Seomyeon) und Strandhotels (Haeundae) ohne Umwege ab.',
      timeUsed: [
        'Nampo-dong / Jagalchi (~17:10)',
        'Bahnhof Busan (~17:30)',
        'Seomyeon (~17:50)',
        'Haeundae (~18:20)',
      ],
    },
    lunchDescFrom: 'Etwa 60 Minuten Mittagspause',
    lunchDescTo: 'Etwa 45 Minuten Mittagspause',
    booking: {
      0: 'Sofortige Buchungsbestätigung mit Ihrem Abholfenster am Hotel (09:00–10:00) und allem, was Sie erwartet.',
      3: 'Eine Nachricht am Vorabend bestätigt Ihre genaue Abholzeit am Hotel; eine Nachricht am Morgen deckt die aktuelle Verkehrslage ab.',
    },
  },

  fr: {
    duration: '≈ 9 heures',
    heroDuration: '≈ 9 heures (prise en charge à l\'hôtel à 09:00, dernière dépose au centre ≈ 17:50)',
    heroStopsLabel: '9 étapes',
    seoFrom: 'Excursion de 10 h',
    seoTo: 'Excursion de 9 h',
    introFrom: 'Après le déjeuner, la journée bascule',
    introTo: 'Après le déjeuner et un court arrêt sur la plage de Haeundae, la journée bascule',
    introTailFrom: 'de 08:30 à environ 18:30.',
    introTailTo: 'de 09:00 à environ 18:20.',
    yongWhyFrom: 'L\'arrivée à 10:00',
    yongWhyTo: 'L\'arrivée à 10:20',
    whyItem0:
      "Haedong Yonggungsa est le temple le plus photographié de Busan et l'afflux des autocars commence vers 11:00. Arriver vers 10:20 laisse la descente des 108 marches et le point de vue de Haesu Gwaneum praticables, sans file d'attente.",
    routePhases: [
      {
        phase: 'Matinée côtière',
        duration: '≈ 3,5 heures',
        description:
          "Prise en charge en porte-à-porte dans les hôtels du centre de Busan (09:00–10:00), puis le temple Haedong Yonggungsa avant l'afflux des autocars, et enfin la passerelle de verre Daritdol à Cheongsapo.",
      },
      {
        phase: 'Sky Capsule, déjeuner et plage',
        duration: '≈ 2 heures',
        description:
          "Le Sky Capsule pastel de Cheongsapo à Mipo (billet en option — sans billet, on prend l'autocar ou l'on marche sur le Green Railway), déjeuner près de Haeundae, puis vingt minutes sur la plage de Haeundae elle-même.",
      },
      {
        phase: 'Deux villages à flanc de colline',
        duration: '≈ 2 heures',
        description:
          "La boucle photo du village culturel de Gamcheon (60 min), puis le paisible village de fresques de Dakbatgol et son monorail gratuit des « escaliers des vœux » (30 min).",
      },
      {
        phase: 'Clôture au centre',
        duration: '≈ 1 heure',
        description: 'Déposes dans l\'ordre : Nampo-dong, gare de Busan, Seomyeon, puis Haeundae.',
      },
    ],
    staticQ6:
      "La prise en charge se fait en porte-à-porte à votre hôtel du centre de Busan, entre 09:00 et 10:00 — l'heure exacte est confirmée par WhatsApp la veille au soir. Les déposes suivent cet ordre : Nampo-dong ≈17:10, gare de Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.",
    practicalPickup: {
      title: 'Prise en charge & dépose',
      content: [
        "La prise en charge se fait en porte-à-porte à votre hôtel du centre de Busan — Seomyeon, Nampo-dong / gare de Busan, Haeundae / Marine City — entre 09:00 et 10:00. L'heure exacte est confirmée par WhatsApp la veille au soir.",
        'Déposes dans l\'ordre : Nampo-dong/Jagalchi ≈17:10, gare de Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
        "La durée effective du circuit dépend de votre heure de prise en charge et de votre point de dépose — environ 7 h 15 au plus court (prise en charge à 10:00, dépose à Nampo-dong) et environ 9 h 15 au plus long (prise en charge à 09:00, dépose à Haeundae).",
      ],
    },
    pdNotes: [
      "La prise en charge se fait en porte-à-porte à votre hôtel du centre de Busan entre 09:00 et 10:00 ; l'heure exacte est confirmée la veille au soir. Les déposes se font à quatre points centraux dans l'ordre (Nampo-dong → gare de Busan → Seomyeon → Haeundae, ≈ 17:10–18:20) — indiquez au guide dans l'après-midi celui que vous souhaitez.",
    ],
    pdDeparture: {
      name: 'Votre hôtel dans le centre de Busan (porte-à-porte)',
      note: "Prise en charge en porte-à-porte dans les hôtels du centre de Busan — Seomyeon, Nampo-dong / gare de Busan, Haeundae / Marine City. L'heure exacte est confirmée la veille au soir.",
    },
    pickupStop: {
      name: 'Prise en charge (votre hôtel dans le centre de Busan)',
      category: 'Transfert / Prise en charge à l\'hôtel',
      duration: '60 min',
      description:
        "Prise en charge en porte-à-porte à votre hôtel du centre de Busan, entre **09:00 et 10:00**. L'heure exacte est confirmée par WhatsApp la veille au soir, une fois que le chauffeur dispose de la liste des hôtels du jour et peut organiser la tournée efficacement — les voyageurs logés côté Haeundae sont généralement pris en dernier, car l'autocar quitte la ville vers le nord-est, en direction de Gijang-gun et de la première étape.\n\nLa zone couverte comprend les principaux pôles hôteliers du centre : **Seomyeon**, **Nampo-dong / gare de Busan** et **Haeundae / Marine City**. Si votre hôtel se situe en dehors, le guide vous indiquera le point de rendez-vous le plus proche à la confirmation de la réservation.\n\nMerci d'attendre dans le hall 5 minutes avant l'heure confirmée. Le trajet de la dernière prise en charge jusqu'à Haedong Yonggungsa dure environ 30 à 40 minutes selon la circulation.",
      highlights: [
        'Prise en charge en porte-à-porte dans les hôtels du centre de Busan, 09:00–10:00',
        'Heure exacte confirmée par WhatsApp la veille au soir',
        'Autocar en petit groupe (max. ~14 pers.)',
        'Carte d\'itinéraire imprimée en coréen et anglais remise à la montée',
      ],
      timeUsed: [
        'Prises en charge dans les hôtels du centre de Busan (~40 min)',
        'Route vers le nord-est jusqu\'à Gijang-gun (~20 min)',
      ],
      whyOnRoute:
        "La prise en charge à l'hôtel supprime complètement le transfert du matin — pas de métro à l'aube, pas de sortie de station à chercher. La tournée va d'ouest en est, si bien que l'autocar termine près de Haeundae et quitte la ville déjà orienté vers Gijang et la première étape de la journée.",
    },
    haeundaeBeach: {
      name: 'Plage de Haeundae',
      category: 'Plage / Gratuit',
      duration: '20 min',
      description:
        "La **plage de Haeundae (해운대해수욕장)** est l'étendue de sable la plus connue de Corée : environ **1,5 km** de littoral en courbe entre l'île de Dongbaekseom à l'ouest et Mipo à l'est, avec la skyline de Marine City en toile de fond. Le Sky Capsule vous dépose à Mipo, qui n'est rien d'autre que l'extrémité est de cette plage : l'arrêt ne coûte aucune route supplémentaire à la journée.\n\nVingt minutes, c'est un arrêt photo et pieds dans l'eau, pas une baignade : on marche sur le sable, on photographie la skyline, on rejoint l'autocar. En juillet et août la plage est à son plus fréquenté, rangées de parasols dressées ; le reste de l'année elle est large, calme et très praticable. Gratuite et ouverte à toute heure.",
      highlights: [
        '**La plage la plus célèbre de Corée** — ~1,5 km de sable, GRATUITE et ouverte 24h/24',
        'La skyline de Marine City depuis le bord de l\'eau',
        'L\'île de Dongbaekseom et la Nurimaru APEC House à l\'extrémité ouest',
        'Directement à Mipo, terminus du Sky Capsule — aucun transfert supplémentaire',
      ],
      timeUsed: [
        'Descente sur le sable depuis Mipo (~5 min)',
        'Photos de la plage et de la skyline (~10 min)',
        'Regroupement à l\'autocar (~5 min)',
      ],
      whyOnRoute:
        "Le capsule arrive à Mipo, l'extrémité est de la plage : la vue la plus célèbre de Busan est donc à cinq minutes à pied et ne coûte rien à la journée. L'arrêt est volontairement court — juste de quoi poser le pied sur le sable et photographier la skyline avant que l'après-midi ne bascule vers les villages à flanc de colline.",
      visitBasics: {
        hours: 'Ouverte 24h/24',
        closed: 'Jamais',
        walking: 'Sable plat et promenade goudronnée',
        admission: 'GRATUIT',
      },
    },
    dropoff: {
      description:
        "**Les déposes se succèdent d'ouest en est** : **Nampo-dong / Jagalchi (~17:10)** — descendez ici pour les meilleures rues gourmandes du soir et l'ambiance nocturne de BIFF Square ; **gare de Busan (~17:30)** pour les correspondances KTX ; **Seomyeon (~17:50)** pour les hôtels du centre ; et **Haeundae (~18:20)** en dernier. Choisissez votre point de dépose avec le guide dans l'après-midi — rester jusqu'à Haeundae est le trajet le plus long, mais vous dépose au bord de la plage pour la soirée.",
      whyOnRoute:
        "Dakbatgol se trouve à dix minutes de Nampo-dong : la série de déposes commence donc presque aussitôt après la dernière étape, sans trajet à vide. L'ordre ouest-est couvre les voyageurs en KTX (gare de Busan), les hôtels du centre (Seomyeon) et ceux de la plage (Haeundae) sans détour.",
      timeUsed: [
        'Nampo-dong / Jagalchi (~17:10)',
        'Gare de Busan (~17:30)',
        'Seomyeon (~17:50)',
        'Haeundae (~18:20)',
      ],
    },
    lunchDescFrom: 'Environ 60 minutes de déjeuner',
    lunchDescTo: 'Environ 45 minutes de déjeuner',
    booking: {
      0: "Confirmation immédiate de la réservation, avec votre créneau de prise en charge à l'hôtel (09:00–10:00) et le déroulé de la journée.",
      3: "Un message la veille au soir confirme l'heure exacte de prise en charge à votre hôtel ; un message le matin couvre la circulation en temps réel.",
    },
  },

  it: {
    duration: '≈ 9 ore',
    heroDuration: '≈ 9 ore (prelievo in hotel alle 09:00, ultimo rientro in centro ≈ 17:50)',
    heroStopsLabel: '9 tappe',
    seoFrom: 'di 10 ore',
    seoTo: 'di 9 ore',
    introFrom: 'Dopo pranzo la giornata attraversa',
    introTo: 'Dopo pranzo e una breve sosta sulla spiaggia di Haeundae la giornata attraversa',
    introTailFrom: 'dalle 08:30 alle 18:30 circa.',
    introTailTo: 'dalle 09:00 alle 18:20 circa.',
    yongWhyFrom: 'L\'arrivo alle 10:00',
    yongWhyTo: 'L\'arrivo alle 10:20',
    whyItem0:
      "Haedong Yonggungsa è il tempio più fotografato di Busan e l'ondata dei bus turistici comincia verso le 11:00. Arrivare intorno alle 10:20 mantiene percorribili la discesa dei 108 gradini e il punto panoramico di Haesu Gwaneum, senza code.",
    routePhases: [
      {
        phase: 'Mattina sulla costa',
        duration: '≈ 3,5 ore',
        description:
          "Prelievo porta a porta negli hotel del centro di Busan (09:00–10:00), poi il tempio Haedong Yonggungsa prima dell'ondata dei bus turistici e quindi la passerella di vetro Daritdol a Cheongsapo.",
      },
      {
        phase: 'Sky Capsule, pranzo e spiaggia',
        duration: '≈ 2 ore',
        description:
          'Lo Sky Capsule pastello da Cheongsapo a Mipo (biglietto opzionale — chi non sale prende il pullman o percorre la passerella Green Railway), pranzo vicino a Haeundae e poi venti minuti sulla spiaggia di Haeundae stessa.',
      },
      {
        phase: 'Due villaggi in collina',
        duration: '≈ 2 ore',
        description:
          'Il giro fotografico del villaggio culturale di Gamcheon (60 min), poi il tranquillo villaggio dei murales di Dakbatgol con la monorotaia gratuita della "scala dei desideri" (30 min).',
      },
      {
        phase: 'Chiusura in centro',
        duration: '≈ 1 ora',
        description: 'Discese in sequenza: Nampo-dong, stazione di Busan, Seomyeon, poi Haeundae.',
      },
    ],
    staticQ6:
      "Il prelievo è porta a porta presso il vostro hotel nel centro di Busan, tra le 09:00 e le 10:00 — l'orario esatto viene confermato via WhatsApp la sera prima. Le discese seguono questo ordine: Nampo-dong ≈17:10, stazione di Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.",
    practicalPickup: {
      title: 'Prelievo e rientro',
      content: [
        "Il prelievo è porta a porta presso il vostro hotel nel centro di Busan — Seomyeon, Nampo-dong / stazione di Busan, Haeundae / Marine City — tra le 09:00 e le 10:00. L'orario esatto viene confermato via WhatsApp la sera prima.",
        'Discese in sequenza: Nampo-dong/Jagalchi ≈17:10, stazione di Busan ≈17:30, Seomyeon ≈17:50, Haeundae ≈18:20.',
        "La durata effettiva del tour dipende dall'orario di prelievo e dal punto di discesa: circa 7 ore e 15 minuti nel caso più breve (prelievo alle 10:00, discesa a Nampo-dong) e circa 9 ore e 15 minuti nel più lungo (prelievo alle 09:00, discesa a Haeundae).",
      ],
    },
    pdNotes: [
      "Il prelievo è porta a porta presso il vostro hotel nel centro di Busan tra le 09:00 e le 10:00; l'orario esatto viene confermato la sera prima. Le discese avvengono in quattro punti centrali in sequenza (Nampo-dong → stazione di Busan → Seomyeon → Haeundae, ≈ 17:10–18:20): comunicate alla guida nel pomeriggio quale preferite.",
    ],
    pdDeparture: {
      name: 'Il vostro hotel nel centro di Busan (porta a porta)',
      note: "Prelievo porta a porta negli hotel del centro di Busan — Seomyeon, Nampo-dong / stazione di Busan, Haeundae / Marine City. L'orario esatto viene confermato la sera prima.",
    },
    pickupStop: {
      name: 'Prelievo (il vostro hotel nel centro di Busan)',
      category: 'Trasferimento / Prelievo in hotel',
      duration: '60 min',
      description:
        "Prelievo porta a porta presso il vostro hotel nel centro di Busan, tra le **09:00 e le 10:00**. L'orario esatto viene confermato via WhatsApp la sera prima, quando l'autista ha l'elenco degli hotel della giornata e può ordinare il giro in modo efficiente — chi alloggia sul lato Haeundae viene di norma prelevato per ultimo, perché il pullman lascia la città verso nord-est, in direzione di Gijang-gun e della prima tappa.\n\nL'area servita comprende i principali poli alberghieri del centro: **Seomyeon**, **Nampo-dong / stazione di Busan** e **Haeundae / Marine City**. Se il vostro hotel si trova fuori da quest'area, la guida indicherà il punto d'incontro più vicino alla conferma della prenotazione.\n\nVi preghiamo di attendere nella hall 5 minuti prima dell'orario confermato. Il trasferimento dall'ultimo prelievo a Haedong Yonggungsa richiede circa 30-40 minuti a seconda del traffico.",
      highlights: [
        'Prelievo porta a porta negli hotel del centro di Busan, 09:00–10:00',
        'Orario esatto confermato via WhatsApp la sera prima',
        'Pullman in piccolo gruppo (max ~14 pax)',
        'Scheda itinerario stampata in coreano e inglese alla partenza',
      ],
      timeUsed: [
        'Prelievi negli hotel del centro di Busan (~40 min)',
        'Trasferimento verso nord-est a Gijang-gun (~20 min)',
      ],
      whyOnRoute:
        "Il prelievo in hotel elimina del tutto il trasferimento mattutino: niente metropolitana all'alba, niente uscite di stazione da cercare. Il giro procede da ovest a est, così il pullman termina vicino a Haeundae e lascia la città già orientato verso Gijang e la prima tappa della giornata.",
    },
    haeundaeBeach: {
      name: 'Spiaggia di Haeundae',
      category: 'Spiaggia / Gratis',
      duration: '20 min',
      description:
        "La **spiaggia di Haeundae (해운대해수욕장)** è il tratto di sabbia più noto della Corea: circa **1,5 km** di costa che si incurva tra l'isola di Dongbaekseom a ovest e Mipo a est, con lo skyline di Marine City alle spalle. Lo Sky Capsule vi lascia a Mipo, che non è altro che l'estremità orientale di questa spiaggia: la sosta non costa alla giornata un minuto di strada in più.\n\nVenti minuti sono una sosta da foto e piedi nell'acqua, non da bagno: si cammina sulla sabbia, si fotografa lo skyline e si torna al pullman. A luglio e agosto la spiaggia è al massimo dell'affollamento, con le file di ombrelloni montate; nel resto dell'anno è ampia, tranquilla e molto percorribile. Gratuita e aperta a ogni ora.",
      highlights: [
        '**La spiaggia più famosa della Corea** — ~1,5 km di sabbia, GRATUITA e aperta 24 ore',
        'Lo skyline di Marine City dal bagnasciuga',
        "L'isola di Dongbaekseom e la Nurimaru APEC House all'estremità ovest",
        'Proprio a Mipo, dove finisce lo Sky Capsule — nessun trasferimento aggiuntivo',
      ],
      timeUsed: [
        'Discesa sulla sabbia da Mipo (~5 min)',
        'Foto della spiaggia e dello skyline (~10 min)',
        'Ritrovo al pullman (~5 min)',
      ],
      whyOnRoute:
        "Il capsule arriva a Mipo, che è l'estremità est della spiaggia: la vista più famosa di Busan è quindi a cinque minuti a piedi e non costa nulla alla giornata. È una sosta volutamente breve: quanto basta per mettere piede sulla sabbia e fotografare lo skyline prima che il pomeriggio viri verso i villaggi in collina.",
      visitBasics: {
        hours: 'Aperta 24 ore',
        closed: 'Mai',
        walking: 'Sabbia pianeggiante e lungomare pavimentato',
        admission: 'GRATIS',
      },
    },
    dropoff: {
      description:
        "**Le discese procedono in sequenza da ovest verso est**: **Nampo-dong / zona Jagalchi (~17:10)** — scendete qui per le migliori vie del cibo serale di Busan e la scena notturna di BIFF Square; **stazione di Busan (~17:30)** per le coincidenze KTX; **Seomyeon (~17:50)** per gli hotel del centro; e infine **Haeundae (~18:20)**. Concordate il vostro punto di discesa con la guida nel pomeriggio: proseguire fino a Haeundae è il tragitto più lungo, ma vi lascia in riva alla spiaggia per la serata.",
      whyOnRoute:
        "Dakbatgol dista dieci minuti da Nampo-dong, così la sequenza delle discese comincia quasi subito dopo l'ultima tappa, senza trasferimenti a vuoto. L'ordine ovest-est copre chi viaggia in KTX (stazione di Busan), gli hotel del centro (Seomyeon) e quelli sulla spiaggia (Haeundae) senza tornare indietro.",
      timeUsed: [
        'Nampo-dong / zona Jagalchi (~17:10)',
        'Stazione di Busan (~17:30)',
        'Seomyeon (~17:50)',
        'Haeundae (~18:20)',
      ],
    },
    lunchDescFrom: 'Pranzo di circa 60 minuti',
    lunchDescTo: 'Pranzo di circa 45 minuti',
    booking: {
      0: "Conferma immediata della prenotazione, con la vostra finestra di prelievo in hotel (09:00–10:00) e cosa aspettarsi.",
      3: "Un messaggio la sera prima conferma l'orario esatto di prelievo in hotel; uno al mattino copre il traffico in tempo reale.",
    },
  },

  ru: {
    duration: '≈ 9 часов',
    heroDuration: '≈ 9 часов (посадка у отеля в 09:00, последняя высадка в центре ≈ 17:50)',
    heroStopsLabel: '9 остановок',
    seoFrom: '10-часовой',
    seoTo: '9-часовой',
    introFrom: 'После обеда день переходит',
    introTo: 'После обеда и короткой остановки на пляже Хэундэ день переходит',
    introTailFrom: 'с 08:30 примерно до 18:30.',
    introTailTo: 'с 09:00 примерно до 18:20.',
    yongWhyFrom: 'Прибытие к 10:00',
    yongWhyTo: 'Прибытие к 10:20',
    whyItem0:
      'Хэдон Ёнгунса — самый фотографируемый храм Пусана, а наплыв туристических автобусов начинается примерно с 11:00. Приезд около 10:20 оставляет спуск по 108 ступеням и смотровую площадку Хэсу Гванным проходимыми без очередей.',
    routePhases: [
      {
        phase: 'Утро на побережье',
        duration: '≈ 3,5 часа',
        description:
          'Посадка от двери до двери у отелей в центре Пусана (09:00–10:00), затем храм Хэдон Ёнгунса до наплыва автобусов и далее стеклянная смотровая Тариттоль в Чхонсапхо.',
      },
      {
        phase: 'Sky Capsule, обед и пляж',
        duration: '≈ 2 часа',
        description:
          'Пастельная капсула Sky Capsule из Чхонсапхо в Мипхо (билет по выбору — без него можно ехать на автобусе или пройти по деревянной Green Railway), обед рядом с Хэундэ и затем двадцать минут на самом пляже Хэундэ.',
      },
      {
        phase: 'Две деревни на склоне',
        duration: '≈ 2 часа',
        description:
          'Фотомаршрут по культурной деревне Камчхон (60 мин), затем тихая деревня фресок Такпатколь и бесплатный монорельс у «лестницы желаний» (30 мин).',
      },
      {
        phase: 'Завершение в центре',
        duration: '≈ 1 час',
        description: 'Высадка по порядку: Нампхо-дон, вокзал Пусана, Сомён, затем Хэундэ.',
      },
    ],
    staticQ6:
      'Посадка — от двери до двери у вашего отеля в центре Пусана, между 09:00 и 10:00; точное время подтверждается в WhatsApp накануне вечером. Высадка по порядку: Нампхо-дон ≈17:10, вокзал Пусана ≈17:30, Сомён ≈17:50, Хэундэ ≈18:20.',
    practicalPickup: {
      title: 'Посадка и высадка',
      content: [
        'Посадка — от двери до двери у вашего отеля в центре Пусана: Сомён, Нампхо-дон / вокзал Пусана, Хэундэ / Marine City — между 09:00 и 10:00. Точное время подтверждается в WhatsApp накануне вечером.',
        'Высадка по порядку: Нампхо-дон/Чагальчхи ≈17:10, вокзал Пусана ≈17:30, Сомён ≈17:50, Хэундэ ≈18:20.',
        'Фактическая длительность тура зависит от времени посадки и точки высадки — примерно 7 ч 15 мин в самом коротком варианте (посадка в 10:00, высадка в Нампхо-доне) и примерно 9 ч 15 мин в самом длинном (посадка в 09:00, высадка в Хэундэ).',
      ],
    },
    pdNotes: [
      'Посадка — от двери до двери у вашего отеля в центре Пусана между 09:00 и 10:00; точное время подтверждается накануне вечером. Высадка происходит в четырёх центральных точках по порядку (Нампхо-дон → вокзал Пусана → Сомён → Хэундэ, ≈ 17:10–18:20) — скажите гиду днём, какая вам нужна.',
    ],
    pdDeparture: {
      name: 'Ваш отель в центре Пусана (от двери до двери)',
      note: 'Посадка от двери до двери у отелей в центре Пусана — Сомён, Нампхо-дон / вокзал Пусана, Хэундэ / Marine City. Точное время подтверждается накануне вечером.',
    },
    pickupStop: {
      name: 'Посадка (ваш отель в центре Пусана)',
      category: 'Трансфер / Посадка у отеля',
      duration: '60 мин',
      description:
        'Посадка от двери до двери у вашего отеля в центре Пусана, между **09:00 и 10:00**. Точное время подтверждается в WhatsApp накануне вечером, когда у водителя есть список отелей на день и он может выстроить маршрут эффективно: гостей со стороны Хэундэ обычно забирают последними, потому что дальше автобус уходит из города на северо-восток, в Кичжан-гун, к первой остановке.\n\nЗона обслуживания охватывает основные гостиничные кластеры центра: **Сомён**, **Нампхо-дон / вокзал Пусана** и **Хэундэ / Marine City**. Если ваш отель за её пределами, гид назовёт ближайшее место встречи при подтверждении бронирования.\n\nПожалуйста, ждите в лобби за 5 минут до подтверждённого времени. Дорога от последней посадки до Хэдон Ёнгунса занимает около 30–40 минут в зависимости от трафика.',
      highlights: [
        'Посадка от двери до двери у отелей в центре Пусана, 09:00–10:00',
        'Точное время подтверждается в WhatsApp накануне вечером',
        'Автобус малой группы (макс. ~14 чел.)',
        'Печатная программа на корейском и английском при посадке',
      ],
      timeUsed: [
        'Посадка у отелей в центре Пусана (~40 мин)',
        'Дорога на северо-восток в Кичжан-гун (~20 мин)',
      ],
      whyOnRoute:
        'Посадка у отеля полностью снимает утренний трансфер — не нужно раннее метро и не нужно искать нужный выход. Маршрут идёт с запада на восток, поэтому автобус заканчивает посадку рядом с Хэундэ и покидает город уже развёрнутым в сторону Кичжана и первой остановки дня.',
    },
    haeundaeBeach: {
      name: 'Пляж Хэундэ',
      category: 'Пляж / Бесплатно',
      duration: '20 мин',
      description:
        '**Пляж Хэундэ (해운대해수욕장)** — самая известная песчаная полоса Кореи: около **1,5 км** береговой линии, изгибающейся между островом Тонбэксом на западе и Мипхо на востоке, со скайлайном Marine City за спиной. Sky Capsule высаживает вас в Мипхо, а это и есть восточный край пляжа, поэтому остановка не стоит дню ни одной лишней минуты дороги.\n\nДвадцать минут — это остановка для фотографий и того, чтобы намочить ноги, а не для купания: выйти на песок, снять скайлайн и вернуться к автобусу. В июле и августе пляж наиболее многолюден и ряды зонтов расставлены; в остальное время года он широкий, тихий и удобный для прогулки. Бесплатно, открыт круглосуточно.',
      highlights: [
        '**Самый знаменитый пляж Кореи** — ~1,5 км песка, БЕСПЛАТНО и круглосуточно',
        'Скайлайн Marine City прямо от кромки воды',
        'Остров Тонбэксом и Nurimaru APEC House на западном краю',
        'Прямо в Мипхо, где заканчивается Sky Capsule — без дополнительного трансфера',
      ],
      timeUsed: [
        'Выход на песок из Мипхо (~5 мин)',
        'Фото пляжа и скайлайна (~10 мин)',
        'Сбор у автобуса (~5 мин)',
      ],
      whyOnRoute:
        'Капсула прибывает в Мипхо — восточный край пляжа, так что самый известный вид Пусана в пяти минутах пешком и ничего не стоит дню. Остановка намеренно короткая: ровно чтобы постоять на песке и снять скайлайн, прежде чем день повернёт к деревням на склонах.',
      visitBasics: {
        hours: 'Открыт круглосуточно',
        closed: 'Никогда',
        walking: 'Ровный песок и мощёная набережная',
        admission: 'БЕСПЛАТНО',
      },
    },
    dropoff: {
      description:
        '**Высадка идёт по порядку с запада обратно на восток**: **Нампхо-дон / Чагальчхи (~17:10)** — здесь выходят ради лучших вечерних улиц еды Пусана и ночной площади BIFF; **вокзал Пусана (~17:30)** для пересадки на KTX; **Сомён (~17:50)** для центрального гостиничного кластера; и **Хэундэ (~18:20)** последним. Согласуйте точку высадки с гидом во второй половине дня — до Хэундэ дорога самая долгая, зато вечер вы начнёте у моря.',
      whyOnRoute:
        'Такпатколь в десяти минутах от Нампхо-дона, поэтому высадка начинается почти сразу после последней остановки — без порожнего перегона. Порядок с запада на восток охватывает пассажиров KTX (вокзал Пусана), отели центра (Сомён) и пляжные отели (Хэундэ) без возвратов.',
      timeUsed: [
        'Нампхо-дон / Чагальчхи (~17:10)',
        'Вокзал Пусана (~17:30)',
        'Сомён (~17:50)',
        'Хэундэ (~18:20)',
      ],
    },
    lunchDescFrom: 'Примерно 60 минут на обед',
    lunchDescTo: 'Примерно 45 минут на обед',
    booking: {
      0: 'Мгновенное подтверждение бронирования с указанием окна посадки у отеля (09:00–10:00) и того, чего ожидать.',
      3: 'Сообщение накануне вечером подтверждает точное время посадки у отеля; утреннее сообщение — актуальную дорожную обстановку.',
    },
  },
};

// New per-stop minute breakdowns, so timeUsed keeps adding up to `duration`.
const RETIME = {
  lunch: [5, 35, 5], // 45 min
  skycapsule: [15, 35], // 50 min
  dakbatgol: [10, 10, 5, 5], // 30 min
};

// ─────────────────────────────────────────────────────────────────────────────

for (const loc of ALL) {
  const p = P[loc];
  const file = path.join(CONTENT, `${loc}.json`);
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));

  c.duration = p.duration;
  c.heroDuration = p.heroDuration;
  c.stopsCount = 9;

  c.seo.metaDescription = sub(c.seo.metaDescription, p.seoFrom, p.seoTo, loc, 'seo.metaDescription');

  c.routeShapeIntro.subtitle = sub(
    sub(c.routeShapeIntro.subtitle, p.introFrom, p.introTo, loc, 'intro.beach'),
    p.introTailFrom,
    p.introTailTo,
    loc,
    'intro.tail'
  );

  c.routePhases = p.routePhases;
  c.whyTourWorks.items[0].detail = p.whyItem0;
  c.yonggungsaWhy = sub(c.yonggungsaWhy, p.yongWhyFrom, p.yongWhyTo, loc, 'yonggungsaWhy');
  c.staticQuestions[6].answer = p.staticQ6;

  c.practical.pickupTitle = p.practicalPickup.title;
  c.practical.pickupContent = p.practicalPickup.content;

  c.pdNotes = p.pdNotes;
  c.pdDeparture = p.pdDeparture;
  c.pickupStop = p.pickupStop;
  c.haeundaeBeach = p.haeundaeBeach;
  c.bookingSupportOverrides = p.booking;

  c.dropoff.description = p.dropoff.description;
  c.dropoff.whyOnRoute = p.dropoff.whyOnRoute;
  c.dropoff.timeUsed = p.dropoff.timeUsed;

  c.lunch.duration = c.lunch.duration.replace(/\d+/, '45');
  c.lunch.description = sub(c.lunch.description, p.lunchDescFrom, p.lunchDescTo, loc, 'lunch.description');
  c.lunch.timeUsed = retime(c.lunch.timeUsed, RETIME.lunch, loc, 'lunch.timeUsed');

  c.skycapsule.duration = c.skycapsule.duration.replace(/\d+/, '50');
  c.skycapsule.timeUsed = retime(c.skycapsule.timeUsed, RETIME.skycapsule, loc, 'skycapsule.timeUsed');

  c.dakbatgol.duration = c.dakbatgol.duration.replace(/\d+/, '30');

  // Yonggungsa 10:20–11:20 and Gamcheon 15:10–16:10 are both 60 min now. The
  // unit string is borrowed from a sibling field so each locale keeps its own
  // ("60 min" / "60분" / "60 Min." / "60 мин" …).
  const durationUnit = c.dakbatgol.duration.replace(/\d+/, '{n}');
  c.yonggungsaDuration = durationUnit.replace('{n}', '60');
  c.gamcheonDuration = durationUnit.replace('{n}', '60');
  c.dakbatgol.timeUsed = retime(c.dakbatgol.timeUsed, RETIME.dakbatgol, loc, 'dakbatgol.timeUsed');

  fs.writeFileSync(file, `${JSON.stringify(c, null, 2)}\n`, 'utf8');
  console.log(`✓ content/${loc}.json`);
}

// Staged locales also carry translated donor pieces; their pickup stop is gone
// (authored now) and the donor-derived Yonggungsa / Gamcheon breakdowns have to
// shrink to the owner's shorter visits.
for (const loc of EXT) {
  const file = path.join(OVERLAY, `${loc}.json`);
  const o = JSON.parse(fs.readFileSync(file, 'utf8'));

  o.heroStopsLabel = P[loc].heroStopsLabel;
  o.flowNames.pickup = P[loc].pickupStop.name;
  o.flowNames.haeundaeBeach = P[loc].haeundaeBeach.name;
  delete o.pickupStop; // the pickup stop is authored per-locale now, not donor-derived

  o.yonggungsaStop.timeUsed = retime(
    o.yonggungsaStop.timeUsed,
    [10, 10, 25, 10, 5],
    loc,
    'overlay.yonggungsaStop.timeUsed'
  );
  o.gamcheonStop.timeUsed = retime(
    o.gamcheonStop.timeUsed,
    [5, 10, 20, 20, 5],
    loc,
    'overlay.gamcheonStop.timeUsed'
  );

  o.bookingSupportSteps[0].description = P[loc].booking[0];
  o.bookingSupportSteps[3].description = P[loc].booking[3];

  fs.writeFileSync(file, `${JSON.stringify(o, null, 2)}\n`, 'utf8');
  console.log(`✓ donor-overlay/${loc}.json`);
}

console.log('\nContent sources updated. Now run: node scripts/build-busan-smallgroup-2026-08.mjs');
