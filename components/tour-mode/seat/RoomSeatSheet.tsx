'use client';

/**
 * The seat picker, opened from inside the room.
 *
 * Same board, same rules, same server as the claim-link flow — `useSeatPicker`
 * is shared with JoinFlow so a race (409) and a start-gate lock behave
 * identically no matter which door the guest came through. The difference is
 * only what precedes it: JoinFlow has to establish WHO you are from a masked
 * roster, because a claim link is anonymous. In the room we already know.
 *
 * 🔴 2026-08-07 — it also has to answer when the guest may only LOOK.
 *
 * The owner's requirement is that a seat is checkable at any point during the
 * tour, and by then picking is closed (check-in, or the start gate). The
 * picker cannot serve that read: `useSeatPicker` calls the seats API, which
 * takes a booking-scope token and NOT the room session — a guest who relaunched
 * the PWA without `?rt=` would get a spinner that never resolves. So when
 * there is nothing to pick, this sheet renders the answer it already has from
 * `my-seat` (which the room session does authorise) and never touches the
 * board. The picker mounts only when the guest can actually use it.
 */

import { useState } from 'react';
import SeatMap from '@/components/ops/SeatMap';
import Sheet from '@/components/tour-mode/Sheet';
import { useSeatPicker } from '@/hooks/useSeatPicker';
import { joinCopy } from '@/lib/ops/seating/joinCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import type { MySeat } from '@/hooks/useMySeat';

/** Read-only answer for a guest who cannot (or need not) pick right now. */
function SeatSummary({ seat, locale }: { seat: MySeat; locale: RoomLocale }) {
  const t = (key: Parameters<typeof joinCopy>[1]) => joinCopy(locale, key);
  const assigned = seat.state === 'assigned' && seat.seat_number != null;
  return (
    <div className="py-6 text-center" data-testid="room-seat-summary" data-seat-state={seat.state}>
      {assigned ? (
        <>
          <p className="tr-card-text text-[var(--tr-ink-2)]">{t('yourSeats')}</p>
          <p className="tr-numeral mt-2 font-bold text-[var(--tr-accent-ink)]">{seat.seat_number}</p>
          {seat.plate_number && (
            <p className="tr-card-text mt-2 text-[var(--tr-ink-2)]">{seat.plate_number}</p>
          )}
          <p className="tr-meta mt-3 text-[var(--tr-ink-3)]">{t('seatFixed')}</p>
        </>
      ) : (
        <p className="tr-card-text text-[var(--tr-ink-2)]">
          {seat.state === 'awaiting' ? t('seatSoon') : t('seatOnSite')}
        </p>
      )}
    </div>
  );
}

export default function RoomSeatSheet({
  open,
  onClose,
  locale,
  roomId,
  token,
  bookingId,
  partySize,
  guestLabel,
  seat,
  pickable,
}: {
  open: boolean;
  onClose: () => void;
  locale: RoomLocale;
  roomId: string;
  /** null when this device never received a personal link — read-only then. */
  token: string | null;
  bookingId: string;
  partySize: number;
  guestLabel: string;
  /** The `my-seat` answer, so the read-only path needs no second request. */
  seat: MySeat | null;
  pickable: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [doneSeats, setDoneSeats] = useState<number[] | null>(null);
  const t = (key: Parameters<typeof joinCopy>[1], vars?: Record<string, string | number>) =>
    joinCopy(locale, key, vars);

  // 🔴 `enabled` is what keeps the read-only path off the seats API. Without
  // it a tokenless guest would fire a request that 403s and sit on `loading`
  // forever — the exact "spinner instead of an answer" this sheet exists to
  // avoid mid-tour.
  const canPick = pickable && Boolean(token);
  const picker = useSeatPicker({
    roomId,
    token: token ?? '',
    bookingId,
    partySize,
    guestLabel,
    enabled: open && canPick,
  });

  const onConfirm = async () => {
    setNote(null);
    const result = await picker.confirm();
    if (result.ok) {
      setDoneSeats(result.seatNumbers);
      return;
    }
    setNote(
      result.reason === 'taken' ? t('seatTaken') : result.reason === 'locked' ? t('seatLocked') : t('error'),
    );
  };

  return (
    // 제목도 지금 할 수 있는 일을 말한다 — 못 고르는 시트를
    // "좌석을 선택하세요"로 열면 바로 아래 본문과 모순된다.
    <Sheet open={open} onClose={onClose} title={t(canPick ? 'seatTitle' : 'yourSeats')} closeLabel={t('back')}>
      <div className="px-1 pb-2" data-testid="room-seat-sheet">
        {doneSeats ? (
          <div className="py-6 text-center" data-testid="room-seat-done">
            <p className="tr-title font-bold text-[var(--tr-ink)]">{t('done')}</p>
            <p className="tr-numeral mt-3 font-bold text-[var(--tr-accent-ink)]">
              {doneSeats.join(', ')}
            </p>
            <p className="tr-card-text mt-3 text-[var(--tr-ink-2)]">{t('doneHint')}</p>
          </div>
        ) : !canPick ? (
          <SeatSummary seat={seat ?? { state: 'awaiting', seat_number: null, plate_number: null, can_pick: false, room_id: roomId, party_size: partySize }} locale={locale} />
        ) : !picker.loaded ? (
          <p className="tr-card-text py-6 text-center text-[var(--tr-ink-3)]">{t('loading')}</p>
        ) : !picker.activeVehicle ? (
          <p className="tr-card-text py-6 text-center text-[var(--tr-ink-2)]" data-testid="room-seat-soon">
            {t('seatSoon')}
          </p>
        ) : (
          <>
            <p className="tr-card-text text-[var(--tr-ink-2)]">
              {picker.anyLocked ? t('seatLocked') : t('seatHint', { n: partySize })}
            </p>

            {picker.vehicles.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5" data-testid="room-seat-vehicle-tabs">
                {picker.vehicles.map((v) => (
                  <button
                    key={v.roomVehicleId}
                    type="button"
                    onClick={() => picker.setActiveVehicleId(v.roomVehicleId)}
                    className={`tr-label text-cjk-safe min-h-[36px] rounded-full px-3 font-semibold ${
                      v.roomVehicleId === picker.activeVehicle?.roomVehicleId
                        ? 'bg-[var(--tr-accent)] text-[var(--tr-on-accent)]'
                        : 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                    }`}
                  >
                    {v.plateNumber || v.model || v.roomVehicleId.slice(0, 4)}
                  </button>
                ))}
              </div>
            )}

            {picker.activeVehicle.layout && (
              <div className="mt-4 overflow-x-auto">
                <SeatMap
                  layout={picker.activeVehicle.layout}
                  seatStates={picker.renderedStates}
                  onSeatTap={picker.onSeatTap}
                  readOnly={picker.anyLocked}
                  ariaLabel={t('seatTitle')}
                />
              </div>
            )}

            <p
              className="tr-card-text mt-3 text-center font-semibold text-[var(--tr-ink-2)]"
              data-testid="room-seat-count"
            >
              {t('selectedCount', { sel: picker.selected.size, n: partySize })}
            </p>

            {note && (
              <p className="tr-label mt-2 rounded-lg bg-[var(--tr-danger-soft)] px-3 py-2 text-center font-medium text-[var(--tr-danger)]">
                {note}
              </p>
            )}

            <button
              type="button"
              disabled={picker.selected.size === 0 || picker.anyLocked || picker.submitting}
              onClick={() => void onConfirm()}
              data-testid="room-seat-confirm"
              className="tr-btn-physical text-cjk-safe mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-on-accent)] disabled:opacity-40"
            >
              {t('confirmSeats')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
