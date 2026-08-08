import TourModeEntry from '@/components/tour-mode/TourModeEntry';
import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import { isTourModeEnabled } from '@/lib/tour-room/flags';
import { entryLocaleFromRequest } from '@/lib/tour-room/entryLocaleServer';

export const dynamic = 'force-dynamic';

/**
 * T1.4 — Tour Mode entry route. Flag OFF (D-10) renders the informational
 * page only; ON renders the member/guest entry. Invite links bypass this
 * page entirely (they land on /tour-mode/room/[bookingId]?rt=…).
 *
 * N6 — the locale is resolved HERE, from the request, and handed down. Letting
 * the client pick it during render was a server/client branch by another name:
 * the server rendered English, the browser hydrated in the device language, and
 * React discarded the whole tree. Reading headers costs nothing on a route that
 * is already `force-dynamic`, and it means a Korean guest's first byte of HTML
 * is already Korean.
 */
export default async function TourModePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await entryLocaleFromRequest();
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon initialLocale={locale} />;
  }
  // 입장 코드 문(entry-code plan §C-2): /r/{code}·/room 이 여기로 리다이렉트한다.
  // 코드는 서버에서 읽어 내려준다 — 클라이언트가 렌더 중 URL 을 읽으면 N6 (하이드레이션
  // 불일치)의 재판이 된다.
  const sp = await searchParams;
  const code = typeof sp.code === 'string' ? sp.code : null;
  const to = sp.to === 'plan' ? ('plan' as const) : null;
  return <TourModeEntry initialLocale={locale} initialCode={code} initialTo={to} />;
}
