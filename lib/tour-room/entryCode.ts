/**
 * 입장 코드 — 345자 토큰 링크를 사람이 다룰 수 있는 코드/짧은 링크로 바꾸는 레이어
 * (docs/smart-guide-entry-code-master-plan-2026-08-08 §C, 사장님 결정 2026-08-08).
 *
 * 한 리졸버(resolveEntryCode)가 세 종류의 자격을 받는다 — 입력창도 하나, /r/ 문도 하나:
 *
 *   ① bookings.booking_reference  'A2C-XXXXXXXX'
 *      예약의 상설 코드. 재발송해도 죽지 않는다(항공사 PNR 모델). 확인 메일·바우처에
 *      인쇄되는 값이라, 이것만으로 입장 가능한 것은 OTA 예약번호 입장과 같은 결정이다.
 *   ② tour_room_invites.short_code  (10자, 무혼동 알파벳)
 *      "발송된 초대 1건"의 별칭. 그 행이 revoke 되면 별칭도 죽는다 — 재발송
 *      폐기-후-재발급(B0-D1c)·예약 취소 훅(§O-1 ⑧)의 기존 revoke 규칙이 그대로
 *      짧은 링크의 수명이 된다. guide/driver 의 tour-date 스코프도 이 별칭을 쓴다.
 *   ③ bookings.external_booking_id  (Klook/GYG/Viator/KKday… — 사장님 "다 포함")
 *      손님이 OTA 바우처에 이미 들고 있는 예약번호. 이 문이 열리는 순간
 *      "링크를 보낸다"는 작업 자체가 사라진다(§C-3 끝그림).
 *
 * 판정 순서는 ①→②→③ 고정이다. ②를 ③보다 먼저 보는 이유: 우리가 발급한 별칭이
 * 우연히 어느 OTA 번호와 겹쳐도 우리 별칭이 이긴다(우리 네임스페이스가 우선).
 *
 * 토큰 서명은 여기서 하지 않는다 — 서명·만료·검증은 token.ts 한 곳(§O-13 회전 포함)이고,
 * 이 모듈은 "코드 → 어느 예약/스코프인가"만 판정한다. 라우트가 기존 mint 함수를 부른다.
 */

import { randomInt } from 'node:crypto';
import { roomTokenExpiryForTourDate } from '@/lib/tour-room/token';
import type { RoomDbClient } from '@/lib/tour-room/access';

/**
 * tour_room_invites.sent_via 가 라이브 CHECK 제약에서 허용하는 전체 값.
 * 🔴 여기 추가하려면 마이그레이션으로 CHECK 를 먼저 넓혀야 한다 —
 * 'onsite-qr'·'ops-bulk-message' 는 코드가 먼저 쓰고 CHECK 가 라이브에서 조용히
 * 거부해 온 사고였다(20260808090000 에서 수복). 상설 게이트
 * __tests__/audit/entryCodeDoors.test.ts 가 소스의 sent_via 리터럴을 이 목록과 대조한다.
 */
export const INVITE_SENT_VIA = [
  'email',
  'sms',
  'manual',
  'ops-link',
  'qr',
  'onsite-qr',
  'ops-bulk-message',
  'entry-code',
] as const;
export type InviteSentVia = (typeof INVITE_SENT_VIA)[number];

/** 무혼동 알파벳 — 0/O·1/I/L·U(V 오독) 제외. 30자 × 10자리 ≈ 49bit. */
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const SHORT_CODE_LENGTH = 10;

/** 발송 1건의 짧은 별칭. 원장 행과 함께 저장하고 /r/{code} 가 되찾는다. */
export function generateInviteShortCode(): string {
  let out = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i += 1) {
    out += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)];
  }
  return out;
}

