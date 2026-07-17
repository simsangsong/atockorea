import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import PlanEditorClient from '@/components/tour-mode/plan/PlanEditorClient';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * W1.2 — the guest D-1 pre-selection page (§G).
 * The email link `/tour-mode/plan/{bookingId}?rt={token}` opens with no login
 * and no site shell; the client consumes the token (same join flow as the
 * room), scrubs it from the address bar, and the lead guest builds the
 * wish-list day plan.
 */
export default async function TourPlanPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  return <PlanEditorClient bookingId={bookingId} />;
}
