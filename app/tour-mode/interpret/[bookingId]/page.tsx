import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import InterpretEntry from '@/components/tour-mode/interpret/InterpretEntry';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

/**
 * V1 — 대면 통역 모드.
 *
 * 손님이 식당·약국·상점 앞에서 여는 화면. 폰 하나를 둘이 보고, 위쪽은 180° 돌아
 * 있어 테이블 건너 상대가 자기 쪽에서 읽는다. 미디어 전송 계층이 없다 — 통화(V3)
 * 보다 이걸 먼저 만든 이유이자, 실사용 빈도가 더 높다고 본 이유다.
 *
 * 세션은 룸에서 이어받는다(`readStoredRoomSession`). 여기서 조인 UI 를 또 만들면
 * 입장 경로가 둘로 갈린다.
 */
export default async function InterpretPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }

  return <InterpretEntry bookingId={bookingId} fallbackLocale="en" />;
}
