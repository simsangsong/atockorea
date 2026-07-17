import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import DriverConsole from '@/components/tour-mode/driver/DriverConsole';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * W3 (P-D15) — the driver console: `/tour-mode/driver?rt=<driver token>`.
 * Standalone shell, no login — the driver tour-date token plus the vehicle
 * PIN (join gate) are the credentials.
 */
export default function TourModeDriverPage() {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  return <DriverConsole />;
}
