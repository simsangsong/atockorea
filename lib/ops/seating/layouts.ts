/**
 * 차량 배치도 라이브러리 — AtoC 통합 플랜 §5.3b (D15, 웹 검증 확정 5종).
 *
 * 좌석 좌표·번호는 검증 완료된 데모(Downloads/atoc-seatmap-demo.html)의
 * LAYOUTS 정의를 그대로 옮긴 것 (2026-07-23 렌더 실동작 확인본). 공통 규칙:
 * 운전석 좌측 앞 · 승객문 우측 앞 · 번호는 앞→뒤, 좌→우. 통로는 c=2
 * (렌더 시 c>=2 좌석에 통로 오프셋 — components/ops/SeatMap.tsx).
 *
 * 이 파일이 ops_vehicle_layouts.layout_json 시드의 단일 소스다:
 * scripts/seed-vehicle-layouts.ts 가 여기서 읽어 idempotent upsert 한다.
 * 실차와 다른 배치가 발견되면 이 정의(및 DB layout_json)만 고치면 된다
 * (§5.3b — 정적 이미지 미채택 이유).
 */

export const VEHICLE_MODELS = [
  'county_20',
  'solati_16',
  'limo_27',
  'bus_35',
  'bus_45',
] as const;

export type VehicleModel = (typeof VEHICLE_MODELS)[number];

/** 좌석 한 칸 — n: 좌석번호(1-base), r: 행(0=운전석 행), c: 열(0-base, 통로=2). */
export interface SeatDef {
  n: number;
  r: number;
  c: number;
}

/** 선택 불가 설비 — driver(운전석)/door(출입문·슬라이딩도어)/facility(설비)/stairs(계단). */
export type FixtureType = 'driver' | 'door' | 'facility' | 'stairs';

export interface FixtureDef {
  type: FixtureType;
  r: number;
  c: number;
  /** 가로 칸수 (기본 1 — 출입문은 보통 2칸). */
  w?: number;
}

/** ops_vehicle_layouts.layout_json 스키마 (§5.3b). */
export interface VehicleLayoutJson {
  model: VehicleModel;
  cols: number;
  fixtures: FixtureDef[];
  seats: SeatDef[];
}

export interface VehicleLayoutSeed {
  model: VehicleModel;
  /** content_locales 키 체계 (lib/locale.ts) — en/ko/zh/zh-TW/es/ja. */
  displayName: Record<string, string>;
  layout: VehicleLayoutJson;
  totalSeats: number;
}

/** 데모와 동일한 행 반복 생성 헬퍼 (limo/bus 중간열). */
function rowSeats(startN: number, rows: [number, number], cols: number[]): SeatDef[] {
  const seats: SeatDef[] = [];
  let n = startN;
  for (let r = rows[0]; r <= rows[1]; r++) {
    for (const c of cols) seats.push({ n: n++, r, c });
  }
  return seats;
}

/* ----------------------------------------------------------------------------
 * county_20 — 카운티 20인승 (일반): (2+2)×4열 + 최후열 4석(중앙 통로석 없음).
 * 문: 우측 앞. 신뢰도 medium — 오너 확인 1건(2+2 vs 2+1+조수석).
 * -------------------------------------------------------------------------- */
const COUNTY_20: VehicleLayoutJson = {
  model: 'county_20',
  cols: 5,
  fixtures: [
    { type: 'driver', r: 0, c: 0 },
    { type: 'door', r: 0, c: 3, w: 2 },
  ],
  seats: [
    ...rowSeats(1, [1, 4], [0, 1, 3, 4]), // (2+2)×4열 = 1..16
    { n: 17, r: 5, c: 0 }, // 최후열 4석 (중앙 c2 없음)
    { n: 18, r: 5, c: 1 },
    { n: 19, r: 5, c: 3 },
    { n: 20, r: 5, c: 4 },
  ],
};

/* ----------------------------------------------------------------------------
 * solati_16 — 쏠라티 15/16인승 고급: 조수석1 + 2열 좌2(우측=슬라이딩도어)
 * + (2+1)×2열 + 최후열 4석 = 고정 13석 (+접이식 보조석 — 판매 제외).
 * 신뢰도 high (도면·제원·오너 실측 일치).
 * -------------------------------------------------------------------------- */
const SOLATI_16: VehicleLayoutJson = {
  model: 'solati_16',
  cols: 5,
  fixtures: [
    { type: 'driver', r: 0, c: 0 },
    { type: 'door', r: 1, c: 3, w: 2 }, // 슬라이딩도어
  ],
  seats: [
    { n: 1, r: 0, c: 3 }, // 조수석
    { n: 2, r: 1, c: 0 },
    { n: 3, r: 1, c: 1 },
    { n: 4, r: 2, c: 0 },
    { n: 5, r: 2, c: 1 },
    { n: 6, r: 2, c: 4 },
    { n: 7, r: 3, c: 0 },
    { n: 8, r: 3, c: 1 },
    { n: 9, r: 3, c: 4 },
    { n: 10, r: 4, c: 0 }, // 최후열 4석
    { n: 11, r: 4, c: 1 },
    { n: 12, r: 4, c: 3 },
    { n: 13, r: 4, c: 4 },
  ],
};

/* ----------------------------------------------------------------------------
 * limo_27 — 27인승 리무진 우등: 1열 좌2(우측 설비) + (2+1)×7열
 * + 최후열 4석(엔진룸 위) = 27. 28석형에서 1석 제외 파생.
 * 오너 확인 1건: 빠지는 1석 위치.
 * -------------------------------------------------------------------------- */
