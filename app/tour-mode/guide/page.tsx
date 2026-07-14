import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import GuideConsole from '@/components/tour-mode/guide/GuideConsole';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * T6.2 — the guide console: `/tour-mode/guide?rt=<tour-date token>`.
 * Standalone shell (§O-1 ② via the tour-mode layout), no login — the
 * tour-date token from the dispatch mail is the credential.
 */
export default function TourModeGuidePage() {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  return <GuideConsole />;
}
