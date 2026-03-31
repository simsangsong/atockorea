import type { TourDetailViewModel } from '@/src/types/tours';
import { BOOKING_CANCELLATION_SUMMARY_LINE } from '@/components/tour/bookingPolicy';

/** Hero glass — OTA-style policy chips (cancellation · pickup · group). */
export type SmallGroupHeroPolicyChipId = 'cancellation' | 'pickup' | 'group';

export interface SmallGroupHeroPolicyChip {
  id: SmallGroupHeroPolicyChipId;
  text: string;
}

const MAX_CHIP_CHARS = 56;

function shortenForChip(s: string, maxLen: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

function cancellationChipText(tour: TourDetailViewModel): string {
  const raw = tour.cancellationPolicy?.trim();
  if (raw) {
    const firstLine = raw.split(/\n/)[0]?.trim() ?? raw;
    const dot = firstLine.indexOf('.');
    const sentence =
      dot !== -1 && dot < 120 ? firstLine.slice(0, dot + 1).trim() : firstLine;
    return shortenForChip(sentence, MAX_CHIP_CHARS);
  }
  return BOOKING_CANCELLATION_SUMMARY_LINE;
}

function pickupChipText(tour: TourDetailViewModel): string | null {
  const area = tour.pickup?.areaLabel?.trim();
  if (area) return shortenForChip(area, MAX_CHIP_CHARS);
  const first = tour.pickupPoints?.[0]?.name?.trim();
  if (first) return shortenForChip(first, MAX_CHIP_CHARS);
  return null;
}

function groupChipText(tour: TourDetailViewModel): string | null {
  if (typeof tour.maxTravelers === 'number' && tour.maxTravelers > 0) {
    return `Max ${tour.maxTravelers} guests`;
  }
  const g = tour.groupSize?.trim();
  return g ? shortenForChip(g, MAX_CHIP_CHARS) : null;
}

/** Always includes cancellation; pickup / group only when data exists. */
export function buildSmallGroupHeroPolicyChips(tour: TourDetailViewModel): SmallGroupHeroPolicyChip[] {
  const chips: SmallGroupHeroPolicyChip[] = [{ id: 'cancellation', text: cancellationChipText(tour) }];
  const pickup = pickupChipText(tour);
  if (pickup) chips.push({ id: 'pickup', text: pickup });
  const group = groupChipText(tour);
  if (group) chips.push({ id: 'group', text: group });
  return chips;
}

/**
 * One-line scan above “At a glance” — duration · small group · pickup (when known).
 */
export function buildAtAGlanceScanSummaryLine(tour: TourDetailViewModel): string | null {
  const parts: string[] = [];
  const dur = tour.duration?.trim();
  if (dur) parts.push(dur);
  parts.push('Small group');
  const pickup = pickupChipText(tour);
  if (pickup) {
    parts.push(/pickup/i.test(pickup) ? pickup : `${pickup} pickup`);
  }
  return parts.length ? parts.join(' · ') : null;
}
