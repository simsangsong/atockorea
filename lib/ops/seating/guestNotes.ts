/**
 * §K B4 — 명단 메모. 순수부.
 *
 * 🔴 B4-D1 — 메모는 손님이 선언한 `needs`와 **분리된 채로 남아야 한다.**
 * 이 모듈은 `needs`를 읽지도 쓰지도 않는다. 두 값이 한 화면에 나란히 보이는
 * 것은 괜찮지만, 한 필드로 합쳐지는 순간 "알레르기 있음"이 누구 말인지
 * 알 수 없어지고 그 표시를 믿을 수 없게 된다.
 */

export const GUEST_NOTE_MAX = 500;

export type NoteAuthorRole = 'guide' | 'driver' | 'admin';

export interface GuestNote {
  bookingId: string;
  note: string;
  updatedByRole: NoteAuthorRole;
  updatedByName: string | null;
  updatedAt: string;
}

/**
 * 저장 전 정규화. 앞뒤 공백 제거 + 길이 제한 + 줄바꿈 정리.
 *
 * 빈 문자열은 **삭제 의도**로 본다(null 반환) — 메모를 지우는 버튼을 따로
 * 만들지 않고, 내용을 비우면 사라지는 것이 운전 중에도 되는 동작이다.
 */
export function normalizeNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, GUEST_NOTE_MAX);
}

/** 명단 행에 들어갈 한 줄 요약. 행이 두 줄이 되면 명단이 한눈에 안 들어온다. */
export function noteSummary(note: string | null | undefined, max = 24): string {
  const text = (note ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function hasNote(note: string | null | undefined): boolean {
  return Boolean((note ?? '').trim());
}

const ROLE_LABEL: Record<NoteAuthorRole, string> = {
  guide: '가이드',
  driver: '기사',
  admin: '운영',
};

/**
 * "가이드 박 · 방금" 같은 출처 표기.
 *
 * 🔴 출처를 지우지 않는다. 메모는 사실이 아니라 **누군가의 관찰**이고,
 * 누가 언제 썼는지가 그걸 얼마나 믿을지를 정한다.
 */
export function noteAttribution(
  note: Pick<GuestNote, 'updatedByRole' | 'updatedByName' | 'updatedAt'> | null | undefined,
  nowMs = Date.now(),
): string {
  if (!note) return '';
  const who = (note.updatedByName ?? '').trim();
  const role = ROLE_LABEL[note.updatedByRole] ?? '운영';
  const label = who ? `${role} ${who}` : role;
  const when = relativeKo(note.updatedAt, nowMs);
  return when ? `${label} · ${when}` : label;
}

function relativeKo(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diffMin = Math.floor((nowMs - t) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

/** 토큰 role → 메모 작성자 role. 손님은 메모를 쓸 수 없다. */
export function noteRoleFor(role: string | null | undefined): NoteAuthorRole | null {
  if (role === 'guide' || role === 'driver' || role === 'admin') return role;
  return null;
}
