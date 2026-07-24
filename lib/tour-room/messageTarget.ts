/**
 * §K B3 — 가이드 발송 대상(전체 / 선택 / 개인). 순수 함수만.
 *
 * 🔴 **B3-D3 — 대상은 컴포저에서 상시 보이고, 범위 전환은 명시적 행동이어야 한다.**
 * 라이브 투어에서 오발송은 실질 피해다: "예약이 취소되었습니다"가 12명에게
 * 가거나, 전체 집합 공지가 1명에게만 가는 것. 대상이 화면 어딘가에 조용히
 * 있으면 반드시 사고가 난다. 그래서 칩 문구와 **전송 버튼 라벨이 함께** 바뀐다 —
 * 손가락이 닿는 곳이 무엇을 하는지 말해야 한다.
 *
 * 🔴 **B3-D1 — 두 번째 팬아웃을 만들지 않는다.** 이 모듈은 `bookingIds` 배열
 * 하나를 만들 뿐이고, 실제 발송은 기존 broadcast 라우트가 그대로 한다.
 * 번역·푸시·부분실패 리포트·멱등이 전부 거기 있다.
 *
 * B3-D5 — 손님 화면에는 개인/전체 구분을 노출하지 않는다. 룸이 예약당이라
 * 손님은 어차피 자기 것만 본다 — 개인톡과 전체공지가 손님에겐 동일하게 사적이다.
 * 이 모듈은 **가이드 화면 전용**이다.
 */

export type MessageTarget =
  | { kind: 'all' }
  | { kind: 'selected'; bookingIds: string[] };

export const ALL_TARGET: MessageTarget = { kind: 'all' };

export interface TargetGuest {
  bookingId: string;
  /** 표시 이름. 없으면 좌석/예약으로 대체한다. */
  name?: string | null;
  /** 좌석 번호가 있으면 "3번 Massimo"처럼 가장 알아보기 쉬운 라벨이 된다. */
  seat?: number | null;
}

export interface TargetRoster {
  /** 이 투어의 전체 게스트 팀 수(= 룸 수). 칩의 "전체 N명"에 쓴다. */
  total: number;
  guests: TargetGuest[];
}

function guestOf(roster: TargetRoster, bookingId: string): TargetGuest | undefined {
  return roster.guests.find((g) => g.bookingId === bookingId);
}

function nameOf(guest: TargetGuest | undefined): string {
  const name = (guest?.name ?? '').trim();
  if (name) return name;
  return '이름 미상';
}

/** "3번 Massimo" — 좌석이 있으면 좌석을 앞에 둔다(가이드가 좌석으로 사람을 찾는다). */
export function guestLabel(guest: TargetGuest | undefined): string {
  if (!guest) return '이름 미상';
  const name = nameOf(guest);
  return typeof guest.seat === 'number' && guest.seat > 0 ? `${guest.seat}번 ${name}` : name;
}

/** 컴포저 상단 대상 칩. 전체·개인·복수가 **한눈에 달라 보여야** 한다. */
export function targetChipLabel(target: MessageTarget, roster: TargetRoster): string {
  if (target.kind === 'all') return `전체 ${roster.total}명`;
  if (target.bookingIds.length === 0) return `전체 ${roster.total}명`;
  if (target.bookingIds.length === 1) return guestLabel(guestOf(roster, target.bookingIds[0]));
  return `선택 ${target.bookingIds.length}명`;
}

/**
 * 전송 버튼 라벨. 칩만 바뀌고 버튼이 그대로면 손가락은 버튼만 본다 —
 * 오발송이 실제로 일어나는 경로가 그것이다.
 */
export function sendButtonLabel(target: MessageTarget, roster: TargetRoster): string {
  if (target.kind === 'all' || target.bookingIds.length === 0) return '전체에게 보내기';
  if (target.bookingIds.length === 1) return `${nameOf(guestOf(roster, target.bookingIds[0]))}에게 보내기`;
  return `${target.bookingIds.length}명에게 보내기`;
}

/** 색·아이콘 분기용. 'all'과 나머지가 **같은 색이면 안 된다**(B3-D3). */
export function targetTone(target: MessageTarget): 'all' | 'direct' | 'selected' {
  if (target.kind === 'all' || target.bookingIds.length === 0) return 'all';
  return target.bookingIds.length === 1 ? 'direct' : 'selected';
}

/**
 * 라우트에 보낼 조각. **`kind:'all'`일 때만 `bookingIds`가 빠진다.**
 *
 * 🔴 B3.5 — 선택 상태인데 배열이 비었으면 `{}`(= 전체)를 돌려주지 않는다.
 * 빈 배열을 그대로 보내 서버가 404로 거절하게 한다. "대상을 못 찾았으니
 * 전체로 보낸다"는 폴백이 바로 이 트랙이 막으려는 사고다.
 */
export function targetPayload(target: MessageTarget): { bookingIds?: string[] } {
  if (target.kind === 'all') return {};
  return { bookingIds: target.bookingIds };
}

/**
 * 좌석/명단에서 사람을 눌렀을 때. 이미 들어 있으면 뺀다.
 *
 * 마지막 한 명을 빼면 **명시적으로 전체로 돌아간다** — 칩이 "전체 12명"으로
 * 바뀌므로 가이드가 상태 변화를 본다. 빈 선택 상태로 남겨두면 화면은
 * "선택 0명"인데 전송은 전체로 나가는 상태가 생긴다.
 */
export function toggleTarget(target: MessageTarget, bookingId: string): MessageTarget {
  if (!bookingId) return target;
  if (target.kind === 'all') return { kind: 'selected', bookingIds: [bookingId] };
  const has = target.bookingIds.includes(bookingId);
  const next = has ? target.bookingIds.filter((id) => id !== bookingId) : [...target.bookingIds, bookingId];
  return next.length === 0 ? ALL_TARGET : { kind: 'selected', bookingIds: next };
}

/** 한 사람만 대상으로 지정(게스트 카드의 [메시지] 진입점). */
export function targetOne(bookingId: string): MessageTarget {
  return bookingId ? { kind: 'selected', bookingIds: [bookingId] } : ALL_TARGET;
}

/** 픽업 그룹 등 여러 명을 한 번에 (B3-D6). */
export function targetMany(bookingIds: string[]): MessageTarget {
  const ids = [...new Set(bookingIds.filter(Boolean))];
  return ids.length === 0 ? ALL_TARGET : { kind: 'selected', bookingIds: ids };
}

/** 칩의 ✕. B3-D4 — 전송 후에는 초기화되지 않고, 이걸 눌러야 풀린다. */
export function clearTarget(): MessageTarget {
  return ALL_TARGET;
}

/**
 * B3-D4 — 룸/날짜를 벗어나면 초기화한다. 명단에 없는 예약이 대상으로 남아 있으면
 * 전송이 조용히 404가 되거나(서버가 막아주지만) 칩이 유령 이름을 보여준다.
 */
export function pruneTarget(target: MessageTarget, roster: TargetRoster): MessageTarget {
  if (target.kind === 'all') return target;
  const live = target.bookingIds.filter((id) => roster.guests.some((g) => g.bookingId === id));
  if (live.length === target.bookingIds.length) return target;
  return live.length === 0 ? ALL_TARGET : { kind: 'selected', bookingIds: live };
}

export function isTargeted(target: MessageTarget): boolean {
  return target.kind === 'selected' && target.bookingIds.length > 0;
}
