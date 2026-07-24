import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import CompanionJoin from '@/components/tour-mode/companion/CompanionJoin';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { verifyCompanionInviteToken } from '@/lib/tour-room/companionToken';

export const dynamic = 'force-dynamic';

/**
 * 동행자 초대 랜딩 — AtoC 통합 플랜 §5.2 C-6.
 *
 * URL: /tour-mode/companion/{companionInviteToken}  (lead가 직접 공유)
 *
 * 서명·만료·스코프만 서버에서 선검증해 bookingId를 뽑고(폐기·정원은 redeem
 * 라우트가 판정), 나머지는 클라이언트 상태머신에 넘긴다 — 룸 초대 랜딩(§5.1)
 * 과 동일하게 GET에 부작용 0 (메일 스캐너가 participant를 만들면 안 된다,
 * §O-1 ⑦).
 */
export default async function CompanionInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const payload = verifyCompanionInviteToken(token);
  if (!payload) {
    return (
      <main className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-[var(--tr-ink-2)]">
          이 동행자 초대 링크는 만료되었거나 유효하지 않아요. 예약하신 분께 새 링크를 받아 주세요.
          <br />
          This companion invite is invalid or expired — ask for a fresh link.
        </p>
      </main>
    );
  }
  return <CompanionJoin inviteToken={token} bookingId={payload.bookingId} />;
}
