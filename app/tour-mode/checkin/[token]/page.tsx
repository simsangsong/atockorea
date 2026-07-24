import CheckinLanding from '@/components/tour-mode/checkin/CheckinLanding';

export const dynamic = 'force-dynamic';

/**
 * QR 체크인 랜딩 라우트 — AtoC 통합 플랜 §5.4c (D16).
 *
 * URL 스킴 (QR에 인코딩):
 *   콘솔 표시용:  /tour-mode/checkin/{roomCheckinToken}?n={5분 로테이션 nonce}
 *   인쇄(정적)용: /tour-mode/checkin/{roomCheckinToken}
 *
 * 서버는 토큰을 렌더 전 검증하지 않는다 — 판정은 전부
 * POST /api/ops/checkin/context (rate-limited)가 담당하고, 이 페이지는
 * 클라이언트 상태머신(CheckinLanding)만 띄운다. 메일 스캐너/봇의 GET이
 * 어떤 부작용도 만들지 않는 기존 §O-1 ⑦ 원칙 유지.
 */
export default async function CheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { token } = await params;
  const { n } = await searchParams;
  // CheckinLanding renders its own themed `.dark > .tr-root` shell (it detects
  // the device theme client-side). The old `dark:bg-neutral-950` here was dead —
  // Tailwind darkMode is 'class' and nothing set a `.dark` ancestor — so this
  // wrapper just carries the brand canvas the layout already uses.
  return (
    <main className="min-h-screen">
      <CheckinLanding checkinToken={decodeURIComponent(token)} nonce={n ?? null} />
    </main>
  );
}
