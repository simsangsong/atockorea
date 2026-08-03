'use client';

/**
 * The seat picker, opened from inside the room.
 *
 * Same board, same rules, same server as the claim-link flow — `useSeatPicker`
 * is shared with JoinFlow so a race (409) and a start-gate lock behave
 * identically no matter which door the guest came through. The difference is
 * only what precedes it: JoinFlow has to establish WHO you are from a masked
 * roster, because a claim link is anonymous. In the room we already know.
 */

import { useState } from 'react';
import SeatMap from '@/components/ops/SeatMap';
import Sheet from '@/components/tour-mode/Sheet';
import { useSeatPicker } from '@/hooks/useSeatPicker';
import { joinCopy } from '@/lib/ops/seating/joinCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function RoomSeatSheet({
  open,
  onClose,
  locale,
  roomId,
  token,
  bookingId,
  partySize,
  guestLabel,
}: {
  open: boolean;
  onClose: () => void;
  locale: RoomLocale;
  roomId: string;
  token: string;
  bookingId: string;
  partySize: number;
  guestLabel: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [doneSeats, setDoneSeats] = useState<number[] | null>(null);
  const t = (key: Parameters<typeof joinCopy>[1], vars?: Record<string, string | number>) =>
    joinCopy(locale, key, vars);

  const picker = useSeatPicker({
    roomId,
    token,
    bookingId,
    partySize,
    guestLabel,
    enabled: open,
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
    <Sheet open={open} onClose={onClose} title={t('seatTitle')} closeLabel={t('back')}>
      <div className="px-1 pb-2" data-testid="room-seat-sheet">
        {doneSeats ? (
          <div className="py-6 text-center" data-testid="room-seat-done">
            <p className="tr-title font-bold text-[var(--tr-ink)]">{t('done')}</p>
            <p className="tr-numeral mt-3 font-bold text-[var(--tr-accent-ink)]">
              {doneSeats.join(', ')}
            </p>
            <p className="tr-card-text mt-3 text-[var(--tr-ink-2)]">{t('doneHint')}</p>
          </div>
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
