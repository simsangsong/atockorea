/**
 * 리뷰 작성 가능 시각: 투어일(Asia/Seoul 달력) 당일 13:00 이후.
 * 투어일 이후 날짜에는 당일 시간과 무관하게 허용.
 */

export const REVIEW_OPEN_HOUR_SEOUL = 13;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeBookingTourDateYmd(tourDate: string | null | undefined): string | null {
  if (tourDate == null || String(tourDate).trim() === '') return null;
  const s = String(tourDate).trim();
  const ymd = s.includes('T') ? s.slice(0, 10) : s.slice(0, 10);
  return YMD_RE.test(ymd) ? ymd : null;
}

function seoulYmdAndMinutesSinceMidnight(now: Date): { ymd: string; minutesSinceMidnight: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const y = map.year ?? '';
  const m = map.month ?? '';
  const d = map.day ?? '';
  const ymd = `${y}-${m}-${d}`;
  const hh = Math.min(23, Math.max(0, parseInt(map.hour ?? '0', 10)));
  const mm = Math.min(59, Math.max(0, parseInt(map.minute ?? '0', 10)));
  return { ymd, minutesSinceMidnight: hh * 60 + mm };
}

/** 투어일 당일: 서울 13:00 이전이면 false. 투어일 이전이면 false. 투어일 이후면 true. */
export function isReviewWriteWindowOpen(tourDateYmd: string | null, now: Date = new Date()): boolean {
  if (!tourDateYmd || !YMD_RE.test(tourDateYmd)) return false;
  const { ymd: seoulToday, minutesSinceMidnight } = seoulYmdAndMinutesSinceMidnight(now);
  if (seoulToday < tourDateYmd) return false;
  if (seoulToday > tourDateYmd) return true;
  return minutesSinceMidnight >= REVIEW_OPEN_HOUR_SEOUL * 60;
}

/**
 * 운영자 지정 계정만: 위 시간 창(투어일 전·당일 오전 등)을 건너뜀. 다른 로그인은 영향 없음.
 * 예약 소유·completed 여부 등은 그대로 API에서 검증.
 */
const REVIEW_WRITE_WINDOW_BYPASS_EMAILS_LOWER = new Set(['simsangsong@gmail.com']);

export function isReviewWriteWindowBypassEmail(email: string | null | undefined): boolean {
  if (email == null || typeof email !== 'string') return false;
  return REVIEW_WRITE_WINDOW_BYPASS_EMAILS_LOWER.has(email.trim().toLowerCase());
}

/** 마이페이지 등: 로그인 이메일이 우회 목록이면 달력/시각 창 없이 작성 가능으로 표시(유효한 tour_date YMD 필요). */
export function isReviewWriteWindowOpenForViewer(
  tourDateYmd: string | null,
  viewerEmail: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (isReviewWriteWindowBypassEmail(viewerEmail)) {
    return !!(tourDateYmd && YMD_RE.test(tourDateYmd));
  }
  return isReviewWriteWindowOpen(tourDateYmd, now);
}

/** 서울 달력 기준 투어일이 오늘 이전이거나 오늘이면 true (미래 일정 제외). */
export function isTourDateOnOrBeforeSeoulToday(tourDateYmd: string | null, now: Date = new Date()): boolean {
  if (!tourDateYmd || !YMD_RE.test(tourDateYmd)) return false;
  const { ymd: seoulToday } = seoulYmdAndMinutesSinceMidnight(now);
  return tourDateYmd <= seoulToday;
}

export const REVIEW_WINDOW_NOT_OPEN_MESSAGE =
  'You can submit a review from 1:00 PM (Korea time) on your tour date, or any time after that day.';
