import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import JoinFlow from '@/components/tour-mode/join/JoinFlow';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { verifyRoomClaimToken } from '@/lib/ops/seating/claimToken';

export const dynamic = 'force-dynamic';

/**
 * 조인투어 룸 초대 랜딩 — AtoC 통합 플랜 §5.1/§5.2 (링크 2계층의 1층).
 *
 * URL: /tour-mode/join/{roomClaimToken}  (admin이 일괄 발송 — claim-link 라우트)
 *
 * 서명·만료만 서버에서 선검증해 roomId/tourDate를 뽑고(폐기/명단은 claim
 * 라우트가 판정), 나머지 상호작용은 클라이언트 상태머신(JoinFlow)에 넘긴다 —
 * QR 랜딩(§5.4c)과 동일하게 GET에 부작용 0.
 */
export default async function TourModeJoinPage({
  params,
}: {
  params: Promise<{ roomToken: string }>;
}) {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  const { roomToken } = await params;
  const token = decodeURIComponent(roomToken);
  const payload = verifyRoomClaimToken(token);
  if (!payload) {
    return (
      <main className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-[var(--tr-ink-2)]">
          이 초대 링크는 만료되었거나 유효하지 않아요. 가이드에게 문의해 주세요.
          <br />
          This invitation link is invalid or expired.
        </p>
      </main>
    );
  }
  return <JoinFlow claimToken={token} roomId={payload.roomId} tourDate={payload.tourDate} />;
}
