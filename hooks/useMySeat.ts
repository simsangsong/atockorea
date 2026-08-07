'use client';

/**
 * "내 좌석" — one read, two consumers.
 *
 * 🔴 Why this is a hook and not a fetch inside the card.
 *
 * The seat card owned its own `my-seat` fetch AND its own picker sheet. That
 * was fine while the card was the only door. It is not the only door any more:
 * the home tile grid needs to open the same picker (the owner's requirement is
 * that a guest can reach their seat at check-in, the night before, and at any
 * point during the tour — a card you have to scroll to is not "any point").
 *
 * A tile cannot open a sheet that lives inside a sibling's closure, and giving
 * the card a second fetch would put two answers about one seat on one screen.
 * So the read moves up: HomeTab holds it, the card renders it, the tile opens
 * the sheet HomeTab owns.
 *
 * The personal token is resolved here too, for the same reason — `can_pick` is
 * the SERVER's verdict on the rules, but the picker additionally needs a
 * booking-scope credential, and the room session is not one. Both consumers
 * must agree on whether the door is openable, so the AND happens once.
 */

import { useCallback, useEffect, useState } from 'react';
import { readStoredPersonalTokens, findRecognizedToken } from '@/lib/ops/seating/personalTokens';
import type { MySeatState } from '@/app/api/tour-rooms/[bookingId]/my-seat/route';

export interface MySeat {
  state: MySeatState;
  seat_number: number | null;
  plate_number: string | null;
  can_pick: boolean;
  room_id: string | null;
  party_size: number;
}

export interface UseMySeat {
  /** null until the first answer lands — render nothing rather than guess. */
  seat: MySeat | null;
  /** Re-read after a confirm so the card shows the number the server kept. */
  reload: () => void;
  /**
   * Booking-scope token for the seats API. From `?rt=` this session, or the
   * cache a previous entry left (`storePersonalToken`, TourRoomClient).
   */
  personalToken: string | null;
  /** Server says yes AND we hold a credential the seats API will accept. */
  pickable: boolean;
  /** This tour seats people at all — false for a private charter. */
  hasSeating: boolean;
}

export function useMySeat({
  bookingId,
  roomSession,
  authToken,
}: {
  bookingId: string;
  roomSession: string;
  authToken?: string | null;
}): UseMySeat {
  const [seat, setSeat] = useState<MySeat | null>(null);

  const reload = useCallback(() => {
    void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/my-seat`, {
      headers: { 'x-tour-room-auth': roomSession },
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MySeat | null) => {
        if (data && typeof data.state === 'string') setSeat(data);
      })
      .catch(() => undefined);
  }, [bookingId, roomSession]);

  useEffect(reload, [reload]);

  const personalToken =
    authToken ?? findRecognizedToken([bookingId], readStoredPersonalTokens())?.token ?? null;

  return {
    seat,
    reload,
    personalToken,
    pickable: Boolean(seat?.can_pick && personalToken && seat?.room_id),
    hasSeating: Boolean(seat && seat.state !== 'none'),
  };
}
