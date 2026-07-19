import { redirect } from 'next/navigation';
import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import DriverConsole from '@/components/tour-mode/driver/DriverConsole';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { verifyRoomToken } from '@/lib/tour-room/token';

export const dynamic = 'force-dynamic';

/**
 * W3 (P-D15) — the driver console: `/tour-mode/driver?rt=<driver token>`.
 * Standalone shell, no login — the driver tour-date token plus the vehicle
 * PIN (join gate) are the credentials.
 *
 * Unification (2026-07-19): the guide IS the operator (dispatch + drive) in the
 * common guide-driven case, and the guide console already contains the cockpit.
 * So a GUIDE token that lands here is bounced to the unified operator console —
 * this page's pure-driver, PIN-gated experience is only for a SEPARATE hired
 * Korean driver (a distinct driver token).
 */
export default async function TourModeDriverPage({
  searchParams,
}: {
  searchParams: Promise<{ rt?: string }>;
}) {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  const { rt } = await searchParams;
  if (rt && verifyRoomToken(rt)?.role === 'guide') {
    redirect(`/tour-mode/guide?rt=${encodeURIComponent(rt)}`);
  }
  return <DriverConsole />;
}
