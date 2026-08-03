'use client';

/**
 * The seat door, inside the room.
 *
 * 🔴 The picker has always existed and worked — roster, identity check, live
 * seat map, 409 on a race, start-gate lock. What it never had was a way in.
 * The only entrance was an ops-issued claim link, and the live DB says that
 * link has been minted ZERO times: `tour_room_invites` holds no `room_claim`
 * row and `ops_seat_assignments` is empty. A working feature nobody can reach
 * is indistinguishable from a missing one.
 *
 * So this card is the door, and it is honest about what is behind it:
 *   · a seat is assigned  → show the number (and the plate, to find the van)
 *   · seats are open      → "choose your seats", opens the real picker
 *   · vehicle not yet set → "seats open once your vehicle is assigned"
 *   · no seating at all   → render nothing; a private charter has no seat map
 *
 * The "seats are open" case is decided by the SERVER (`can_pick`), not here.
 * Guest writes close at 00:00 KST on the tour day (C-11), so a client-side
 * guess would offer a button that 400s on the morning it matters most.
 */

import { useCallback, useEffect, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { IconTicket, IconChevronRight, TR_ICON } from '@/components/tour-mode/icons';
import { joinCopy } from '@/lib/ops/seating/joinCopy';
import { readStoredPersonalTokens, findRecognizedToken } from '@/lib/ops/seating/personalTokens';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { MySeatState } from '@/app/api/tour-rooms/[bookingId]/my-seat/route';

const RoomSeatSheet = dynamicImport(() => import('@/components/tour-mode/seat/RoomSeatSheet'), {
  ssr: false,
});

interface MySeat {
  state: MySeatState;
  seat_number: number | null;
  plate_number: string | null;
  can_pick: boolean;
  room_id: string | null;
  party_size: number;
}

const SEAT_LABEL: Record<RoomLocale, (n: number) => string> = {
  en: (n) => `Seat ${n}`,
  ko: (n) => `${n}번 좌석`,
  ja: (n) => `${n}番座席`,
  es: (n) => `Asiento ${n}`,
  zh: (n) => `${n}号座位`,
  'zh-TW': (n) => `${n}號座位`,
  fr: (n) => `Siège ${n}`,
  de: (n) => `Sitzplatz ${n}`,
  ru: (n) => `Место ${n}`,
  it: (n) => `Posto ${n}`,
};

const PLATE_LABEL: Record<RoomLocale, string> = {
  en: 'Vehicle',
  ko: '차량',
  ja: '車両',
  es: 'Vehículo',
  zh: '车辆',
  'zh-TW': '車輛',
  fr: 'Véhicule',
  de: 'Fahrzeug',
  ru: 'Транспорт',
  it: 'Veicolo',
};

export default function RoomSeatCard({
  bookingId,
  roomSession,
  locale,
  guestName,
  /** Set from ?rt= at entry; the cache below covers a later cold start. */
  authToken,
}: {
  bookingId: string;
  roomSession: string;
  locale: RoomLocale;
  guestName: string;
  authToken?: string | null;
}) {
  const [seat, setSeat] = useState<MySeat | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
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

  useEffect(load, [load]);

  // The seats API takes a booking-scope personal token, NOT the room session.
  // Guests who arrived by ?rt= have it in memory; anyone who came back later
  // (PWA relaunch, session restore) still has it cached from that first visit.
  const personalToken =
    authToken ?? findRecognizedToken([bookingId], readStoredPersonalTokens())?.token ?? null;

  if (!seat || seat.state === 'none') return null;

  const t = (key: Parameters<typeof joinCopy>[1], vars?: Record<string, string | number>) =>
    joinCopy(locale, key, vars);
  const assigned = seat.state === 'assigned' && seat.seat_number != null;
  const pickable = seat.can_pick && Boolean(personalToken) && Boolean(seat.room_id);

  const body = assigned
    ? SEAT_LABEL[locale](seat.seat_number as number)
    : pickable
      ? t('seatHint', { n: seat.party_size })
      : t('seatSoon');

  const card = (
    <>
      <span className="tr-chip tr-chip--base flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
        <IconTicket size={TR_ICON.chip} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="tr-label block font-semibold text-[var(--tr-ink)]">
          {assigned ? t('yourSeats') : t('seatTitle')}
        </span>
        <span className="tr-card-text block text-[var(--tr-ink-2)]">{body}</span>
        {assigned && seat.plate_number && (
          <span className="tr-meta block text-[var(--tr-ink-3)]">
            {PLATE_LABEL[locale]} {seat.plate_number}
          </span>
        )}
      </span>
    </>
  );

  return (
    <>
      {pickable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="room-seat-card"
          data-seat-state={seat.state}
          className="tr-home-card mb-2 flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          {card}
          {/* 규칙 1 — 자기 어절보다 좁아질 수 있는 상자의 CJK 라벨.
              "좌석 확정"이 두 줄로 무너지느니 잘리는 편이 낫다. */}
          <span className="tr-label text-cjk-safe shrink-0 font-semibold text-[var(--tr-accent-ink)]">
            {assigned ? t('changeSeats') : t('confirmSeats')}
          </span>
          <IconChevronRight size={TR_ICON.action} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
        </button>
      ) : (
        <div
          data-testid="room-seat-card"
          data-seat-state={seat.state}
          className="tr-home-card mb-2 flex w-full items-center gap-3 px-4 py-3"
        >
          {card}
        </div>
      )}

      {pickable && open && (
        <RoomSeatSheet
          open={open}
          onClose={() => {
            setOpen(false);
            load();
          }}
          locale={locale}
          roomId={seat.room_id as string}
          token={personalToken as string}
          bookingId={bookingId}
          partySize={seat.party_size}
          guestLabel={guestName}
        />
      )}
    </>
  );
}
