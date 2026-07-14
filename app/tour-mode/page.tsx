import TourModeEntry from '@/components/tour-mode/TourModeEntry';
import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * T1.4 — Tour Mode entry route. Flag OFF (D-10) renders the informational
 * page only; ON renders the member/guest entry. Invite links bypass this
 * page entirely (they land on /tour-mode/room/[bookingId]?rt=…).
 */
export default function TourModePage() {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  return <TourModeEntry />;
}
