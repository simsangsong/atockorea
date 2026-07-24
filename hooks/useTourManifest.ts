'use client';

/**
 * 가이드 명단+좌석 통합 데이터 훅 — AtoC 통합 플랜 §5.4b / §11.B B1.
 *
 * /api/ops/bookings/[bookingId]/manifest (staff 전용) 를 불러 명단·좌석·차량을
 * 한 번에 얻고, seat_update Realtime 구독 + 폴백 폴링으로 신선하게 유지한다.
 * 대시보드(GuideSeatDashboard)와 좌석 스트립(GuideSeatStrip)이 공유한다.
 *
 * 응답 camelCase → dashboard.ts/logic.ts가 쓰는 DB형(snake_case)으로 정규화.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSeatChannel } from '@/hooks/useSeatChannel';
import type { ManifestBooking } from '@/lib/ops/manifest/group';
import type { DashboardAssignment } from '@/lib/ops/seating/dashboard';
import type { VehicleLayoutJson } from '@/lib/ops/seating/layouts';

export interface ManifestAssignment extends DashboardAssignment {
  room_vehicle_id: string;
}

export interface ManifestVehicle {
  roomVehicleId: string;
  model: string | null;
  plateNumber: string | null;
  totalSeats: number | null;
  layout: VehicleLayoutJson | null;
}

export interface TourManifestData {
  tour: { id: string; title: string | null; city: string | null } | null;
  tourDate: string | null;
  anchorRoomId: string | null;
  channelTopic: string | null;
  started: boolean;
  bookings: ManifestBooking[];
  vehicles: ManifestVehicle[];
  assignments: ManifestAssignment[];
}

interface RawAssignment {
  seatNumber: number;
  roomVehicleId: string;
  bookingId: string;
  guestLabel: string | null;
  checkedInAt: string | null;
  absentAt: string | null;
  locked: boolean;
}

const POLL_MS = 10_000;

export function useTourManifest(bookingId: string | null, token: string | null) {
  const [data, setData] = useState<TourManifestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!bookingId || !token) return;
    try {
      const res = await fetch(`/api/ops/bookings/${bookingId}/manifest`, {
        headers: { 'x-tour-room-token': token },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'load_failed');
        return;
      }
      const assignments: ManifestAssignment[] = ((json.assignments ?? []) as RawAssignment[]).map((a) => ({
        seat_number: a.seatNumber,
        room_vehicle_id: a.roomVehicleId,
        booking_id: a.bookingId,
        guest_label: a.guestLabel,
        checked_in_at: a.checkedInAt,
        absent_at: a.absentAt,
        locked: a.locked,
      }));
      setData({
        tour: json.tour ?? null,
        tourDate: json.tourDate ?? null,
        anchorRoomId: json.anchorRoomId ?? null,
        channelTopic: json.channelTopic ?? null,
        started: Boolean(json.started),
        bookings: (json.bookings ?? []) as ManifestBooking[],
        vehicles: (json.vehicles ?? []) as ManifestVehicle[],
        assignments,
      });
      setError(null);
    } catch {
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Realtime: 아무 seat_update가 오면 최신 명단 재조회.
  useSeatChannel(data?.channelTopic, () => void loadRef.current());

  // 폴백 폴링 (Realtime env 부재/누락 대비).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRef.current();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  return { data, error, loading, refetch: load } as const;
}
