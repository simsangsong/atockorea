/**
 * Lead-guest authority (P-D13) — the ONE place that answers "is this actor the
 * lead guest of this booking?".
 *
 * Extracted verbatim from app/api/tour-rooms/[bookingId]/plan/route.ts when
 * §5.2 C-6 (동행자 개별 등록) added a second caller. Behaviour is unchanged;
 * having a single authority is the point — a companion device must fall on the
 * "not lead" side of EVERY lead gate, and that is only auditable if there is
 * one gate to audit.
 *
 * Verdict by actor kind:
 *   owner   → true   (the logged-in booking owner is always the lead)
 *   session → tour_room_participants.is_lead of the joined participant row
 *   token / guest / guide / driver / admin → false
 *
 * The DB row is the authority for `session` actors, not anything in the token:
 * a companion's participant row is created with is_lead=false and the join API
 * never promotes it, so a companion reads false here no matter what they send.
 */

import type { RoomActor, RoomDbClient } from '@/lib/tour-room/access';

export async function isLeadGuest(supabase: RoomDbClient, actor: RoomActor): Promise<boolean> {
  if (actor.kind === 'owner') return true;
  if (actor.kind !== 'session' || actor.role !== 'customer') return false;
  try {
    const { data } = await supabase
      .from('tour_room_participants')
      .select('is_lead')
      .eq('id', actor.sessionPayload.participantId)
      .maybeSingle();
    return Boolean((data as { is_lead?: boolean } | null)?.is_lead);
  } catch {
    return false;
  }
}
