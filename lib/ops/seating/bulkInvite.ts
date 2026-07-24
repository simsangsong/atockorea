/**
 * 조인투어 룸 초대 이메일 일괄 발송 — AtoC 통합 플랜 §4.2① + §5.1,
 * 감사 플랜 §K B0.3으로 **개인 링크 전환**.
 *
 * ── 무엇이 바뀌었나 (B0-D1) ─────────────────────────────────────────────────
 * 이전: 룸 초대(claim) 링크 **1개**를 발급해 전원에게 **같은 URL**을 보냈다.
 *       손님은 링크를 열고 명단에서 자기 이름을 골라야 했다(claim).
 * 지금: 이메일이 있는 예약마다 **그 예약의 개인 토큰 링크**를 보낸다.
 *
 * claim 단계는 원래 "wa.me는 1:1이라 일괄 발송이 안 된다"는 제약의 산물인데,
 * **이메일 일괄 발송에는 그 제약이 없다.** 링크가 개인 것이면 이름 선택·확인
 * 질문·오선택·C-5 탈취가 전부 소멸한다.
 *
 * 새 방식을 발명하지 않는다: 개인 토큰 발급은 `/api/admin/tour-ops/links`가
 * 이미 검증한 경로(`signCustomerRoomToken` + `hashToken` + `tour_room_invites`)와
 * 같은 모양이다.
 *
 * ── B0-D1c 폐기-후-재발급 ───────────────────────────────────────────────────
 * 🔴 원래 플랜은 "살아있는 유효 토큰이 있으면 재사용"이었는데 **구현이 불가능
 * 하다**: `signCustomerRoomToken`이 payload에 `iat`를 넣어 매번 다른 토큰이
 * 나오고, 원장에 남는 것은 `hashToken()` 단방향 해시뿐이라 되살릴 평문이 없다
 * (A-plan-review R7). 그래서 재사용이 아니라 **폐기-후-재발급**을 한다:
 * 재발송할 때마다 그 예약의 살아있는 초대를 전부 `revoked_at`으로 무효화하고
 * 새로 1개 발급한다. 결과적으로 예약당 살아있는 토큰이 **항상 1개**로 수렴하고,
 * C-5 탈취 대응("어느 기기를 끊나")이 자명해진다 — D1c의 원래 목표를 더 강하게
 * 달성한다. `/dispatch-room`이 이미 같은 규칙으로 산다.
 *
 * ⚠ 부작용은 의도된 것이다: 재발송하면 먼저 받은 손님의 **기존 링크가 죽는다**.
 *
 * ── B0-D2 claim은 폴백으로 강등 ─────────────────────────────────────────────
 * 이메일이 없는 예약(OTA 프록시·마스킹 주소)은 여전히 존재한다. 그들을 위해
 * claim 링크는 **계속 발급**하되, 이제 발송이 아니라 **운영자가 쓰는 폴백**이다
 * (차량 부착 QR, 링크를 못 받은 게스트). 폴백을 지우면 그 손님은 들어올 방법이
 * 없어진다.
 *
 * 순수 코어 함수(buildBulkInvite)로 뽑아 send/supabase를 주입받게 했다 —
 * 테스트는 fake send + fake supabase만으로 네트워크·DB 0으로 검증한다.
 */

import { hashToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { signRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { buildInviteEmail } from '@/lib/ops/seating/inviteEmailCopy';

/** 최소한의 Supabase 계약 — from(table)만 쓴다(주입/모킹 용이). */
export interface BulkInviteDb {
  from(table: string): {
    select: (...args: unknown[]) => any;
    insert: (payload: unknown, ...args: unknown[]) => any;
    update: (payload: unknown, ...args: unknown[]) => any;
  };
}

/** 주입 가능한 이메일 sender — 기본은 라우트가 lib/email.sendEmail을 넘긴다. */
export type InviteSend = (msg: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) => Promise<{ success: boolean; error?: string; messageId?: string }>;

export interface BulkInviteDeps {
  supabase: BulkInviteDb;
  adminId: string;
  tourId: string;
  tourDate: string;
  tourTitle?: string | null;
  send: InviteSend;
  /** 타임스탬프 결정론용(테스트). 기본 Date.now(). */
  now?: number;
}

export interface BulkInviteResult {
  /** B0-D2 폴백용 claim 링크. 이제 발송되지 않고 운영자가 쓴다. */
  url: string;
  expires_at: string;
  /** 개인 링크를 실제로 받은 게스트 수. */
  sent: number;
  /** 개인 링크를 보냈다는 사실을 명시 — 화면이 두 종류를 구분해 표기한다(B0.3). */
  sentPersonal: number;
  /** 이메일이 없어 claim 폴백이 필요한 게스트 수. */
  skippedNoEmail: number;
  failed: number;
  /** 폐기-후-재발급으로 무효화된 이전 링크 수(B0-D1c). */
  revokedPrevious: number;
}

export type BulkInviteOutcome =
  | { ok: true; result: BulkInviteResult }
  | { ok: false; status: number; error: string };

interface AnchorRoomRow {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
}

interface RosterRow {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  preferred_language: string | null;
  status: string | null;
  tour_date: string | null;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

async function toList<T>(builder: unknown): Promise<T[]> {
  const { data } = (await (builder as Promise<{ data: unknown }>)) ?? { data: [] };
  return (Array.isArray(data) ? data : data ? [data] : []) as T[];
}

/**
 * B0-D1c — 이 예약의 살아있는 고객 초대를 전부 무효화한다.
 * `lib/tour-room/dispatch.ts`의 revokeScope와 같은 규칙(같은 컬럼·같은 조건)이다.
 * 실패해도 던지지 않는다: 폐기가 안 됐다고 발송을 막으면 손님이 링크를 못 받는다.
 */
async function revokeLivePersonalInvites(
  supabase: BulkInviteDb,
  bookingId: string,
  nowIso: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from('tour_room_invites')
      .update({ revoked_at: nowIso })
      .is('revoked_at', null)
      .eq('booking_id', bookingId)
      .eq('role', 'customer')
      .select('id');
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * 코어: 앵커 룸 해석 → claim 폴백 링크 1개 발급(원장) → 이메일 있는 게스트마다
 * 폐기-후-재발급으로 **개인 링크** 발송 + 원장. 발송 하나가 던져도 배치는 계속된다.
 */
export async function buildBulkInvite(deps: BulkInviteDeps): Promise<BulkInviteOutcome> {
  const { supabase, adminId, tourId, tourDate, send } = deps;
  const nowMs = deps.now ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1) 앵커 룸 — (tour_id, tour_date) 룸이 하나라도 있어야 한다(§5.1 스코프).
  const rooms = await toList<AnchorRoomRow>(
    supabase.from('tour_rooms').select('id, tour_id, tour_date').eq('tour_id', tourId).eq('tour_date', tourDate).limit(1),
  );
  const room = rooms[0];
  if (!room || !room.id) {
    return { ok: false, status: 409, error: 'no room for tour scope' };
  }

  // 2) B0-D2 — claim 링크는 **폴백**으로 계속 발급한다(이메일 없는 예약·차량 QR).
  //    발송하지는 않는다.
  const { token: claimToken, payload: claimPayload } = signRoomClaimToken({ roomId: room.id, tourId, tourDate });
  const claimExpiresAt = new Date(claimPayload.exp * 1000).toISOString();

  const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
    role: 'room_claim',
    token_hash: hashToken(claimToken),
    sent_via: 'ops-link',
    created_by: adminId,
    tour_id: tourId,
    tour_date: tourDate,
    display_name: '룸 초대 폴백 (이메일 없는 예약용)',
    expires_at: claimExpiresAt,
  });
  if (ledgerError) throw ledgerError;

  const claimUrl = `${appUrl()}/tour-mode/join/${encodeURIComponent(claimToken)}`;

  // 3) 게스트 로드(취소 제외).
  const roster = await toList<RosterRow>(
    supabase
      .from('bookings')
      .select('id, contact_name, contact_email, preferred_language, status, tour_date')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .neq('status', 'cancelled'),
  );

  let sent = 0;
  let skippedNoEmail = 0;
  let failed = 0;
  let revokedPrevious = 0;

  for (const booking of roster) {
    const email = (booking.contact_email ?? '').trim();
    if (!email) {
      // B0-D2 — claim 폴백 대상. 실패가 아니라 다른 경로다.
      skippedNoEmail += 1;
      continue;
    }
    // 발송 + 원장을 한 try로 감싼다 — 하나가 던져도 배치는 계속(§ 요구사항).
    try {
      // B0-D1c: 먼저 폐기. 발급 후에 폐기하면 방금 만든 것까지 지운다.
      revokedPrevious += await revokeLivePersonalInvites(supabase, booking.id, nowIso);

      const minted = signCustomerRoomToken({
        bookingId: booking.id,
        displayName: booking.contact_name || 'Guest',
        tourDate: booking.tour_date || tourDate,
      });
      const expiresAt = new Date(minted.payload.exp * 1000).toISOString();
      const personalUrl = `${appUrl()}/tour-mode/room/${booking.id}?rt=${encodeURIComponent(minted.token)}`;

      const content = buildInviteEmail(booking.preferred_language, {
        guestName: booking.contact_name ?? '',
        tourTitle: deps.tourTitle ?? '',
        tourDate,
        inviteUrl: personalUrl,
      });
      const result = await send({
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      if (!result || result.success === false) {
        failed += 1;
        continue;
      }

      // 원장 1행이 이제 **두 가지를 동시에** 한다:
      //   ① 실제 개인 토큰 (claim 가능한 살아있는 초대)
      //   ② 발송 기록 — 일일 보고서 §4가 이메일 연락으로 집계
      //      (daily.ts buildContactStatus: role='customer' + booking_id,
      //       emailed = sent_via==='email' || Boolean(sent_to))
      //
      // 이전 구현은 공유 claim 링크를 보내느라 "born-revoked 마커"라는
      // 합성 행을 따로 넣어야 했다(토큰이 개인 것이 아니었으므로 살아있는
      // 초대로 세면 거짓말이 됐다). 개인 링크로 바뀌면서 그 우회가 사라진다 —
      // 이제는 revoked_at을 비워두는 것이 **사실**이다.
      const { error: inviteError } = await supabase.from('tour_room_invites').insert({
        role: 'customer',
        booking_id: booking.id,
        token_hash: hashToken(minted.token),
        sent_via: 'email',
        sent_to: email,
        display_name: booking.contact_name || 'Guest',
        tour_id: tourId,
        tour_date: tourDate,
        created_by: adminId,
        expires_at: expiresAt,
      });
      if (inviteError) throw inviteError;
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    ok: true,
    result: {
      url: claimUrl,
      expires_at: claimExpiresAt,
      sent,
      sentPersonal: sent,
      skippedNoEmail,
      failed,
      revokedPrevious,
    },
  };
}
