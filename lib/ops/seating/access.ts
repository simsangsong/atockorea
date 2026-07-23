/**
 * ops 좌석/체크인 라우트 공용 인가 게이트 — AtoC 통합 플랜 §5.3/§5.4.
 *
 * /api/ops/rooms/[roomId]/* 는 booking 단위가 아니라 룸(tour_rooms 행) 단위라
 * 기존 resolveRoomActor(booking 단위)를 그대로 못 쓴다. 대신 같은 자격 증명
 * 체계를 재사용해 룸 스코프로 판정한다:
 *
 *   - 개인 토큰 (scope 'booking', claim 시 발급 — §5.1 2층):
 *     토큰의 booking이 이 룸과 같은 (tour_id, tour_date)에 속하거나 룸의
 *     anchor booking 자체면 customer로 통과. → 조인투어에서 다른 예약의
 *     좌석판을 읽을 수는 있으나(같은 차를 타는 명단 — 설계상 공개 범위),
 *     쓰기는 라우트가 본인 booking_id로만 제한한다.
 *   - 가이드/기사 토큰 (scope 'tour-date'): 룸의 (tour_id, tour_date) 일치.
 *   - admin 로그인 쿠키.
 *
 * 토큰 검증·폐기 원장(tour_room_invites)·우선순위(token > admin)는 기존
 * lib/tour-room/access.ts와 동일 규약 — 함수 재사용, 복제 구현 금지.
 */

import type { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import type { RoomDbClient } from '@/lib/tour-room/access';
import { hashToken, verifyRoomToken, type RoomTokenPayload } from '@/lib/tour-room/token';

export interface OpsRoom {
  id: string;
  booking_id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string;
}

export interface OpsBooking {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  number_of_guests: number | null;
}

export const OPS_BOOKING_COLUMNS =
  'id, tour_id, tour_date, status, contact_name, contact_email, number_of_guests';

export type OpsRoomActor =
  | { role: 'customer'; bookingId: string; displayName: string; tokenPayload: RoomTokenPayload }
  | { role: 'guide' | 'driver'; displayName: string; tokenPayload: RoomTokenPayload }
  | { role: 'admin'; userId: string };

export type ResolveOpsRoomActorResult =
  | { ok: true; room: OpsRoom; actor: OpsRoomActor }
  | { ok: false; status: number; error: string };

export async function getOpsRoom(supabase: RoomDbClient, roomId: string): Promise<OpsRoom | null> {
  const { data, error } = await supabase
    .from('tour_rooms')
    .select('id, booking_id, tour_id, tour_date, status')
    .eq('id', roomId)
    .maybeSingle();
  if (error || !data) return null;
  return data as OpsRoom;
}

async function isTokenRevoked(supabase: RoomDbClient, token: string): Promise<boolean> {
  const { data } = await supabase
    .from('tour_room_invites')
    .select('id, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  return Boolean((data as { revoked_at?: string | null } | null)?.revoked_at);
}

function extractToken(req: NextRequest, explicit?: string | null): string | null {
  if (explicit) return explicit;
  const fromQuery = req.nextUrl?.searchParams?.get('rt');
  if (fromQuery) return fromQuery;
  return req.headers.get('x-tour-room-auth-token') ?? req.headers.get('x-tour-room-token');
}

/** 토큰이 이 룸의 (tour_id, tour_date) 스코프에 드는가? */
function tourDateTokenMatchesRoom(payload: RoomTokenPayload, room: OpsRoom): boolean {
  if (payload.scope !== 'tour-date') return false;
  return (
    Boolean(room.tour_id) &&
    payload.tourId === room.tour_id &&
    Boolean(room.tour_date) &&
    payload.tourDate === room.tour_date
  );
}

export async function resolveOpsRoomActor(
  req: NextRequest,
  supabase: RoomDbClient,
  roomId: string,
  options: { token?: string | null } = {},
): Promise<ResolveOpsRoomActorResult> {
  const room = await getOpsRoom(supabase, roomId);
  if (!room) return { ok: false, status: 404, error: 'Room not found' };

  // 1. Signed room token (기존 우선순위 규약: token > admin — view-as 다운그레이드).
  const token = extractToken(req, options.token);
  if (token) {
    const payload = verifyRoomToken(token);
    if (payload && !(await isTokenRevoked(supabase, token))) {
      if (payload.scope === 'booking') {
        // 개인 토큰: anchor booking이거나 같은 (tour_id, tour_date)의 예약.
        if (payload.bookingId === room.booking_id) {
          return {
            ok: true,
            room,
            actor: { role: 'customer', bookingId: payload.bookingId, displayName: payload.displayName, tokenPayload: payload },
          };
        }
        const { data } = await supabase
          .from('bookings')
          .select('id, tour_id, tour_date')
          .eq('id', payload.bookingId)
          .maybeSingle();
        const b = data as { id: string; tour_id: string | null; tour_date: string | null } | null;
        if (
          b &&
          Boolean(room.tour_id) &&
          b.tour_id === room.tour_id &&
          Boolean(room.tour_date) &&
          b.tour_date === room.tour_date
        ) {
          return {
            ok: true,
            room,
            actor: { role: 'customer', bookingId: b.id, displayName: payload.displayName, tokenPayload: payload },
          };
        }
      } else if (tourDateTokenMatchesRoom(payload, room)) {
        return {
          ok: true,
          room,
          actor: { role: payload.role as 'guide' | 'driver', displayName: payload.displayName, tokenPayload: payload },
        };
      }
    }
    // 무효/폐기/스코프 불일치 토큰은 fall-through — admin 쿠키가 남아 있을 수 있다.
  }

  // 2. Admin 로그인.
  const user = await getAuthUser(req);
  if (user?.role === 'admin') {
    return { ok: true, room, actor: { role: 'admin', userId: user.id } };
  }

  return { ok: false, status: 403, error: 'Access denied for this room' };
}

/** 가이드/기사/admin만 통과시키는 편의 가드 (체크인 수동·노쇼·게이트 라우트). */
export function isStaffActor(actor: OpsRoomActor): boolean {
  return actor.role === 'guide' || actor.role === 'driver' || actor.role === 'admin';
}
