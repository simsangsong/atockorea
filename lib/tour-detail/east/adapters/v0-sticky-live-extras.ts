import type { BookingPanelSummary } from '@/components/tour/EnhancedBookingSidebar';
import type { JoinTourAvailabilityData } from '@/lib/tour-detail/join-tour/types';

export type V0EastStickyLiveExtras = {
  totalLine?: string | null;
  noticeLine?: string | null;
  noticeTone?: 'muted' | 'error' | 'warning' | 'success';
  /** Spinner on Book CTA while availability is re-checking for a chosen date */
  ctaBusy?: boolean;
  /** Optional hard-disable (e.g. checkout in flight) — parent may wire later */
  ctaDisabled?: boolean;
};

type Translate = (key: string) => string;

/**
 * v0 sticky bar secondary lines (does not change primary “From” row — that stays on pricing rules + `useEastStickyPricePresentation`).
 */
export function buildV0EastStickyLiveExtras(input: {
  bookingSummary: BookingPanelSummary | null;
  checkingAvailability: boolean;
  availabilityError: string | null;
  availability: JoinTourAvailabilityData | null;
  gateError: string | null;
  sheetOpen: boolean;
  t: Translate;
}): V0EastStickyLiveExtras {
  const { bookingSummary, checkingAvailability, availabilityError, availability, gateError, sheetOpen, t } = input;

  const totalLine =
    bookingSummary?.hasDate && bookingSummary.totalFormatted
      ? bookingSummary.priceType === 'person'
        ? `Total for ${bookingSummary.guestCount} ${
            bookingSummary.guestCount === 1 ? 'guest' : 'guests'
          } · ${bookingSummary.totalFormatted}`
        : `${t('tour.total')} · ${bookingSummary.totalFormatted}`
      : null;

  // Prefer i18n-safe fallbacks: if key missing, t often returns key — use short English fallbacks
  const checkingCopy = t('common.loading');
  let noticeLine: string | null = null;
  let noticeTone: V0EastStickyLiveExtras['noticeTone'] = 'muted';

  if (availabilityError) {
    noticeLine = availabilityError;
    noticeTone = 'error';
  } else if (sheetOpen && gateError) {
    noticeLine = gateError;
    noticeTone = 'error';
  } else if (checkingAvailability && bookingSummary?.hasDate) {
    noticeLine = checkingCopy.includes('.') ? checkingCopy : 'Checking availability…';
    noticeTone = 'muted';
  } else if (bookingSummary?.hasDate && availability && availability.canAccommodate && availability.availableSpots < 10) {
    noticeLine = `${t('tour.checkAvailability')}: ${availability.availableSpots}`;
    noticeTone = 'warning';
  } else if (bookingSummary?.hasDate && availability && !availability.canAccommodate) {
    const reason = (availability as JoinTourAvailabilityData & { reason?: string }).reason;
    noticeLine =
      reason ||
      `${t('tour.checkAvailability')}: ${availability.availableSpots ?? 0}`;
    noticeTone = 'error';
  }

  const ctaBusy = Boolean(checkingAvailability && bookingSummary?.hasDate);

  return {
    totalLine,
    noticeLine,
    noticeTone,
    ctaBusy,
  };
}
