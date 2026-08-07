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
 * 🔴 2026-08-07 — and then this card had the same disease one level down.
 * It listed four cases in this very comment, but the server answered `none`
 * for both "no vehicle yet" and "no seating at all", and the card returned
 * null on `none`. So the case below marked "seats open once your vehicle is
 * assigned" **never rendered a single time** — and since live dispatch is 0,
 * that was every guest. The state is split server-side now (`awaiting` vs
 * `none`), so the door can finally be closed-but-visible instead of missing.
 *
 * What is behind it, honestly:
 *   · a seat is assigned  → show the number (and the plate, to find the van)
 *   · seats are open      → "choose your seats", opens the real picker
 *   · vehicle not yet set → "seats open once your vehicle is assigned"
 *   · vehicle set, no seat of mine, and I may not pick → the guide seats me
 *   · no seating at all   → render nothing; a private charter has no seat map
 *
 * Whether the guest may pick is decided by the SERVER (`can_pick`), not here.
 * This component now takes the answer as a prop: the home tile opens the same
 * sheet, so one read feeds both (see `hooks/useMySeat.ts`).
 */

import { IconTicket, IconChevronRight, TR_ICON } from '@/components/tour-mode/icons';
import { joinCopy } from '@/lib/ops/seating/joinCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { MySeat } from '@/hooks/useMySeat';

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
  seat,
  locale,
  pickable,
  onOpen,
}: {
  seat: MySeat | null;
  locale: RoomLocale;
  /** Server said yes AND we hold a booking-scope token (useMySeat ANDs them). */
  pickable: boolean;
  onOpen: () => void;
}) {
  if (!seat || seat.state === 'none') return null;

  const t = (key: Parameters<typeof joinCopy>[1], vars?: Record<string, string | number>) =>
    joinCopy(locale, key, vars);
  const assigned = seat.state === 'assigned' && seat.seat_number != null;

  // Say the true thing for each state. `seatSoon` used to cover the two
  // not-pickable cases at once, which told a guest whose bus was already
  // dispatched that seats would open "once your vehicle is assigned".
  const body = assigned
    ? SEAT_LABEL[locale](seat.seat_number as number)
    : pickable
      ? t('seatHint', { n: seat.party_size })
      : seat.state === 'awaiting'
        ? t('seatSoon')
        : t('seatOnSite');

  const card = (
    <>
      <span className="tr-chip tr-chip--base flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
        <IconTicket size={TR_ICON.chip} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {/* 제목은 지금 할 수 있는 일을 말해야 한다. 예전엔 배차 전에도
            "좌석을 선택하세요"라고 띄우고 바로 아래 줄에서 아직 못 고른다고
            했다 — 한 카드가 자기 자신과 모순됐다. */}
        <span className="tr-label block font-semibold text-[var(--tr-ink)]">
          {assigned || !pickable ? t('yourSeats') : t('seatTitle')}
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

  // An assigned seat stays tappable even when it can no longer be changed —
  // mid-tour "which seat am I in" is a read, and the sheet answers it.
  const tappable = pickable || assigned;

  return tappable ? (
    <button
      type="button"
      onClick={onOpen}
      data-testid="room-seat-card"
      data-seat-state={seat.state}
      className="tr-home-card mb-2 flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      {card}
      {/* 규칙 1 — 자기 어절보다 좁아질 수 있는 상자의 CJK 라벨.
          "좌석 확정"이 두 줄로 무너지느니 잘리는 편이 낫다. */}
      <span className="tr-label text-cjk-safe shrink-0 font-semibold text-[var(--tr-accent-ink)]">
        {!pickable ? t('yourSeats') : assigned ? t('changeSeats') : t('confirmSeats')}
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
  );
}
