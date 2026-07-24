/**
 * 배치도 편집 순수 계층 — AtoC 통합 플랜 §5.3b (관리자 배치도 에디터).
 *
 * `ops_vehicle_layouts.layout_json` = `{model, cols, fixtures[], seats[]}` 을
 * 검증하고 변형하는 함수만 담는다. DB·React·node 무의존 — 그래서
 * `'use client'` 에디터 페이지와 admin 라우트가 같은 규칙을 공유한다
 * (lib/ops/seating/evidence.ts ↔ evidenceFormat.ts 와 같은 분리 규약:
 *  IO는 layoutPhoto.ts, 순수 규칙은 여기).
 *
 * 검증이 지키는 것은 "예쁜 JSON"이 아니라 운영이다:
 *   · 좌석번호 중복 → 두 손님이 같은 번호를 잡는다 (UNIQUE는 DB가 막지만
 *     좌석판에는 겹쳐 그려진다).
 *   · 격자 밖 좌석 → SeatMap이 차체 밖에 그리거나 아예 안 그린다.
 *   · total_seats ≠ seats.length → 정원 카운터·게이트 집계가 어긋난다.
 *   · 사용 중 배치도에서 이미 배정된 좌석이 사라짐 → 그 손님의 좌석이
 *     조용히 증발한다. 이건 error가 아니라 "이름을 대는 경고"다 — 사람이
 *     어느 룸의 누가 영향받는지 보고 명시적으로 확인해야 통과한다.
 */

import type { FixtureDef, FixtureType, SeatDef, VehicleLayoutJson, VehicleModel } from './layouts';
import { VEHICLE_MODELS } from './layouts';

/** 격자 상한 — SeatMap 렌더 가능 범위이자 오타 방어선(45인승이 12행/5열). */
export const MAX_COLS = 8;
export const MAX_ROWS = 24;

export const FIXTURE_TYPES: FixtureType[] = ['driver', 'door', 'facility', 'stairs'];

export const FIXTURE_LABELS_KO: Record<FixtureType, string> = {
  driver: '운전석',
  door: '출입문',
  facility: '설비',
  stairs: '계단',
};

export type LayoutIssueSeverity = 'error' | 'warning';

export type LayoutIssueCode =
  | 'cols_out_of_range'
  | 'no_seats'
  | 'seat_number_invalid'
  | 'duplicate_seat_number'
  | 'seat_out_of_grid'
  | 'seat_cell_collision'
  | 'seat_on_fixture'
  | 'fixture_out_of_grid'
  | 'total_seats_mismatch'
  | 'model_mismatch'
  | 'no_driver_fixture'
  | 'in_use_seat_removed';

export interface LayoutIssue {
  code: LayoutIssueCode;
  severity: LayoutIssueSeverity;
  /** 한국어 (admin 전용 화면 — 단일 로케일). */
  message: string;
  /** 문제가 걸린 좌석번호들 (SeatMap highlightSeats로 그대로 넘긴다). */
  seats?: number[];
  /** in_use_seat_removed 전용 — 영향받는 룸을 이름으로 댄다. */
  rooms?: AffectedRoom[];
}

/** 이 배치도를 쓰는 룸에서 이미 배정된 좌석 1건. */
export interface InUseSeatRef {
  roomId: string;
  roomVehicleId: string;
  /** 사람이 알아보는 룸 라벨 ("8/17 성산 · Massimo C." 같은). */
  roomLabel: string;
  seatNumber: number;
  guestLabel?: string | null;
  checkedIn?: boolean;
}

export interface AffectedRoom {
  roomId: string;
  roomLabel: string;
  seats: number[];
  guests: string[];
}

export interface ValidateLayoutInput {
  layout: VehicleLayoutJson;
  /** 저장하려는 total_seats. 생략하면 seats.length 검사를 건너뛴다. */
  totalSeats?: number | null;
  /** 행의 model 컬럼 (layout.model과 일치해야 한다). */
  model?: string | null;
  /** 이 배치도를 현재 쓰고 있는 좌석 배정들. */
  inUse?: InUseSeatRef[];
}

