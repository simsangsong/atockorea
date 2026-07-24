/**
 * 조인투어 룸 초대 링크 이메일 일괄 발송 — AtoC 통합 플랜 §4.2① + §5.1.
 *
 * (tour_id, tour_date) 룸의 모든 게스트에게 룸 초대(claim) 링크를 한 번에
 * 이메일로 보낸다. 링크 발급은 claim-link 라우트와 동일 로직을 미러링한다
 * (signRoomClaimToken + hashToken + tour_room_invites role='room_claim' 원장).
 * 발송당 게스트별 마커 행을 tour_room_invites에 남겨 일일 보고서 §4 연락현황이
 * 이메일 연락으로 집계하게 한다(아래 마커 shape 주석 참고).
 *
 * 순수 코어 함수(buildBulkInvite)로 뽑아 send/supabase를 주입받게 했다 —
 * 테스트는 fake send + fake supabase만으로 네트워크·DB 0으로 검증한다.
 * 실제 이메일 발송(lib/email.sendEmail)은 라우트가 주입한다.
 */

import { randomUUID } from 'node:crypto';
import { hashToken } from '@/lib/tour-room/token';
import { signRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { buildInviteEmail } from '@/lib/ops/seating/inviteEmailCopy';

/** 최소한의 Supabase 계약 — from(table)만 쓴다(주입/모킹 용이). */
export interface BulkInviteDb {
  from(table: string): {
    select: (...args: unknown[]) => any;
    insert: (payload: unknown, ...args: unknown[]) => any;
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
  /** 마커 revoked_at 타임스탬프 결정론용(테스트). 기본 Date.now(). */
  now?: number;
}

export interface BulkInviteResult {
  url: string;
  expires_at: string;
  sent: number;
  skippedNoEmail: number;
  failed: number;
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
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

async function toList<T>(builder: unknown): Promise<T[]> {
  const { data } = (await (builder as Promise<{ data: unknown }>)) ?? { data: [] };
  return (Array.isArray(data) ? data : data ? [data] : []) as T[];
}

/**
 * 코어: 앵커 룸 해석 → 룸 초대 링크 1개 발급(원장) → 이메일 있는 게스트에게
 * 순차 발송 + 게스트별 마커 원장. 발송 하나가 던져도 배치는 계속된다.
 */
export async function buildBulkInvite(deps: BulkInviteDeps): Promise<BulkInviteOutcome> {
  const { supabase, adminId, tourId, tourDate, send } = deps;
  const nowMs = deps.now ?? Date.now();

  // 1) 앵커 룸 — (tour_id, tour_date) 룸이 하나라도 있어야 한다(§5.1 스코프).
  const rooms = await toList<AnchorRoomRow>(
    supabase.from('tour_rooms').select('id, tour_id, tour_date').eq('tour_id', tourId).eq('tour_date', tourDate).limit(1),
  );
  const room = rooms[0];
  if (!room || !room.id) {
    return { ok: false, status: 409, error: 'no room for tour scope' };
  }

  // 2) 룸 초대(claim) 링크 1개 발급 + 원장(claim-link 라우트 미러링).
  const { token, payload } = signRoomClaimToken({ roomId: room.id, tourId, tourDate });
  const expiresAt = new Date(payload.exp * 1000).toISOString();

  const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
    role: 'room_claim',
    token_hash: hashToken(token),
    sent_via: 'ops-link',
    created_by: adminId,
    tour_id: tourId,
    tour_date: tourDate,
    display_name: '룸 초대 (이메일 일괄)',
    expires_at: expiresAt,
  });
  if (ledgerError) throw ledgerError;

  const url = `${appUrl()}/tour-mode/join/${encodeURIComponent(token)}`;

  // 3) 게스트 로드(취소 제외).
  const roster = await toList<RosterRow>(
    supabase
      .from('bookings')
      .select('id, contact_name, contact_email, preferred_language, status')
      .eq('tour_id', tourId)
      .eq('tour_date', tourDate)
      .neq('status', 'cancelled'),
  );

  let sent = 0;
  let skippedNoEmail = 0;
  let failed = 0;

  for (const booking of roster) {
    const email = (booking.contact_email ?? '').trim();
    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    // 발송 + 마커를 한 try로 감싼다 — 하나가 던져도 배치는 계속(§ 요구사항).
    try {
      const content = buildInviteEmail(booking.preferred_language, {
        guestName: booking.contact_name ?? '',
        tourTitle: deps.tourTitle ?? '',
        tourDate,
        inviteUrl: url,
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

      // 게스트별 마커 원장 — 일일 보고서 §4가 이메일 연락으로 집계하도록:
      //   daily.ts buildContactStatus: .eq('role','customer').in('booking_id',…)
      //   그리고 emailed = (sent_via === 'email' || Boolean(sent_to)).
      // 따라서 role='customer' + booking_id + sent_via='email' + sent_to.
      // revoked_at을 발급 시점에 세팅(born-revoked): §4는 revoked_at을 보지
      //   않으므로 여전히 집계되지만, dispatch.hasActiveCustomerInvite처럼
      //   `.is('revoked_at', null)`로 살아있는 개인 초대를 세는 소비처에는 잡히지
      //   않는다 — 이 행은 발송 로그 마커이지 claim 가능한 실제 개인 토큰이
      //   아니기 때문(token_hash도 합성 유니크값, 실제 토큰과 절대 불일치).
      const { error: markerError } = await supabase.from('tour_room_invites').insert({
        role: 'customer',
        booking_id: booking.id,
        token_hash: hashToken(`ops-email-marker:${booking.id}:${randomUUID()}`),
        sent_via: 'email',
        sent_to: email,
        display_name: booking.contact_name,
        tour_id: tourId,
        tour_date: tourDate,
        created_by: adminId,
        expires_at: expiresAt,
        revoked_at: new Date(nowMs).toISOString(),
      });
      if (markerError) throw markerError;
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, result: { url, expires_at: expiresAt, sent, skippedNoEmail, failed } };
}