/** 대문자·공백 제거. 하이픈은 남긴다(A2C-… 검출은 하이픈 유무 모두 받는다). */
export function normalizeEntryInput(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

const BOOKING_REF_SHAPE = /^A2C-?([0-9A-F]{8})$/;

/** 'a2c 3F9A2B1C' → 'A2C-3F9A2B1C'. 예약 코드 모양이 아니면 null. */
export function canonicalBookingReference(normalized: string): string | null {
  const m = BOOKING_REF_SHAPE.exec(normalized);
  return m ? `A2C-${m[1]}` : null;
}

export interface EntryBookingRow {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string | null;
  contact_name: string | null;
  preferred_language: string | null;
  booking_reference: string | null;
}

export interface EntryInviteRow {
  id: string;
  role: string;
  booking_id: string | null;
  tour_id: string | null;
  tour_date: string | null;
  display_name: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  short_code: string | null;
}

export type EntryResolution =
  | { kind: 'booking'; booking: EntryBookingRow; via: 'reference' | 'external' }
  | { kind: 'staff'; role: 'guide' | 'driver'; tourId: string; tourDate: string; displayName: string | null }
  | { kind: 'invite-booking'; booking: EntryBookingRow; inviteId: string }
  | { kind: 'error'; code: 'not_found' | 'expired' | 'revoked' };

const BOOKING_COLUMNS =
  'id, tour_id, tour_date, status, contact_name, preferred_language, booking_reference';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 예약이 지금 입장 가능한 상태인가. 취소는 'not_found' 로 뭉갠다 — 코드만 들고
 * 온 사람에게 취소 사실을 새로 알려 주지 않는다(열거 표면 최소화). 투어일이
 * 지난 예약은 'expired' — 자기 진짜 코드를 친 손님에게는 정직한 답이 낫다.
 */
function validateBooking(booking: EntryBookingRow): 'ok' | 'not_found' | 'expired' {
  if (!booking.tour_date) return 'not_found';
  if (booking.status === 'cancelled') return 'not_found';
  try {
    if (roomTokenExpiryForTourDate(booking.tour_date) < nowSeconds()) return 'expired';
  } catch {
    return 'not_found';
  }
  return 'ok';
}

async function maybeRow<T>(builder: unknown): Promise<T | null> {
  const { data } = ((await (builder as Promise<{ data: unknown }>)) ?? { data: null }) as {
    data: unknown;
  };
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return (data as T) ?? null;
}

async function allRows<T>(builder: unknown): Promise<T[]> {
  const { data } = ((await (builder as Promise<{ data: unknown }>)) ?? { data: [] }) as {
    data: unknown;
  };
  return (Array.isArray(data) ? data : data ? [data] : []) as T[];
}

/** ilike 는 %·_ 가 와일드카드다 — 이스케이프 없이 넘기면 패턴 검색이 된다. */
function escapeIlike(value: string): string {
  return value.replace(/([%_\\])/g, '\\$1');
}

/**
 * 코드 → 예약/스코프 판정. DB 쓰기는 하지 않는다(토큰 발급·원장 기록은 라우트 몫).
 * 실패는 전부 균일한 'not_found' 가 기본이고, 한때 유효했던 자격에만
 * 'expired'/'revoked' 를 준다.
 */
export async function resolveEntryCode(
  supabase: RoomDbClient,
  raw: unknown,
): Promise<EntryResolution> {
  const normalized = normalizeEntryInput(raw);
  if (!normalized || normalized.length < 4 || normalized.length > 40) {
    return { kind: 'error', code: 'not_found' };
  }

  // ① 상설 예약 코드 (A2C-XXXXXXXX)
  const reference = canonicalBookingReference(normalized);
  if (reference) {
    const booking = await maybeRow<EntryBookingRow>(
      supabase.from('bookings').select(BOOKING_COLUMNS).eq('booking_reference', reference).maybeSingle(),
    );
    if (!booking) return { kind: 'error', code: 'not_found' };
    const verdict = validateBooking(booking);
    if (verdict !== 'ok') return { kind: 'error', code: verdict === 'expired' ? 'expired' : 'not_found' };
    return { kind: 'booking', booking, via: 'reference' };
  }

  // ② 발송 별칭 (tour_room_invites.short_code)
  if (normalized.length === SHORT_CODE_LENGTH && !normalized.includes('-')) {
    const invite = await maybeRow<EntryInviteRow>(
      supabase
        .from('tour_room_invites')
        .select('id, role, booking_id, tour_id, tour_date, display_name, expires_at, revoked_at, short_code')
        .eq('short_code', normalized)
        .maybeSingle(),
    );
    if (invite) {
      if (invite.revoked_at) return { kind: 'error', code: 'revoked' };
      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        return { kind: 'error', code: 'expired' };
      }
      if ((invite.role === 'guide' || invite.role === 'driver') && invite.tour_id && invite.tour_date) {
        return {
          kind: 'staff',
          role: invite.role,
          tourId: invite.tour_id,
          tourDate: invite.tour_date,
          displayName: invite.display_name,
        };
      }
      if ((invite.role === 'customer' || invite.role === 'companion') && invite.booking_id) {
        const booking = await maybeRow<EntryBookingRow>(
          supabase.from('bookings').select(BOOKING_COLUMNS).eq('id', invite.booking_id).maybeSingle(),
        );
        if (!booking) return { kind: 'error', code: 'not_found' };
        const verdict = validateBooking(booking);
        if (verdict !== 'ok') {
          return { kind: 'error', code: verdict === 'expired' ? 'expired' : 'not_found' };
        }
        return { kind: 'invite-booking', booking, inviteId: invite.id };
      }
      // room_claim 등 다른 role 의 별칭은 이 문으로 열지 않는다.
      return { kind: 'error', code: 'not_found' };
    }
  }

  // ③ OTA 예약번호 (source 무관 — Klook/GYG/Viator/KKday…)
  const matches = await allRows<EntryBookingRow>(
    supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .ilike('external_booking_id', escapeIlike(normalized))
      .limit(2),
  );
  if (matches.length === 1) {
    const verdict = validateBooking(matches[0]);
    if (verdict !== 'ok') return { kind: 'error', code: verdict === 'expired' ? 'expired' : 'not_found' };
    return { kind: 'booking', booking: matches[0], via: 'external' };
  }
  if (matches.length > 1) {
    // 소스가 다른 두 OTA 가 같은 번호를 쓰는 극단 — 어느 쪽도 열지 않는다.
    console.warn('[entry-code] ambiguous external booking id (2+ sources); refusing to resolve');
  }
  return { kind: 'error', code: 'not_found' };
}

