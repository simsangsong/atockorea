/**
 * 크루즈 기항 → D-1 안내 변수 (docs/cruise-jeju-shore-excursion-2026.md).
 *
 * 순수 모듈: DB 접근 없음. `cruise_calls` 행을 받아
 *   {cruise_ship} {cruise_arrive} {cruise_depart} {cruise_return_by}
 * 를 만들고, 같은 날 기항이 여러 척일 때 투어와 맞는 배를 고른다.
 *
 * 복귀 보장 = **출항 60분 전** (사용자 확정 2026-07-27 — 안내 문구 기준).
 * 코스 설계 버퍼(90분, §F)는 내부 기준이고, 손님에게 약속하는 문구는 60분이다.
 */

export interface CruiseCallRow {
  id: string;
  call_date: string;
  berth: string;
  port: string; // 'jeju' | 'gangjeong'
  ship: string;
  arrive_at: string; // timestamptz
  depart_at: string;
  passengers: number | null;
}

export type CruisePort = 'jeju' | 'gangjeong';

/** 선석 원문(제주항/강정1/강정2…) → 항구 키. */
export function portOfBerth(berth: string): CruisePort {
  return berth.replace(/\s/g, '').startsWith('강정') ? 'gangjeong' : 'jeju';
}

export const CRUISE_PORT_LABEL: Record<CruisePort, string> = {
  jeju: '제주항',
  gangjeong: '강정항(서귀포)',
};

/** KST 벽시계 HH:MM. */
export function kstClock(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 9 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export const RETURN_GUARANTEE_MIN = 60;

export interface CruiseVars {
  cruiseShip: string;
  /** HH:MM (KST) */
  cruiseArrive: string;
  cruiseDepart: string;
  /** 출항 − 60분 (KST HH:MM) — 손님에게 약속하는 복귀 시각. */
  cruiseReturnBy: string;
}

export function cruiseVarsFromCall(call: CruiseCallRow): CruiseVars {
  const departMs = Date.parse(call.depart_at);
  const returnBy = Number.isFinite(departMs)
    ? kstClock(new Date(departMs - RETURN_GUARANTEE_MIN * 60 * 1000).toISOString())
    : '';
  return {
    cruiseShip: call.ship,
    cruiseArrive: kstClock(call.arrive_at),
    cruiseDepart: kstClock(call.depart_at),
    cruiseReturnBy: returnBy,
  };
}

/** 투어명/슬러그의 항구 힌트. 없으면 null — 배 선택을 사람에게 넘긴다. */
export function portHintOfTour(hint: { title?: string | null; slug?: string | null }): CruisePort | null {
  const s = `${hint.title ?? ''} ${hint.slug ?? ''}`.toLowerCase();
  // 슬러그는 하이픈 구분(jeju-port-…)이므로 [\s-]를 허용한다 — 공백만 보면
  // 슬러그 힌트를 전부 놓친다 (자체 테스트가 잡은 실결함).
  if (/gangjeong|gangjung|강정|seogwipo[\s-]*port|서귀포항/.test(s)) return 'gangjeong';
  if (/jeju[\s-]*port|제주항/.test(s)) return 'jeju';
  return null;
}

/**
 * 같은 날 기항 중 이 투어의 배를 고른다.
 *  - 1척뿐이면 그 배.
 *  - 여러 척 + 투어에 항구 힌트가 있으면 그 항구의 배(여전히 복수면 최대 정원).
 *  - 그 외에는 null — **지어내지 않는다.** 운영자가 패널에서 배를 직접 고르고,
 *    고르기 전까지 {cruise_*} 토큰은 missing 배지로 남는 것이 정답이다.
 */
export function pickCruiseCall(
  calls: CruiseCallRow[],
  hint: { title?: string | null; slug?: string | null },
): CruiseCallRow | null {
  if (calls.length === 0) return null;
  if (calls.length === 1) return calls[0];
  const port = portHintOfTour(hint);
  if (!port) return null;
  const atPort = calls.filter((c) => c.port === port);
  if (atPort.length === 0) return null;
  if (atPort.length === 1) return atPort[0];
  return [...atPort].sort((a, b) => (b.passengers ?? 0) - (a.passengers ?? 0))[0];
}

/** 패널의 배 선택 칩 라벨: 'MSC Bellissima · 강정항 14:30–22:00'. */
export function cruiseCallLabel(call: CruiseCallRow): string {
  return `${call.ship} · ${CRUISE_PORT_LABEL[portOfBerth(call.berth)]} ${kstClock(call.arrive_at)}–${kstClock(call.depart_at)}`;
}