const LIMO_27: VehicleLayoutJson = {
  model: 'limo_27',
  cols: 5,
  fixtures: [
    { type: 'driver', r: 0, c: 0 },
    { type: 'door', r: 0, c: 3, w: 2 },
    { type: 'facility', r: 1, c: 4 },
  ],
  seats: [
    { n: 1, r: 1, c: 0 },
    { n: 2, r: 1, c: 1 },
    ...rowSeats(3, [2, 8], [0, 1, 4]), // (2+1)×7열 = 3..23
    { n: 24, r: 9, c: 0 }, // 최후열 4석
    { n: 25, r: 9, c: 1 },
    { n: 26, r: 9, c: 3 },
    { n: 27, r: 9, c: 4 },
  ],
};

/* ----------------------------------------------------------------------------
 * bus_35 — 35인승 중형: 1열 좌2(우측 승강구) + (2+2)×7열 + 최후열 5석 = 35.
 * 신뢰도 medium — 33인승 실측 도면 + 롱바디 추정.
 * -------------------------------------------------------------------------- */
const BUS_35: VehicleLayoutJson = {
  model: 'bus_35',
  cols: 5,
  fixtures: [
    { type: 'driver', r: 0, c: 0 },
    { type: 'door', r: 0, c: 3, w: 2 },
    { type: 'stairs', r: 1, c: 3, w: 2 }, // 계단
  ],
  seats: [
    { n: 1, r: 1, c: 0 },
    { n: 2, r: 1, c: 1 },
    ...rowSeats(3, [2, 8], [0, 1, 3, 4]), // (2+2)×7열 = 3..30
    { n: 31, r: 9, c: 0 }, // 최후열 5석 (중앙 c2 포함)
    { n: 32, r: 9, c: 1 },
    { n: 33, r: 9, c: 2 },
    { n: 34, r: 9, c: 3 },
    { n: 35, r: 9, c: 4 },
  ],
};

/* ----------------------------------------------------------------------------
 * bus_45 — 45인승 대형: (2+2)×10열 + 최후열 5석 = 45.
 * 신뢰도 high (두 업체 도면 일치).
 * -------------------------------------------------------------------------- */
const BUS_45: VehicleLayoutJson = {
  model: 'bus_45',
  cols: 5,
  fixtures: [
    { type: 'driver', r: 0, c: 0 },
    { type: 'door', r: 0, c: 3, w: 2 },
  ],
  seats: [
    ...rowSeats(1, [1, 10], [0, 1, 3, 4]), // (2+2)×10열 = 1..40
    { n: 41, r: 11, c: 0 }, // 최후열 5석 (중앙 c2 포함)
    { n: 42, r: 11, c: 1 },
    { n: 43, r: 11, c: 2 },
    { n: 44, r: 11, c: 3 },
    { n: 45, r: 11, c: 4 },
  ],
};

/** 시드 데이터 — model → 배치도 + 다국어 표시명 + 판매석 수. */
export const VEHICLE_LAYOUT_SEEDS: Record<VehicleModel, VehicleLayoutSeed> = {
  county_20: {
    model: 'county_20',
    displayName: {
      en: 'County 20-seater',
      ko: '카운티 20인승 (일반)',
      zh: '考斯特 20座',
      'zh-TW': '考斯特 20座',
      es: 'County de 20 plazas',
      ja: 'カウンティ 20人乗り',
    },
    layout: COUNTY_20,
    totalSeats: 20,
  },
  solati_16: {
    model: 'solati_16',
    displayName: {
      en: 'Solati 15/16-seater (premium van)',
      ko: '쏠라티 15/16인승 고급',
      zh: 'Solati 15/16座高级',
      'zh-TW': 'Solati 15/16座高級',
      es: 'Solati de 15/16 plazas premium',
      ja: 'ソラティ 15/16人乗りプレミアム',
    },
    layout: SOLATI_16,
    totalSeats: 13, // 고정 판매석 (접이식 보조석 제외)
  },
  limo_27: {
    model: 'limo_27',
    displayName: {
      en: '27-seater limousine coach',
      ko: '27인승 리무진 우등',
      zh: '27座豪华巴士',
      'zh-TW': '27座豪華巴士',
      es: 'Autocar limusina de 27 plazas',
      ja: '27人乗りリムジンバス',
    },
    layout: LIMO_27,
    totalSeats: 27,
  },
  bus_35: {
    model: 'bus_35',
    displayName: {
      en: '35-seater midi bus',
      ko: '35인승 중형',
      zh: '35座中型巴士',
      'zh-TW': '35座中型巴士',
      es: 'Autobús mediano de 35 plazas',
      ja: '35人乗り中型バス',
    },
    layout: BUS_35,
    totalSeats: 35,
  },
  bus_45: {
    model: 'bus_45',
    displayName: {
      en: '45-seater coach',
      ko: '45인승 대형',
      zh: '45座大巴',
      'zh-TW': '45座大巴',
      es: 'Autocar de 45 plazas',
      ja: '45人乗り大型バス',
    },
    layout: BUS_45,
    totalSeats: 45,
  },
};

/** layout의 실제 좌석 수 (totalSeats 검증용 — 항상 일치해야 함). */
export function seatCount(layout: VehicleLayoutJson): number {
  return layout.seats.length;
}

/** 좌석번호 → SeatDef 조회 맵. */
export function seatByNumber(layout: VehicleLayoutJson): Map<number, SeatDef> {
  return new Map(layout.seats.map((s) => [s.n, s]));
}
