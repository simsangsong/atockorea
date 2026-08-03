'use client';

/**
 * Seat picking — the board, the selection rules, and the write.
 *
 * Extracted from JoinFlow so the in-room seat sheet is the SAME picker rather
 * than a second one that drifts. The concurrency contract (C-10) is subtle
 * enough that having it in two places would be a bug waiting to happen: the
 * server's UNIQUE(room_vehicle_id, seat_number) is the referee, a 409 carries
 * the fresh board, and the client has to re-render from that payload instead of
 * its own optimistic guess.
 *
 * What stays OUT of here: the claim/roster flow (claim-link only) and the
 * copy. Callers own their own wording and their own shell.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSeatChannel } from '@/hooks/useSeatChannel';
import type { SeatState } from '@/lib/ops/seating/logic';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

export interface SeatVehicleView {
  roomVehicleId: string;
  model: string | null;
  plateNumber: string | null;
  totalSeats: number | null;
  layout: VehicleLayoutJson | null;
  seatStates: Record<number, SeatState>;
  seats: Array<{
    seatNumber: number;
    bookingId: string;
    guestLabel: string | null;
    checkedInAt: string | null;
    absentAt: string | null;
    locked: boolean;
  }>;
}

/** Why a confirm did not stick — the caller maps these to its own copy. */
export type SeatWriteOutcome =
  | { ok: true; seatNumbers: number[] }
  | { ok: false; reason: 'taken' | 'locked' | 'error' };

export interface UseSeatPicker {
  vehicles: SeatVehicleView[];
  activeVehicle: SeatVehicleView | null;
  setActiveVehicleId: (id: string) => void;
  /** Any seat on any vehicle locked by the start gate → the board is frozen. */
  anyLocked: boolean;
  selected: Set<number>;
  /** Server board merged with my local selection, ready for <SeatMap>. */
  renderedStates: Record<number, SeatState>;
  onSeatTap: (seatNumber: number) => void;
  confirm: () => Promise<SeatWriteOutcome>;
  submitting: boolean;
  reload: () => void;
  /**
   * Has the first board fetch settled?
   *
   * Callers MUST wait on this before rendering "seats open once your vehicle
   * is assigned" — an empty `vehicles` array means "no vehicle yet" only after
   * we have actually asked. Without it the guest sees that message flash for a
   * frame on every open, which reads as the feature being unavailable.
   */
  loaded: boolean;
}

