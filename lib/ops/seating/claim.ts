/**
 * Claim(이름 선택) 순수 로직 — AtoC 통합 플랜 §5.2 C-1/C-2.
 *
 * C-1 PII 최소화: 명단에는 마스킹 이름 + 인원만 노출 (연락처 절대 미노출).
 * C-2 오선택 방지 1단계: 확인 질문 = 예약 이메일 뒷자리 or 인원수.
 * DB 무의존 순수 함수 — claim 라우트와 테스트가 공유한다.
 */

export interface ClaimableBookingLike {
  contact_name: string | null;
  contact_email: string | null;
  number_of_guests: number | null;
}

/**
 * "Massimo Colombo" → "Massimo C." (C-1 마스킹 규약 — 데모/플랜 표기 동일).
 * 단일 단어 이름은 그대로, 빈 이름은 'Guest'.
 */
export function maskGuestName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Guest';
  const parts = trimmed.split(' ');
  if (parts.length === 1) return parts[0];
  const initials = parts
    .slice(1)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(' ');
  return `${parts[0]} ${initials}`;
}

export interface ClaimAnswer {
  /** 예약 이메일 뒷자리 (최소 3자 — @ 앞 local part 또는 전체 주소의 끝). */
  emailTail?: string | null;
  /** 예약 인원수. */
  partySize?: number | null;
}

/**
 * 확인 질문 검증 (C-2). 제공된 답 중 하나라도 맞으면 통과 — 둘 다 없으면 실패.
 * 이메일 비교는 대소문자 무시, local part 끝 또는 전체 주소 끝 매칭(유연성:
 * 게스트가 "n.rossi" / "rossi" / "gmail.com 앞부분" 중 무엇을 기억하든).
 */
export function verifyClaimAnswer(
  booking: ClaimableBookingLike,
  answer: ClaimAnswer | null | undefined,
): boolean {
  if (!answer) return false;

  const tail = (answer.emailTail ?? '').trim().toLowerCase();
  if (tail.length >= 3 && booking.contact_email) {
    const email = booking.contact_email.trim().toLowerCase();
    const localPart = email.split('@')[0] ?? '';
    if (localPart.endsWith(tail) || email.endsWith(tail)) return true;
  }

  const size = answer.partySize;
  if (
    typeof size === 'number' &&
    Number.isInteger(size) &&
    size > 0 &&
    booking.number_of_guests !== null &&
    size === booking.number_of_guests
  ) {
    return true;
  }

  return false;
}