function cellKey(r: number, c: number): string {
  return `${r}:${c}`;
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** 설비가 차지하는 모든 칸 (w 확장 포함). */
export function fixtureCells(fixtures: FixtureDef[]): Map<string, FixtureDef> {
  const cells = new Map<string, FixtureDef>();
  for (const f of fixtures) {
    const width = Math.max(1, f.w ?? 1);
    for (let dc = 0; dc < width; dc++) cells.set(cellKey(f.r, f.c + dc), f);
  }
  return cells;
}

/** 렌더에 필요한 행 수 (좌석·설비 중 가장 아래 + 1). */
export function layoutRows(layout: VehicleLayoutJson): number {
  let maxR = 0;
  for (const s of layout.seats) maxR = Math.max(maxR, s.r);
  for (const f of layout.fixtures) maxR = Math.max(maxR, f.r);
  return maxR + 1;
}

/**
 * 검증 — error 하나라도 있으면 저장 불가, warning은 사람이 확인하면 통과.
 * 반환 순서는 화면 표시 순서 그대로(error 먼저).
 */
export function validateVehicleLayout(input: ValidateLayoutInput): LayoutIssue[] {
  const { layout } = input;
  const errors: LayoutIssue[] = [];
  const warnings: LayoutIssue[] = [];

  const cols = layout?.cols;
  const colsOk = isInt(cols) && cols >= 1 && cols <= MAX_COLS;
  if (!colsOk) {
    errors.push({
      code: 'cols_out_of_range',
      severity: 'error',
      message: `열(cols)은 1~${MAX_COLS} 사이의 정수여야 해요. 지금 값: ${String(cols)}`,
    });
  }

  const seats = Array.isArray(layout?.seats) ? layout.seats : [];
  const fixtures = Array.isArray(layout?.fixtures) ? layout.fixtures : [];

  if (seats.length === 0) {
    errors.push({ code: 'no_seats', severity: 'error', message: '좌석이 하나도 없어요.' });
  }

  // 좌석번호 위생 (정수 · 1 이상 · 중복 없음).
  const badNumbers: number[] = [];
  const seenNumbers = new Map<number, number>();
  for (const s of seats) {
    if (!isInt(s?.n) || s.n < 1) {
      badNumbers.push(Number(s?.n));
      continue;
    }
    seenNumbers.set(s.n, (seenNumbers.get(s.n) ?? 0) + 1);
  }
  if (badNumbers.length > 0) {
    errors.push({
      code: 'seat_number_invalid',
      severity: 'error',
      message: `좌석번호는 1 이상의 정수여야 해요 (${badNumbers.length}개 잘못됨).`,
    });
  }
  const duplicates = [...seenNumbers.entries()].filter(([, count]) => count > 1).map(([n]) => n);
  if (duplicates.length > 0) {
    errors.push({
      code: 'duplicate_seat_number',
      severity: 'error',
      message: `좌석번호가 중복돼요: ${duplicates.sort((a, b) => a - b).join(', ')}번`,
      seats: duplicates,
    });
  }

  // 격자 밖 좌석.
  const outOfGrid = seats.filter(
    (s) =>
      !isInt(s?.r) ||
      !isInt(s?.c) ||
      s.r < 0 ||
      s.r > MAX_ROWS ||
      s.c < 0 ||
      (colsOk ? s.c >= (cols as number) : false),
  );
  if (outOfGrid.length > 0) {
    errors.push({
      code: 'seat_out_of_grid',
      severity: 'error',
      message: `격자 밖에 있는 좌석이 있어요 (${outOfGrid.length}개). 열은 0~${
        colsOk ? (cols as number) - 1 : '?'
      }, 행은 0~${MAX_ROWS} 범위여야 해요.`,
      seats: outOfGrid.map((s) => s.n).filter(isInt),
    });
  }

  // 좌석끼리 같은 칸.
  const occupied = new Map<string, number>();
  const collided = new Set<number>();
  for (const s of seats) {
    if (!isInt(s?.r) || !isInt(s?.c)) continue;
    const key = cellKey(s.r, s.c);
    const prev = occupied.get(key);
    if (prev !== undefined) {
      collided.add(prev);
      if (isInt(s.n)) collided.add(s.n);
    } else if (isInt(s.n)) {
      occupied.set(key, s.n);
    }
  }
  if (collided.size > 0) {
    errors.push({
      code: 'seat_cell_collision',
      severity: 'error',
      message: `같은 칸에 겹쳐 있는 좌석이 있어요: ${[...collided].sort((a, b) => a - b).join(', ')}번`,
      seats: [...collided],
    });
  }

  // 설비 칸 위의 좌석 (운전석/출입문 자리에 손님을 앉힐 수는 없다).
  const fCells = fixtureCells(fixtures);
  const onFixture = seats.filter((s) => isInt(s?.r) && isInt(s?.c) && fCells.has(cellKey(s.r, s.c)));
  if (onFixture.length > 0) {
    errors.push({
      code: 'seat_on_fixture',
      severity: 'error',
      message: `설비(운전석·출입문 등) 자리에 좌석이 있어요: ${onFixture
        .map((s) => s.n)
        .join(', ')}번`,
      seats: onFixture.map((s) => s.n).filter(isInt),
    });
  }

  // 격자 밖 설비.
  const badFixtures = fixtures.filter((f) => {
    if (!isInt(f?.r) || !isInt(f?.c)) return true;
    if (f.r < 0 || f.r > MAX_ROWS || f.c < 0) return true;
    const width = Math.max(1, f.w ?? 1);
    return colsOk ? f.c + width > (cols as number) : false;
  });
  if (badFixtures.length > 0) {
    errors.push({
      code: 'fixture_out_of_grid',
      severity: 'error',
      message: `격자 밖으로 나간 설비가 ${badFixtures.length}개 있어요.`,
    });
  }

  // total_seats 정합 — 정원 카운터·시작 게이트가 이 숫자를 쓴다.
  if (input.totalSeats !== undefined && input.totalSeats !== null) {
    if (!isInt(input.totalSeats) || input.totalSeats < 1) {
      errors.push({
        code: 'total_seats_mismatch',
        severity: 'error',
        message: '판매석 수(total_seats)는 1 이상의 정수여야 해요.',
      });
    } else if (input.totalSeats !== seats.length) {
      errors.push({
        code: 'total_seats_mismatch',
        severity: 'error',
        message: `판매석 수(${input.totalSeats})와 실제 좌석 수(${seats.length})가 달라요.`,
      });
    }
  }

  // model 정합 — layout_json.model은 행의 model과 같아야 한다(시드 계약).
  if (input.model) {
    if (!VEHICLE_MODELS.includes(input.model as VehicleModel)) {
      errors.push({
        code: 'model_mismatch',
        severity: 'error',
        message: `알 수 없는 차종이에요: ${input.model}`,
      });
    } else if (layout?.model !== input.model) {
      errors.push({
        code: 'model_mismatch',
        severity: 'error',
        message: `배치도의 model(${String(layout?.model)})이 행의 차종(${input.model})과 달라요.`,
      });
    }
  }

  if (!fixtures.some((f) => f?.type === 'driver')) {
    warnings.push({
      code: 'no_driver_fixture',
      severity: 'warning',
      message: '운전석 표시가 없어요. 손님이 방향을 잡기 어려워요.',
    });
  }

  // 사용 중 좌석 소실 — 이름을 대는 경고.
  const removed = removedInUseSeats(layout, input.inUse ?? []);
  if (removed.length > 0) {
    const rooms = groupAffectedRooms(removed);
    warnings.push({
      code: 'in_use_seat_removed',
      severity: 'warning',
      message: `이미 배정된 좌석 ${removed.length}석이 사라져요 — ${rooms
        .map((room) => `${room.roomLabel}(${room.seats.join('·')}번)`)
        .join(', ')}`,
      seats: removed.map((r) => r.seatNumber),
      rooms,
    });
  }

  return [...errors, ...warnings];
}

/** 새 배치도에서 좌석번호가 없어져 버리는 기존 배정들. */
export function removedInUseSeats(
  layout: VehicleLayoutJson,
  inUse: InUseSeatRef[],
): InUseSeatRef[] {
  const available = new Set((layout?.seats ?? []).map((s) => s.n));
  return inUse.filter((ref) => !available.has(ref.seatNumber));
}

export function groupAffectedRooms(refs: InUseSeatRef[]): AffectedRoom[] {
  const byRoom = new Map<string, AffectedRoom>();
  for (const ref of refs) {
    const existing = byRoom.get(ref.roomId);
    if (existing) {
      existing.seats.push(ref.seatNumber);
      if (ref.guestLabel) existing.guests.push(ref.guestLabel);
    } else {
      byRoom.set(ref.roomId, {
        roomId: ref.roomId,
        roomLabel: ref.roomLabel,
        seats: [ref.seatNumber],
        guests: ref.guestLabel ? [ref.guestLabel] : [],
      });
    }
  }
  for (const room of byRoom.values()) room.seats.sort((a, b) => a - b);
  return [...byRoom.values()];
}

export function hasBlockingIssues(issues: LayoutIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function issuesOfCode(issues: LayoutIssue[], code: LayoutIssueCode): LayoutIssue[] {
  return issues.filter((issue) => issue.code === code);
}

/** 검증 실패 좌석 전체 (SeatMap highlightSeats). */
export function issueSeatNumbers(issues: LayoutIssue[]): number[] {
  const set = new Set<number>();
  for (const issue of issues) for (const n of issue.seats ?? []) set.add(n);
  return [...set];
}

// ─── 변형 (전부 순수 — 새 객체를 돌려준다) ─────────────────────────────────

function clone(layout: VehicleLayoutJson): VehicleLayoutJson {
  return {
    model: layout.model,
    cols: layout.cols,
    fixtures: layout.fixtures.map((f) => ({ ...f })),
    seats: layout.seats.map((s) => ({ ...s })),
  };
}

export type CellOccupant =
  | { kind: 'seat'; seat: SeatDef }
  | { kind: 'fixture'; fixture: FixtureDef }
  | { kind: 'empty' };

export function cellAt(layout: VehicleLayoutJson, r: number, c: number): CellOccupant {
  const seat = layout.seats.find((s) => s.r === r && s.c === c);
  if (seat) return { kind: 'seat', seat };
  const fixture = fixtureCells(layout.fixtures).get(cellKey(r, c));
  if (fixture) return { kind: 'fixture', fixture };
  return { kind: 'empty' };
}

/** 다음 좌석번호 = 현재 최대 + 1 (빈 번호를 메우지 않는다 — 번호 재사용은 혼동). */
export function nextSeatNumber(layout: VehicleLayoutJson): number {
  return layout.seats.reduce((max, s) => Math.max(max, isInt(s.n) ? s.n : 0), 0) + 1;
}

/** 빈 칸에 좌석 추가. 이미 무언가 있으면 그대로 돌려준다(호출부가 판정 불필요). */
export function addSeat(layout: VehicleLayoutJson, r: number, c: number, n?: number): VehicleLayoutJson {
  if (cellAt(layout, r, c).kind !== 'empty') return layout;
  const next = clone(layout);
  next.seats.push({ n: n ?? nextSeatNumber(layout), r, c });
  return next;
}

/** 좌석 이동 — 대상 칸이 비어 있을 때만. */
export function moveSeat(layout: VehicleLayoutJson, n: number, r: number, c: number): VehicleLayoutJson {
  const occupant = cellAt(layout, r, c);
  if (occupant.kind === 'fixture') return layout;
  if (occupant.kind === 'seat' && occupant.seat.n !== n) return layout;
  const next = clone(layout);
  const seat = next.seats.find((s) => s.n === n);
  if (!seat) return layout;
  seat.r = r;
  seat.c = c;
  return next;
}

export function removeSeat(layout: VehicleLayoutJson, n: number): VehicleLayoutJson {
  const next = clone(layout);
  next.seats = next.seats.filter((s) => s.n !== n);
  return next;
}

/**
 * 번호 재정렬 — §5.3b 공통 규칙 그대로 앞→뒤, 좌→우로 1..N.
 * (통로 c=2를 특별 취급하지 않는다: 좌표 순서가 곧 물리적 순서다.)
 */
export function renumberSeats(layout: VehicleLayoutJson): VehicleLayoutJson {
  const next = clone(layout);
  next.seats = [...next.seats]
    .sort((a, b) => a.r - b.r || a.c - b.c)
    .map((s, i) => ({ ...s, n: i + 1 }));
  return next;
}

/** 열 수 변경. 줄이면 범위 밖 좌석/설비가 생길 수 있고, 그건 검증이 잡는다. */
export function setCols(layout: VehicleLayoutJson, cols: number): VehicleLayoutJson {
  const next = clone(layout);
  next.cols = cols;
  return next;
}

/**
 * 설비 배치. 같은 칸에 이미 설비가 있으면 교체하고, 좌석이 있으면 거부한다
 * (좌석 삭제는 사람이 명시적으로 해야 한다).
 * driver는 차 한 대에 하나뿐이라 기존 운전석을 옮긴다.
 */
export function putFixture(
  layout: VehicleLayoutJson,
  type: FixtureType,
  r: number,
  c: number,
  w = 1,
): VehicleLayoutJson {
  const cells = new Set<string>();
  for (let dc = 0; dc < Math.max(1, w); dc++) cells.add(cellKey(r, c + dc));
  if (layout.seats.some((s) => cells.has(cellKey(s.r, s.c)))) return layout;

  const next = clone(layout);
  const existing = fixtureCells(next.fixtures);
  const displaced = new Set<FixtureDef>();
  for (const key of cells) {
    const found = existing.get(key);
    if (found) displaced.add(found);
  }
  next.fixtures = next.fixtures.filter((f) => !displaced.has(f));
  if (type === 'driver') next.fixtures = next.fixtures.filter((f) => f.type !== 'driver');
  next.fixtures.push(w > 1 ? { type, r, c, w } : { type, r, c });
  return next;
}

export function removeFixtureAt(layout: VehicleLayoutJson, r: number, c: number): VehicleLayoutJson {
  const target = fixtureCells(layout.fixtures).get(cellKey(r, c));
  if (!target) return layout;
  const next = clone(layout);
  next.fixtures = next.fixtures.filter((f) => f !== target && !(f.r === target.r && f.c === target.c && f.type === target.type));
  return next;
}

// ─── 파싱 ───────────────────────────────────────────────────────────────────

/**
 * 임의의 JSON을 layout으로 정규화. 모양이 아니면 null (라우트가 400).
 * 알 수 없는 필드는 버린다 — 스키마는 §5.3b 그대로 유지한다.
 */
export function normalizeLayoutJson(value: unknown): VehicleLayoutJson | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const model = typeof raw.model === 'string' ? raw.model : null;
  if (!model || !VEHICLE_MODELS.includes(model as VehicleModel)) return null;
  if (!isInt(raw.cols)) return null;
  if (!Array.isArray(raw.seats) || !Array.isArray(raw.fixtures)) return null;

  const seats: SeatDef[] = [];
  for (const item of raw.seats) {
    if (!item || typeof item !== 'object') return null;
    const s = item as Record<string, unknown>;
    if (!isInt(s.n) || !isInt(s.r) || !isInt(s.c)) return null;
    seats.push({ n: s.n, r: s.r, c: s.c });
  }

  const fixtures: FixtureDef[] = [];
  for (const item of raw.fixtures) {
    if (!item || typeof item !== 'object') return null;
    const f = item as Record<string, unknown>;
    if (typeof f.type !== 'string' || !FIXTURE_TYPES.includes(f.type as FixtureType)) return null;
    if (!isInt(f.r) || !isInt(f.c)) return null;
    const fixture: FixtureDef = { type: f.type as FixtureType, r: f.r, c: f.c };
    if (isInt(f.w) && f.w > 1) fixture.w = f.w;
    fixtures.push(fixture);
  }

  return { model: model as VehicleModel, cols: raw.cols, fixtures, seats };
}