export function useSeatPicker(options: {
  /** The ops room id to address. Any room in the tour-date group works — the
   *  server expands to siblings, which is how a join guest reaches the shared
   *  vehicle hanging off someone else's room. */
  roomId: string | null;
  /** A booking-scope personal token. The room SESSION is not accepted here. */
  token: string | null;
  bookingId: string | null;
  partySize: number;
  /** Written onto each seat so the guide's board shows a name, not a number. */
  guestLabel: string;
  /** Realtime topic for other guests' picks; null falls back to the poll. */
  channelTopic?: string | null;
  /** Skip all network while the picker is closed. */
  enabled?: boolean;
}): UseSeatPicker {
  const {
    roomId,
    token,
    bookingId,
    partySize,
    guestLabel,
    channelTopic = null,
    enabled = true,
  } = options;

  const [vehicles, setVehicles] = useState<SeatVehicleView[]>([]);
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSeats = useCallback(async (): Promise<SeatVehicleView[]> => {
    if (!roomId || !token) return [];
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/seats`, {
        headers: { 'x-tour-room-token': token },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({ vehicles: [] }));
      const vs = (data.vehicles ?? []) as SeatVehicleView[];
      setVehicles(vs);
      return vs;
    } catch {
      return [];
    }
  }, [roomId, token]);

  const reload = useCallback(() => {
    if (enabled) void loadSeats();
  }, [enabled, loadSeats]);

  useSeatChannel(enabled ? channelTopic : null, reload);

  // First load: seed the selection from seats this booking already holds, and
  // open on the vehicle they are on rather than the first one in the list.
  useEffect(() => {
    if (!enabled || !roomId || !token) return;
    let cancelled = false;
    void loadSeats().then((vs) => {
      if (cancelled) return;
      setLoaded(true);
      if (vs.length === 0) return;
      const mineVehicle = vs.find((v) => v.seats.some((s) => s.bookingId === bookingId));
      setActiveVehicleId(mineVehicle?.roomVehicleId ?? vs[0]?.roomVehicleId ?? null);
      setSelected(
        new Set(
          (mineVehicle?.seats ?? [])
            .filter((s) => s.bookingId === bookingId)
            .map((s) => s.seatNumber),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, roomId, token, bookingId, loadSeats]);

  // Realtime can be unavailable (or the topic unknown); a slow visible-only
  // poll keeps two guests from both believing seat 7 is free.
  useEffect(() => {
    if (!enabled || !roomId || !token) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadSeats();
    }, 8000);
    return () => window.clearInterval(id);
  }, [enabled, roomId, token, loadSeats]);

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.roomVehicleId === activeVehicleId) ?? vehicles[0] ?? null,
    [vehicles, activeVehicleId],
  );

  const anyLocked = useMemo(
    () => vehicles.some((v) => v.seats.some((s) => s.locked)),
    [vehicles],
  );

  const renderedStates = useMemo(() => {
    if (!activeVehicle) return {} as Record<number, SeatState>;
    const map: Record<number, SeatState> = {};
    // 'mine' is re-derived from the local selection, so deselecting a seat I
    // already hold shows it as free again instead of staying stuck on mine.
    for (const [n, st] of Object.entries(activeVehicle.seatStates)) {
      map[Number(n)] = st === 'mine' ? 'available' : st;
    }
    for (const n of selected) map[n] = 'mine';
    return map;
  }, [activeVehicle, selected]);

  const onSeatTap = useCallback(
    (n: number) => {
      if (!activeVehicle || anyLocked) return;
      const serverState = activeVehicle.seatStates[n];
      const mineSeat = activeVehicle.seats.find((s) => s.seatNumber === n && s.bookingId === bookingId);
      const selectable =
        !serverState || serverState === 'available' || serverState === 'mine' || Boolean(mineSeat);
      if (!selectable) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(n)) next.delete(n);
        else if (next.size < partySize) next.add(n);
        return next;
      });
    },
    [activeVehicle, anyLocked, bookingId, partySize],
  );

  const selectVehicle = useCallback((id: string) => {
    setActiveVehicleId(id);
    setSelected(new Set());
  }, []);

  const confirm = useCallback(async (): Promise<SeatWriteOutcome> => {
    if (!token || !roomId || !activeVehicle || selected.size === 0) {
      return { ok: false, reason: 'error' };
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ops/rooms/${roomId}/seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-token': token },
        body: JSON.stringify({
          roomVehicleId: activeVehicle.roomVehicleId,
          seats: [...selected].map((seatNumber) => ({ seatNumber, guestLabel })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setVehicles((data.vehicles ?? []) as SeatVehicleView[]);
        return { ok: true, seatNumbers: [...selected].sort((a, b) => a - b) };
      }
      if (res.status === 409) {
        // C-10 — someone else got there first. The 409 body carries the fresh
        // board precisely so the guest re-picks against reality.
        setVehicles((data.vehicles ?? vehicles) as SeatVehicleView[]);
        return { ok: false, reason: 'taken' };
      }
      if (res.status === 400 && data.error === 'seat_change_locked') {
        return { ok: false, reason: 'locked' };
      }
      return { ok: false, reason: 'error' };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      setSubmitting(false);
    }
  }, [token, roomId, activeVehicle, selected, guestLabel, vehicles]);

  return {
    vehicles,
    activeVehicle,
    setActiveVehicleId: selectVehicle,
    anyLocked,
    selected,
    renderedStates,
    onSeatTap,
    confirm,
    submitting,
    reload,
    loaded,
  };
}
