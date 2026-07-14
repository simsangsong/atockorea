import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import TourRoomClient from '@/components/tour-mode/TourRoomClient';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * T1.4 skeleton (full shell lands with T1.6) — the direct-entry room route.
 * The invite link `/tour-mode/room/{bookingId}?rt={token}` must open the room
 * with no login and no site shell (§O-1); the client component consumes the
 * token, joins, and scrubs it from the address bar.
 */
export default async function TourRoomPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  return <TourRoomClient bookingId={bookingId} />;
}