/**
 * 예약의 상설 코드를 보장한다 — 없으면 지금 만든다(빌더 예약만 채우던 것을
 * 발송·표시 시점에 지연 발급으로 전면화). 경합 안전: UNIQUE 인덱스가 심판이고,
 * 졌으면 이긴 쪽 값을 다시 읽는다. 실패는 null — 코드 없이도 링크는 나가야 한다.
 */
export async function ensureBookingReference(
  supabase: RoomDbClient,
  bookingId: string,
): Promise<string | null> {
  try {
    const existing = await maybeRow<{ booking_reference: string | null }>(
      supabase.from('bookings').select('booking_reference').eq('id', bookingId).maybeSingle(),
    );
    if (existing?.booking_reference) return existing.booking_reference;
    if (existing === null) return null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let candidate = 'A2C-';
      for (let i = 0; i < 8; i += 1) candidate += '0123456789ABCDEF'[randomInt(16)];
      const { data, error } = await supabase
        .from('bookings')
        .update({ booking_reference: candidate })
        .eq('id', bookingId)
        .is('booking_reference', null)
        .select('booking_reference');
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.booking_reference) return row.booking_reference as string;
        // 0행 갱신 = 다른 프로세스가 먼저 채웠다 — 그 값을 읽는다.
        const winner = await maybeRow<{ booking_reference: string | null }>(
          supabase.from('bookings').select('booking_reference').eq('id', bookingId).maybeSingle(),
        );
        return winner?.booking_reference ?? null;
      }
      // UNIQUE 충돌(다른 예약이 같은 후보를 선점) — 새 후보로 재시도.
    }
    return null;
  } catch {
    return null;
  }
}

/** 짧은 링크 조립 한 곳 — 발급 4지점이 전부 이 함수를 쓴다(드리프트 방지). */
export function shortLinkUrl(base: string, shortCode: string, to?: 'plan'): string {
  const root = base.replace(/\/$/, '');
  return `${root}/r/${shortCode}${to === 'plan' ? '?to=plan' : ''}`;
}
// 확인 카드의 이름 마스킹은 lib/ops/seating/claim.ts 의 maskGuestName(C-1 규약)을
// 그대로 쓴다 — 두 벌을 만들면 표기가 갈라진다(SLUG_OVERRIDES 교훈).
